use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

use crate::commands::enqueue_request;
use crate::db::{Generation, STATUS_DONE, STATUS_FAILED};
use crate::roleplay::commands::{
    build_generate_req_from_profile, resolve_voice_profile, RoleplayQueueProgress,
};
use crate::roleplay::project::{
    PROJECT_STATUS_GENERATING, PROJECT_STATUS_STUDIO, SEG_STATUS_DONE, SEG_STATUS_FAILED,
    SEG_STATUS_GENERATING, SEG_STATUS_PENDING, SEG_STATUS_QUEUED,
};
use crate::roleplay::RoleplaySegment;
use crate::state::AppState;

const MAX_RETRIES: i64 = 3;

#[derive(Clone, Serialize)]
pub struct RoleplaySegmentEvent {
    pub project_id: String,
    pub segment_id: String,
    pub status: String,
    pub generation_id: Option<String>,
    pub error: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct RoleplayQueueEvent {
    pub project_id: String,
    pub total: usize,
    pub done: usize,
    pub paused: bool,
}

struct QueueRunner {
    paused: bool,
    cancelled: bool,
    current_generation_id: Option<String>,
    total: usize,
    done: usize,
}

pub struct RoleplayQueue {
    tx: mpsc::UnboundedSender<(Arc<AppState>, String, Option<String>)>,
    runners: Mutex<HashMap<String, QueueRunner>>,
}

impl RoleplayQueue {
    pub fn start(app: AppHandle) -> Arc<Self> {
        let (tx, mut rx) = mpsc::unbounded_channel();
        let queue = Arc::new(Self {
            tx,
            runners: Mutex::new(HashMap::new()),
        });
        let queue_loop = queue.clone();
        let app_loop = app.clone();
        tauri::async_runtime::spawn(async move {
            while let Some((state, project_id, segment_id)) = rx.recv().await {
                if let Some(seg_id) = segment_id {
                    if let Err(e) = queue_loop
                        .process_one_segment(state.clone(), app_loop.clone(), &project_id, &seg_id)
                        .await
                    {
                        eprintln!("roleplay segment error: {e}");
                    }
                } else {
                    queue_loop
                        .run_project(state.clone(), app_loop.clone(), &project_id)
                        .await;
                }
            }
        });
        queue
    }

    pub fn progress(&self, project_id: &str) -> RoleplayQueueProgress {
        let runners = self.runners.lock().unwrap();
        if let Some(r) = runners.get(project_id) {
            return RoleplayQueueProgress {
                project_id: project_id.to_string(),
                total: r.total,
                done: r.done,
                current_segment_id: None,
                paused: r.paused,
            };
        }
        RoleplayQueueProgress {
            project_id: project_id.to_string(),
            total: 0,
            done: 0,
            current_segment_id: None,
            paused: false,
        }
    }

    pub fn start_project(
        self: &Arc<Self>,
        state: Arc<AppState>,
        project_id: String,
    ) -> Result<RoleplayQueueProgress, anyhow::Error> {
        let project = state
            .db
            .roleplay_get_project(&project_id)?
            .ok_or_else(|| anyhow::anyhow!("projekt nie istnieje"))?;
        let total = project.segments.len();
        let done = project
            .segments
            .iter()
            .filter(|s| s.status == SEG_STATUS_DONE)
            .count();
        {
            let mut runners = self.runners.lock().unwrap();
            runners.insert(
                project_id.clone(),
                QueueRunner {
                    paused: false,
                    cancelled: false,
                    current_generation_id: None,
                    total,
                    done,
                },
            );
        }
        state
            .db
            .roleplay_update_project_status(&project_id, PROJECT_STATUS_GENERATING)?;
        self.tx
            .send((state, project_id.clone(), None))
            .map_err(|e| anyhow::anyhow!("{e}"))?;
        Ok(self.progress(&project_id))
    }

    pub fn pause(&self, project_id: &str) {
        let mut runners = self.runners.lock().unwrap();
        if let Some(r) = runners.get_mut(project_id) {
            r.paused = true;
        }
    }

    pub fn resume_project(
        self: &Arc<Self>,
        state: Arc<AppState>,
        project_id: String,
    ) -> Result<(), anyhow::Error> {
        {
            let mut runners = self.runners.lock().unwrap();
            if let Some(r) = runners.get_mut(&project_id) {
                r.paused = false;
                r.cancelled = false;
            }
        }
        self.tx
            .send((state, project_id, None))
            .map_err(|e| anyhow::anyhow!("{e}"))?;
        Ok(())
    }

    pub fn cancel(&self, project_id: &str) {
        let mut runners = self.runners.lock().unwrap();
        if let Some(r) = runners.get_mut(project_id) {
            r.cancelled = true;
            r.paused = true;
        }
    }

    pub fn enqueue_segment(
        self: &Arc<Self>,
        state: Arc<AppState>,
        project_id: String,
        segment_id: String,
    ) -> Result<(), anyhow::Error> {
        self.tx
            .send((state, project_id, Some(segment_id)))
            .map_err(|e| anyhow::anyhow!("{e}"))?;
        Ok(())
    }

    async fn run_project(self: &Arc<Self>, state: Arc<AppState>, app: AppHandle, project_id: &str) {
        loop {
            if self.is_cancelled(project_id) {
                break;
            }
            if self.is_paused(project_id) {
                tokio::time::sleep(Duration::from_millis(400)).await;
                continue;
            }
            let pending = match state.db.roleplay_pending_segments(project_id) {
                Ok(p) => p,
                Err(e) => {
                    eprintln!("roleplay pending: {e}");
                    break;
                }
            };
            if pending.is_empty() {
                let _ = state.db.roleplay_update_project_status(
                    project_id,
                    PROJECT_STATUS_STUDIO,
                );
                let _ = app.emit(
                    "roleplay:queue:done",
                    RoleplayQueueEvent {
                        project_id: project_id.to_string(),
                        total: self.progress(project_id).total,
                        done: self.progress(project_id).done,
                        paused: false,
                    },
                );
                break;
            }
            let seg = &pending[0];
            if let Err(e) = self
                .process_one_segment(state.clone(), app.clone(), project_id, &seg.id)
                .await
            {
                eprintln!("roleplay process: {e}");
            }
        }
    }

    async fn process_one_segment(
        self: &Arc<Self>,
        state: Arc<AppState>,
        app: AppHandle,
        project_id: &str,
        segment_id: &str,
    ) -> Result<(), String> {
        if self.is_cancelled(project_id) {
            return Ok(());
        }
        let project = state
            .db
            .roleplay_get_project(project_id)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "projekt nie istnieje".to_string())?;
        let mut seg = project
            .segments
            .into_iter()
            .find(|s| s.id == segment_id)
            .ok_or_else(|| "segment nie istnieje".to_string())?;

        let profile = resolve_voice_profile(&state, &seg.voice_profile_id)?;
        let format = {
            let settings = state.settings.read().map_err(|e| e.to_string())?;
            settings.save_format.clone()
        };

        let req = build_generate_req_from_profile(&profile, &seg.text, &format);
        seg.status = SEG_STATUS_QUEUED.to_string();
        state.db.roleplay_update_segment(&seg).map_err(|e| e.to_string())?;

        let _ = app.emit(
            "roleplay:segment:phase",
            RoleplaySegmentEvent {
                project_id: project_id.to_string(),
                segment_id: segment_id.to_string(),
                status: SEG_STATUS_QUEUED.to_string(),
                generation_id: None,
                error: None,
            },
        );

        let gen = enqueue_request(&state, req).map_err(|e| e.to_string())?;
        seg.generation_id = Some(gen.id.clone());
        seg.status = SEG_STATUS_GENERATING.to_string();
        state.db.roleplay_update_segment(&seg).map_err(|e| e.to_string())?;

        {
            let mut runners = self.runners.lock().unwrap();
            if let Some(r) = runners.get_mut(project_id) {
                r.current_generation_id = Some(gen.id.clone());
            }
        }

        let job_queue = state
            .job_queue
            .get()
            .ok_or_else(|| "job queue not ready".to_string())?;
        let mut rx = job_queue.subscribe();

        let result = loop {
            match rx.recv().await {
                Ok(ev) if ev.job_id == gen.id => {
                    if ev.status == STATUS_DONE {
                        break Ok(());
                    }
                    if ev.status == STATUS_FAILED {
                        break Err(ev.error.unwrap_or_else(|| "generacja nie powiodła się".into()));
                    }
                }
                Ok(_) => continue,
                Err(_) => break Err("utracono połączenie z kolejką zadań".into()),
            }
        };

        match result {
            Ok(()) => {
                self.on_segment_done(&state, &app, project_id, &mut seg, &gen)
                    .await?;
            }
            Err(err_msg) => {
                self.on_segment_failed(&state, &app, project_id, &mut seg, &err_msg)
                    .await?;
            }
        }
        Ok(())
    }

    async fn on_segment_done(
        &self,
        state: &Arc<AppState>,
        app: &AppHandle,
        project_id: &str,
        seg: &mut RoleplaySegment,
        gen: &Generation,
    ) -> Result<(), String> {
        seg.status = SEG_STATUS_DONE.to_string();
        seg.error = None;
        state.db.roleplay_update_segment(seg).map_err(|e| e.to_string())?;

        if let Ok(Some(project)) = state.db.roleplay_get_project(project_id) {
            let timeline = append_clip_to_timeline(
                &project.timeline_json,
                seg,
                gen,
            );
            let _ = state.db.roleplay_update_timeline(project_id, &timeline);
        }

        {
            let mut runners = self.runners.lock().unwrap();
            if let Some(r) = runners.get_mut(project_id) {
                r.done += 1;
                r.current_generation_id = None;
            }
        }

        let progress = self.progress(project_id);
        let _ = app.emit(
            "roleplay:segment:done",
            RoleplaySegmentEvent {
                project_id: project_id.to_string(),
                segment_id: seg.id.clone(),
                status: SEG_STATUS_DONE.to_string(),
                generation_id: seg.generation_id.clone(),
                error: None,
            },
        );
        let _ = app.emit(
            "roleplay:queue:progress",
            RoleplayQueueEvent {
                project_id: project_id.to_string(),
                total: progress.total,
                done: progress.done,
                paused: progress.paused,
            },
        );
        Ok(())
    }

    async fn on_segment_failed(
        &self,
        state: &Arc<AppState>,
        app: &AppHandle,
        project_id: &str,
        seg: &mut RoleplaySegment,
        err_msg: &str,
    ) -> Result<(), String> {
        seg.retry_count += 1;
        if seg.retry_count < MAX_RETRIES {
            seg.status = SEG_STATUS_PENDING.to_string();
            seg.generation_id = None;
            seg.error = Some(err_msg.to_string());
            state.db.roleplay_update_segment(seg).map_err(|e| e.to_string())?;
            let backoff = Duration::from_secs(2u64.pow(seg.retry_count as u32));
            tokio::time::sleep(backoff).await;
            let _ = self.tx.send((
                state.clone(),
                project_id.to_string(),
                Some(seg.id.clone()),
            ));
        } else {
            seg.status = SEG_STATUS_FAILED.to_string();
            seg.error = Some(err_msg.to_string());
            state.db.roleplay_update_segment(seg).map_err(|e| e.to_string())?;
            let _ = app.emit(
                "roleplay:segment:error",
                RoleplaySegmentEvent {
                    project_id: project_id.to_string(),
                    segment_id: seg.id.clone(),
                    status: SEG_STATUS_FAILED.to_string(),
                    generation_id: seg.generation_id.clone(),
                    error: seg.error.clone(),
                },
            );
        }
        Ok(())
    }

    fn is_paused(&self, project_id: &str) -> bool {
        self.runners
            .lock()
            .unwrap()
            .get(project_id)
            .map(|r| r.paused)
            .unwrap_or(false)
    }

    fn is_cancelled(&self, project_id: &str) -> bool {
        self.runners
            .lock()
            .unwrap()
            .get(project_id)
            .map(|r| r.cancelled)
            .unwrap_or(true)
    }
}

fn append_clip_to_timeline(timeline_json: &str, seg: &RoleplaySegment, gen: &Generation) -> String {
    #[derive(serde::Deserialize, serde::Serialize, Default)]
    struct Timeline {
        #[serde(default)]
        tracks: Vec<TimelineTrack>,
        #[serde(default)]
        clips: Vec<TimelineClip>,
    }
    #[derive(serde::Deserialize, serde::Serialize)]
    struct TimelineTrack {
        id: String,
        name: String,
        #[serde(default)]
        voice_profile_id: Option<String>,
        #[serde(default = "default_gain")]
        gain_db: f32,
        #[serde(default)]
        muted: bool,
        #[serde(default)]
        solo: bool,
        #[serde(default)]
        effects: Vec<serde_json::Value>,
    }
    #[derive(serde::Deserialize, serde::Serialize)]
    struct TimelineClip {
        id: String,
        track_id: String,
        #[serde(default)]
        segment_id: Option<String>,
        source_path: String,
        generation_id: Option<String>,
        start_sec: f64,
        offset_sec: f64,
        duration_sec: f64,
        #[serde(default = "default_gain")]
        gain_db: f32,
        #[serde(default)]
        fade_in_sec: f64,
        #[serde(default)]
        fade_out_sec: f64,
        #[serde(default)]
        gain_envelope: Vec<serde_json::Value>,
    }
    fn default_gain() -> f32 {
        0.0
    }

    let mut timeline: Timeline = serde_json::from_str(timeline_json).unwrap_or_default();
    let track_id = format!("track-{}", seg.voice_profile_id);
    if !timeline.tracks.iter().any(|t| t.id == track_id) {
        timeline.tracks.push(TimelineTrack {
            id: track_id.clone(),
            name: seg.voice_profile_id.clone(),
            voice_profile_id: Some(seg.voice_profile_id.clone()),
            gain_db: 0.0,
            muted: false,
            solo: false,
            effects: Vec::new(),
        });
    }
    let start_sec = timeline
        .clips
        .iter()
        .map(|c| c.start_sec + c.duration_sec)
        .fold(0.0_f64, f64::max);
    let duration_sec = gen
        .duration_ms
        .map(|ms| ms as f64 / 1000.0)
        .unwrap_or(3.0)
        .max(0.1);
    timeline.clips.push(TimelineClip {
        id: uuid::Uuid::new_v4().to_string(),
        track_id,
        segment_id: Some(seg.id.clone()),
        source_path: gen.file_path.clone(),
        generation_id: Some(gen.id.clone()),
        start_sec,
        offset_sec: 0.0,
        duration_sec,
        gain_db: 0.0,
        fade_in_sec: 0.05,
        fade_out_sec: 0.05,
        gain_envelope: Vec::new(),
    });
    serde_json::to_string(&timeline).unwrap_or_else(|_| timeline_json.to_string())
}

