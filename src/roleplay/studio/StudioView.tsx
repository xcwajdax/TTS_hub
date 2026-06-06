import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { TtsVoiceProfile } from "../../appSettings";
import { audioSrc, playbackAudioSrc, roleplayLoadProject } from "../../api/tauri";
import {
  roleplayCancelQueue,
  roleplayExportMix,
  roleplayGetQueueProgress,
  roleplayImportAudio,
  roleplayWriteMixWav,
  roleplayPauseQueue,
  roleplayRegenerateSegment,
  roleplayResumeQueue,
  roleplayUpdateTimeline,
} from "../../api/tauri";
import type { RoleplayProject, RoleplayTimeline, TimelineClip } from "../types";
import { labelTracks, parseTimeline, timelineToJson } from "../types";
import ClipBlock from "./ClipBlock";
import EffectsPanel from "./EffectsPanel";
import TrackHeader from "./TrackHeader";
import { StudioEngine, audioBufferToWav } from "./engine";

const LANE_H = 64;
const HEADER_W = 180;

interface Props {
  project: RoleplayProject;
  profiles: TtsVoiceProfile[];
  onProjectChange: (p: RoleplayProject) => void;
  onBackToSummary: () => void;
  onError: (msg: string) => void;
  onToast?: (msg: string) => void;
}

export default function StudioView({
  project,
  profiles,
  onProjectChange,
  onBackToSummary,
  onError,
  onToast,
}: Props) {
  const initialTimeline = useMemo(
    () => labelTracks(parseTimeline(project.timeline_json), profiles),
    [project.timeline_json, profiles],
  );

  const [timeline, setTimeline] = useState<RoleplayTimeline>(initialTimeline);
  const [pxPerSec, setPxPerSec] = useState(80);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(
    initialTimeline.tracks[0]?.id ?? null,
  );
  const [playing, setPlaying] = useState(false);
  const [cursorSec, setCursorSec] = useState(0);
  const [queueProgress, setQueueProgress] = useState({ done: 0, total: 0, paused: false });
  const engineRef = useRef<StudioEngine | null>(null);
  const peaksRef = useRef<Map<string, Float32Array>>(new Map());
  const playingRef = useRef(false);

  const engine = useMemo(() => {
    engineRef.current?.ctx.close();
    const e = new StudioEngine();
    engineRef.current = e;
    return e;
  }, [project.id]);

  useEffect(() => {
    const tl = labelTracks(parseTimeline(project.timeline_json), profiles);
    setTimeline(tl);
    peaksRef.current.clear();
  }, [project.timeline_json, profiles]);

  const persistTimeline = useCallback(
    async (next: RoleplayTimeline) => {
      const labeled = labelTracks(next, profiles);
      setTimeline(labeled);
      const json = timelineToJson(labeled);
      onProjectChange({ ...project, timeline_json: json });
      try {
        await roleplayUpdateTimeline(project.id, json);
      } catch (e) {
        onError(String(e));
      }
    },
    [project, profiles, onProjectChange, onError],
  );

  const loadClipBuffers = useCallback(async () => {
    for (const clip of timeline.clips) {
      const key = clip.generationId ?? clip.sourcePath ?? clip.id;
      const url = clip.generationId ? playbackAudioSrc(clip.generationId) : audioSrc(clip.sourcePath);
      try {
        await engine.loadBuffer(key, url);
        const res = await fetch(url);
        if (!res.ok) continue;
        const ab = await res.arrayBuffer();
        const buf = await engine.ctx.decodeAudioData(ab.slice(0));
        const peaks = new Float32Array(200);
        const ch = buf.getChannelData(0);
        const block = Math.max(1, Math.floor(ch.length / peaks.length));
        for (let i = 0; i < peaks.length; i++) {
          let max = 0;
          for (let j = 0; j < block; j++) max = Math.max(max, Math.abs(ch[i * block + j] ?? 0));
          peaks[i] = max;
        }
        peaksRef.current.set(clip.id, peaks);
      } catch {
        /* ignore */
      }
    }
  }, [engine, timeline.clips]);

  useEffect(() => {
    void loadClipBuffers();
  }, [loadClipBuffers]);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    void (async () => {
      unsubs.push(
        await listen<{ project_id: string; total: number; done: number }>(
          "roleplay:queue:progress",
          (ev) => {
            if (ev.payload.project_id !== project.id) return;
            setQueueProgress({
              done: ev.payload.done,
              total: ev.payload.total,
              paused: false,
            });
          },
        ),
      );
      unsubs.push(
        await listen<{ project_id: string }>("roleplay:segment:done", async (ev) => {
          if (ev.payload.project_id !== project.id) return;
          const p = await roleplayLoadProject(project.id);
          onProjectChange(p);
        }),
      );
      unsubs.push(
        await listen<{ project_id: string }>("roleplay:queue:done", async (ev) => {
          if (ev.payload.project_id !== project.id) return;
          const p = await roleplayLoadProject(project.id);
          onProjectChange(p);
          onToast?.("Generacja zakończona — klipy na osi czasu.");
        }),
      );
    })();
    return () => unsubs.forEach((u) => u());
  }, [project.id, onProjectChange, onToast]);

  useEffect(() => {
    const refresh = async () => {
      try {
        const p = await roleplayGetQueueProgress(project.id);
        setQueueProgress({ done: p.done, total: p.total, paused: p.paused });
      } catch {
        /* ignore */
      }
    };
    void refresh();
    const t = window.setInterval(() => void refresh(), 2000);
    return () => clearInterval(t);
  }, [project.id]);

  const timelineEnd = engine.getTimelineEnd(timeline);
  const timelineWidth = Math.max(800, (timelineEnd + 4) * pxPerSec);

  const updateClip = (clipId: string, patch: Partial<TimelineClip>) => {
    const next = {
      ...timeline,
      clips: timeline.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
    };
    void persistTimeline(next);
  };

  const handlePlay = async () => {
    if (timeline.clips.length === 0) {
      onError("Brak klipów na osi czasu.");
      return;
    }
    await engine.play(timeline, cursorSec);
    playingRef.current = true;
    setPlaying(true);
    const tick = () => {
      if (!playingRef.current || !engineRef.current) return;
      const pos = engineRef.current.getPositionSec();
      setCursorSec(pos);
      if (pos >= timelineEnd) {
        playingRef.current = false;
        setPlaying(false);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const handleStop = () => {
    playingRef.current = false;
    engine.stop();
    setPlaying(false);
  };

  const handleImport = async () => {
    const picked = await open({
      multiple: false,
      filters: [{ name: "Audio", extensions: ["wav", "mp3", "ogg", "flac"] }],
    });
    if (!picked || typeof picked !== "string") return;
    try {
      const stored = await roleplayImportAudio(project.id, picked);
      const trackId = timeline.tracks[0]?.id ?? "track-import";
      const nextTracks =
        timeline.tracks.length > 0
          ? timeline.tracks
          : [
              {
                id: trackId,
                name: "Import",
                gainDb: 0,
                muted: false,
                solo: false,
                effects: [],
              },
            ];
      const startSec = timelineEnd;
      const clip: TimelineClip = {
        id: crypto.randomUUID(),
        trackId,
        sourcePath: stored,
        startSec,
        offsetSec: 0,
        durationSec: 3,
        gainDb: 0,
        fadeInSec: 0.02,
        fadeOutSec: 0.05,
        gainEnvelope: [],
      };
      void persistTimeline({ tracks: nextTracks, clips: [...timeline.clips, clip] });
    } catch (e) {
      onError(String(e));
    }
  };

  const handleExport = async () => {
    try {
      const buf = await engine.renderOffline(timeline);
      const wav = audioBufferToWav(buf);
      const bytes = new Uint8Array(await wav.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
      const b64 = btoa(binary);
      const wavPath = await roleplayWriteMixWav(project.id, b64);
      const dest = await open({
        directory: false,
        filters: [{ name: "MP3", extensions: ["mp3"] }],
      });
      if (!dest || typeof dest !== "string") return;
      const out = dest.endsWith(".mp3") ? dest : `${dest}.mp3`;
      await roleplayExportMix(wavPath, out, "mp3");
      onToast?.("Eksport miksu zakończony.");
    } catch (e) {
      onError(String(e));
    }
  };

  const selectedClip = timeline.clips.find((c) => c.id === selectedClipId);
  const selectedTrack = timeline.tracks.find((t) => t.id === selectedTrackId);

  return (
    <div className="flex flex-col h-full min-h-0 roleplay-studio">
      <div className="flex items-center gap-2 p-2 border-b border-border shrink-0 flex-wrap">
        <button type="button" className="btn text-xs" onClick={onBackToSummary}>
          ← Podsumowanie
        </button>
        <button type="button" className="btn text-xs" onClick={() => void handlePlay()} disabled={playing}>
          Odtwórz
        </button>
        <button type="button" className="btn text-xs" onClick={handleStop}>
          Stop
        </button>
        <button type="button" className="btn text-xs" onClick={() => void roleplayPauseQueue(project.id)}>
          Pauza kolejki
        </button>
        <button type="button" className="btn text-xs" onClick={() => void roleplayResumeQueue(project.id)}>
          Wznów
        </button>
        <button type="button" className="btn text-xs" onClick={() => void roleplayCancelQueue(project.id)}>
          Anuluj
        </button>
        <button type="button" className="btn text-xs" onClick={() => void handleImport()}>
          Import audio
        </button>
        <button type="button" className="btn btn-primary text-xs" onClick={() => void handleExport()}>
          Eksport miksu
        </button>
        <label className="text-xs text-muted flex items-center gap-1 ml-auto">
          Zoom
          <input
            type="range"
            min={40}
            max={200}
            value={pxPerSec}
            onChange={(e) => setPxPerSec(Number(e.target.value))}
          />
        </label>
        <span className="text-xs text-muted">
          Kolejka: {queueProgress.done}/{queueProgress.total} · {timeline.clips.length} klipów
        </span>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
          className="shrink-0 border-r border-border overflow-y-auto bg-panel"
          style={{ width: HEADER_W }}
        >
          {timeline.tracks.length === 0 ? (
            <p className="text-xs text-muted p-3">Brak ścieżek — wygeneruj segmenty lub importuj audio.</p>
          ) : (
            timeline.tracks.map((track) => (
              <TrackHeader
                key={track.id}
                track={track}
                selected={selectedTrackId === track.id}
                onSelect={() => setSelectedTrackId(track.id)}
                onChange={(t) => {
                  const next = {
                    ...timeline,
                    tracks: timeline.tracks.map((tr) => (tr.id === t.id ? t : tr)),
                  };
                  void persistTimeline(next);
                }}
              />
            ))
          )}
        </div>

        <div className="flex-1 min-w-0 overflow-auto">
          <div className="relative" style={{ width: timelineWidth, minHeight: timeline.tracks.length * LANE_H }}>
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-accent z-20 pointer-events-none"
              style={{ left: cursorSec * pxPerSec }}
            />
            {timeline.tracks.map((track) => (
              <div
                key={track.id}
                className="relative border-b border-border bg-panel2/40"
                style={{ height: LANE_H, width: timelineWidth }}
              >
                {timeline.clips
                  .filter((c) => c.trackId === track.id)
                  .map((clip) => (
                    <ClipBlock
                      key={clip.id}
                      clip={clip}
                      pxPerSec={pxPerSec}
                      trackHeight={LANE_H}
                      selected={selectedClipId === clip.id}
                      peaks={peaksRef.current.get(clip.id) ?? null}
                      onSelect={() => {
                        setSelectedClipId(clip.id);
                        setSelectedTrackId(track.id);
                      }}
                      onMove={(d) => updateClip(clip.id, { startSec: Math.max(0, clip.startSec + d) })}
                      onTrimStart={(d) =>
                        updateClip(clip.id, {
                          startSec: clip.startSec + d,
                          offsetSec: clip.offsetSec + d,
                          durationSec: Math.max(0.1, clip.durationSec - d),
                        })
                      }
                      onTrimEnd={(d) =>
                        updateClip(clip.id, {
                          durationSec: Math.max(0.1, clip.durationSec + d),
                        })
                      }
                    />
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border shrink-0 grid grid-cols-1 md:grid-cols-2 gap-0 min-h-[120px] max-h-[200px] overflow-auto">
        {selectedTrack && (
          <div className="p-3 border-r border-border md:border-r">
            <EffectsPanel
              track={selectedTrack}
              onChange={(t) => {
                const next = {
                  ...timeline,
                  tracks: timeline.tracks.map((tr) => (tr.id === t.id ? t : tr)),
                };
                void persistTimeline(next);
              }}
            />
          </div>
        )}
        {selectedClip ? (
          <div className="p-3 text-xs flex flex-wrap gap-3 items-center content-start">
            <span className="font-medium text-heading">Klip</span>
            <label>
              Fade in
              <input
                type="number"
                step={0.01}
                min={0}
                className="ml-1 w-16 border border-border rounded px-1 bg-panel"
                value={selectedClip.fadeInSec}
                onChange={(e) => updateClip(selectedClip.id, { fadeInSec: Number(e.target.value) })}
              />
            </label>
            <label>
              Fade out
              <input
                type="number"
                step={0.01}
                min={0}
                className="ml-1 w-16 border border-border rounded px-1 bg-panel"
                value={selectedClip.fadeOutSec}
                onChange={(e) => updateClip(selectedClip.id, { fadeOutSec: Number(e.target.value) })}
              />
            </label>
            <label>
              Gain (dB)
              <input
                type="number"
                step={0.5}
                className="ml-1 w-16 border border-border rounded px-1 bg-panel"
                value={selectedClip.gainDb}
                onChange={(e) => updateClip(selectedClip.id, { gainDb: Number(e.target.value) })}
              />
            </label>
            {selectedClip.segmentId && (
              <button
                type="button"
                className="btn text-xs"
                onClick={() =>
                  void roleplayRegenerateSegment(project.id, selectedClip.segmentId!).catch(onError)
                }
              >
                Wygeneruj ponownie
              </button>
            )}
          </div>
        ) : (
          <div className="p-3 text-xs text-muted flex items-center">
            Kliknij klip na osi czasu, aby edytować fade i gain.
          </div>
        )}
      </div>
    </div>
  );
}
