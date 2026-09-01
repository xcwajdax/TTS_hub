import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { AppSettings, TtsVoiceProfile } from "../../appSettings";
import {
  audioSrc,
  getAppSettings,
  playbackAudioSrc,
  roleplayLoadProject,
  setAppSettings,
} from "../../api/tauri";
import {
  roleplayCancelQueue,
  roleplayExportMix,
  roleplayExportMp4,
  roleplayGetQueueProgress,
  roleplayImportAudio,
  roleplayRebuildTimeline,
  roleplayWriteMixWav,
  roleplayPauseQueue,
  roleplayRegenerateSegment,
  roleplayResumeQueue,
  roleplayUpdateTimeline,
} from "../../api/tauri";
import {
  getRoleplayMutePreview,
  ROLEPLAY_MUTE_PREVIEW_CHANGED,
  setRoleplayMutePreview,
} from "../../lib/roleplayMutePreview";
import type { RoleplayProject, RoleplayTimeline, TimelineClip } from "../types";
import {
  labelTracks,
  parsePalette,
  parseTimeline,
  profileColorMap,
  timelineToJson,
  trackColor,
} from "../types";
import ClipBlock from "./ClipBlock";
import EffectsPanel from "./EffectsPanel";
import TrackHeader from "./TrackHeader";
import TimeRuler, { TimelineGridLines } from "./TimeRuler";
import RoleplayZoomSlider from "./RoleplayZoomSlider";
import { StudioEngine, audioBufferToWav, clipBufferKey } from "./engine";

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function peaksCountForDuration(durationSec: number): number {
  return Math.max(128, Math.min(4096, Math.ceil(durationSec * 48)));
}

function computePeaks(
  buf: AudioBuffer,
  offsetSec: number,
  durationSec: number,
  peakCount?: number,
): Float32Array {
  const count = peakCount ?? peaksCountForDuration(durationSec);
  const ch = buf.getChannelData(0);
  const sampleRate = buf.sampleRate;
  const startSample = Math.max(0, Math.floor(offsetSec * sampleRate));
  const endSample = Math.min(ch.length, Math.ceil((offsetSec + durationSec) * sampleRate));
  const span = Math.max(1, endSample - startSample);
  const peaks = new Float32Array(count);
  const block = Math.max(1, Math.floor(span / count));
  for (let i = 0; i < count; i++) {
    let max = 0;
    const base = startSample + i * block;
    for (let j = 0; j < block && base + j < endSample; j++) {
      max = Math.max(max, Math.abs(ch[base + j] ?? 0));
    }
    peaks[i] = max;
  }
  return peaks;
}

const LANE_H = 88;
const HEADER_W = 196;
const RULER_H = 24;
const ZOOM_MIN = 4;
const ZOOM_MAX = 240;

function timelineStructureKey(json: string): string {
  const tl = parseTimeline(json);
  return tl.clips
    .map(
      (c) =>
        `${c.id}|${c.generationId ?? ""}|${c.trackId}|${c.startSec.toFixed(3)}|${c.offsetSec.toFixed(3)}`,
    )
    .join(";");
}

interface Props {
  project: RoleplayProject;
  profiles: TtsVoiceProfile[];
  onProjectChange: (p: RoleplayProject) => void;
  onBackToSummary?: () => void;
  embedded?: boolean;
  onError: (msg: string) => void;
  onToast?: (msg: string) => void;
}

export default function StudioView({
  project,
  profiles,
  onProjectChange,
  onBackToSummary,
  embedded = false,
  onError,
  onToast,
}: Props) {
  const colorMap = useMemo(() => profileColorMap(parsePalette(project.palette_json)), [project.palette_json]);

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
  const [buffersReady, setBuffersReady] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingMp4, setExportingMp4] = useState(false);
  const [mutePreview, setMutePreview] = useState(getRoleplayMutePreview);
  const [clipDragPreview, setClipDragPreview] = useState<Map<string, Partial<TimelineClip>>>(
    () => new Map(),
  );
  const [peaksVersion, setPeaksVersion] = useState(0);

  const engineRef = useRef<StudioEngine | null>(null);
  const peaksRef = useRef<Map<string, Float32Array>>(new Map());
  const sourceDurRef = useRef<Map<string, number>>(new Map());
  const playingRef = useRef(false);
  const syncedDurationsRef = useRef<Set<string>>(new Set());
  const timelineStructureKeyRef = useRef("");
  const durationSyncInFlightRef = useRef(false);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const rulerScrollRef = useRef<HTMLDivElement>(null);
  const appSettingsRef = useRef<AppSettings | null>(null);

  const syncScroll = (source: "ruler" | "timeline") => {
    const ruler = rulerScrollRef.current;
    const timeline = timelineScrollRef.current;
    if (!ruler || !timeline) return;
    if (source === "timeline") ruler.scrollLeft = timeline.scrollLeft;
    else timeline.scrollLeft = ruler.scrollLeft;
  };

  const engine = useMemo(() => {
    engineRef.current?.ctx.close();
    const e = new StudioEngine();
    engineRef.current = e;
    return e;
  }, [project.id]);

  useEffect(() => {
    void getAppSettings().then((view) => {
      appSettingsRef.current = view;
      const muted = view.roleplay_mute_preview !== false;
      setRoleplayMutePreview(muted);
      setMutePreview(muted);
    });
  }, []);

  useEffect(() => {
    const tl = labelTracks(parseTimeline(project.timeline_json), profiles);
    const structureKey = timelineStructureKey(project.timeline_json);
    setTimeline(tl);

    if (structureKey !== timelineStructureKeyRef.current) {
      timelineStructureKeyRef.current = structureKey;
      peaksRef.current.clear();
      sourceDurRef.current.clear();
      syncedDurationsRef.current.clear();
      setClipDragPreview(new Map());
      setBuffersReady(false);
    }
  }, [project.timeline_json, profiles]);

  useEffect(() => {
    timelineStructureKeyRef.current = "";
    peaksRef.current.clear();
    sourceDurRef.current.clear();
    syncedDurationsRef.current.clear();
    setClipDragPreview(new Map());
    setBuffersReady(false);
  }, [project.id]);

  const persistTimeline = useCallback(
    async (next: RoleplayTimeline, options?: { syncParent?: boolean }) => {
      const labeled = labelTracks(next, profiles);
      setTimeline(labeled);
      const json = timelineToJson(labeled);
      if (options?.syncParent !== false) {
        onProjectChange({ ...project, timeline_json: json });
      }
      try {
        await roleplayUpdateTimeline(project.id, json);
      } catch (e) {
        onError(String(e));
      }
    },
    [project, profiles, onProjectChange, onError],
  );

  const bufferRef = useRef<Map<string, AudioBuffer>>(new Map());

  const refreshPeaksForClip = useCallback((clip: TimelineClip) => {
    const key = clipBufferKey(clip);
    const stored = bufferRef.current.get(key);
    if (!stored) return;
    peaksRef.current.set(clip.id, computePeaks(stored, clip.offsetSec, clip.durationSec));
    setPeaksVersion((v) => v + 1);
  }, []);

  const loadClipBuffers = useCallback(async (): Promise<boolean> => {
    if (timeline.clips.length === 0) {
      setBuffersReady(true);
      return true;
    }
    const durationPatches: Array<{ id: string; durationSec: number }> = [];
    const fadePatches: Array<{ id: string; fadeInSec: number; fadeOutSec: number }> = [];
    let loaded = 0;
    for (const clip of timeline.clips) {
      const key = clipBufferKey(clip);
      const url = clip.generationId ? playbackAudioSrc(clip.generationId) : audioSrc(clip.sourcePath);
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const ab = await res.arrayBuffer();
        const buf = await engine.ctx.decodeAudioData(ab.slice(0));
        engine.setBuffer(key, buf);
        bufferRef.current.set(key, buf);
        sourceDurRef.current.set(clip.id, buf.duration);
        loaded += 1;

        const sourceAvail = Math.max(0.1, buf.duration - clip.offsetSec);
        const effectiveDur =
          clip.durationSec < sourceAvail - 0.05 ? sourceAvail : clip.durationSec;

        peaksRef.current.set(
          clip.id,
          computePeaks(buf, clip.offsetSec, effectiveDur),
        );

        const actualDur = sourceAvail;
        if (
          !syncedDurationsRef.current.has(clip.id) &&
          Math.abs(actualDur - clip.durationSec) > 0.05
        ) {
          durationPatches.push({ id: clip.id, durationSec: actualDur });
          syncedDurationsRef.current.add(clip.id);
        }
        if (clip.fadeInSec === 0.05 && clip.fadeOutSec === 0.05) {
          fadePatches.push({ id: clip.id, fadeInSec: 0, fadeOutSec: 0.02 });
        }
      } catch {
        /* ignore */
      }
    }
    if (durationPatches.length > 0 || fadePatches.length > 0) {
      if (durationSyncInFlightRef.current) {
        setPeaksVersion((v) => v + 1);
        setBuffersReady(loaded === timeline.clips.length);
        return loaded === timeline.clips.length;
      }
      durationSyncInFlightRef.current = true;
      const next = {
        ...timeline,
        clips: timeline.clips.map((c) => {
          const dur = durationPatches.find((p) => p.id === c.id);
          const fade = fadePatches.find((p) => p.id === c.id);
          return {
            ...c,
            ...(dur ? { durationSec: dur.durationSec } : {}),
            ...(fade ? { fadeInSec: fade.fadeInSec, fadeOutSec: fade.fadeOutSec } : {}),
          };
        }),
      };
      for (const c of next.clips) {
        const key = clipBufferKey(c);
        const buf = bufferRef.current.get(key);
        if (buf) {
          peaksRef.current.set(c.id, computePeaks(buf, c.offsetSec, c.durationSec));
        }
      }
      setPeaksVersion((v) => v + 1);
      try {
        await persistTimeline(next, { syncParent: false });
      } finally {
        durationSyncInFlightRef.current = false;
      }
    } else {
      setPeaksVersion((v) => v + 1);
    }
    const ready = loaded === timeline.clips.length;
    setBuffersReady(ready);
    return ready;
  }, [engine, timeline, persistTimeline]);

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
          try {
            const p = await roleplayRebuildTimeline(project.id);
            onProjectChange(p);
          } catch {
            const p = await roleplayLoadProject(project.id);
            onProjectChange(p);
          }
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

  const displayClip = (clip: TimelineClip): TimelineClip => {
    const patch = clipDragPreview.get(clip.id);
    return patch ? { ...clip, ...patch } : clip;
  };

  const sourceDuration = (clipId: string, clip: TimelineClip): number =>
    sourceDurRef.current.get(clipId) ?? clip.offsetSec + clip.durationSec;

  const applyClipPatch = (clipId: string, patch: Partial<TimelineClip>) => {
    setClipDragPreview((prev) => {
      const next = new Map(prev);
      next.set(clipId, { ...prev.get(clipId), ...patch });
      return next;
    });
  };

  const clampTrimPatch = (
    clip: TimelineClip,
    patch: Partial<TimelineClip>,
  ): Partial<TimelineClip> => {
    const srcDur = sourceDuration(clip.id, clip);
    let offsetSec = patch.offsetSec ?? clip.offsetSec;
    let durationSec = patch.durationSec ?? clip.durationSec;
    let startSec = patch.startSec ?? clip.startSec;

    offsetSec = Math.max(0, offsetSec);
    durationSec = Math.max(0.1, durationSec);
    if (offsetSec + durationSec > srcDur) {
      durationSec = Math.max(0.1, srcDur - offsetSec);
    }
    startSec = Math.max(0, startSec);

    return { ...patch, offsetSec, durationSec, startSec };
  };

  const commitClipDrag = (clipId: string) => {
    const patch = clipDragPreview.get(clipId);
    if (!patch) return;
    const clip = timeline.clips.find((c) => c.id === clipId);
    if (!clip) return;
    const merged = clampTrimPatch(clip, { ...clip, ...patch });
    const next = {
      ...timeline,
      clips: timeline.clips.map((c) => (c.id === clipId ? { ...c, ...merged } : c)),
    };
    setClipDragPreview((prev) => {
      const m = new Map(prev);
      m.delete(clipId);
      return m;
    });
    void persistTimeline(next).then(() => {
      const updated = next.clips.find((c) => c.id === clipId);
      if (updated) refreshPeaksForClip(updated);
    });
  };

  const updateClip = (clipId: string, patch: Partial<TimelineClip>) => {
    const clip = timeline.clips.find((c) => c.id === clipId);
    if (!clip) return;
    const merged = clampTrimPatch(clip, patch);
    const next = {
      ...timeline,
      clips: timeline.clips.map((c) => (c.id === clipId ? { ...c, ...merged } : c)),
    };
    void persistTimeline(next).then(() => {
      const updated = next.clips.find((c) => c.id === clipId);
      if (updated) refreshPeaksForClip(updated);
    });
  };

  const handleMuteToggle = async (checked: boolean) => {
    setMutePreview(checked);
    setRoleplayMutePreview(checked);
    window.dispatchEvent(new CustomEvent(ROLEPLAY_MUTE_PREVIEW_CHANGED));
    const base = appSettingsRef.current;
    if (!base) {
      const view = await getAppSettings();
      appSettingsRef.current = view;
    }
    const settings = { ...(appSettingsRef.current ?? (await getAppSettings())), roleplay_mute_preview: checked };
    appSettingsRef.current = settings;
    try {
      await setAppSettings(settings);
    } catch (e) {
      onError(String(e));
    }
  };

  const handlePlay = async () => {
    if (timeline.clips.length === 0) {
      onError("Brak klipów na osi czasu.");
      return;
    }
    await loadClipBuffers();
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
      const res = await fetch(audioSrc(stored));
      if (!res.ok) throw new Error("Nie udało się odczytać importowanego pliku.");
      const ab = await res.arrayBuffer();
      const decoded = await engine.ctx.decodeAudioData(ab.slice(0));
      const durationSec = Math.max(0.1, decoded.duration);
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
        durationSec,
        gainDb: 0,
        fadeInSec: 0,
        fadeOutSec: 0.02,
        gainEnvelope: [],
      };
      engine.setBuffer(clipBufferKey(clip), decoded);
      bufferRef.current.set(clipBufferKey(clip), decoded);
      sourceDurRef.current.set(clip.id, decoded.duration);
      peaksRef.current.set(clip.id, computePeaks(decoded, 0, durationSec));
      setPeaksVersion((v) => v + 1);
      void persistTimeline({ tracks: nextTracks, clips: [...timeline.clips, clip] });
    } catch (e) {
      onError(String(e));
    }
  };

  const handleExport = async () => {
    if (timeline.clips.length === 0) {
      onError("Brak klipów do eksportu.");
      return;
    }
    setExporting(true);
    try {
      const ready = await loadClipBuffers();
      if (!ready) {
        onError("Nie wszystkie klipy audio są gotowe — spróbuj ponownie za chwilę.");
        return;
      }
      const buf = await engine.renderOffline(timeline);
      if (buf.length === 0) {
        onError("Miks jest pusty — brak załadowanych buforów audio.");
        return;
      }
      const wav = audioBufferToWav(buf);
      const bytes = new Uint8Array(await wav.arrayBuffer());
      const b64 = uint8ToBase64(bytes);
      const wavPath = await roleplayWriteMixWav(project.id, b64);
      const safeName = project.name.replace(/[<>:"/\\|?*]/g, "_").trim() || "mix";
      const dest = await save({
        defaultPath: `${safeName}-mix.mp3`,
        filters: [
          { name: "MP3", extensions: ["mp3"] },
          { name: "WAV", extensions: ["wav"] },
        ],
      });
      if (!dest || typeof dest !== "string") {
        onToast?.("Eksport anulowany.");
        return;
      }
      const lower = dest.toLowerCase();
      const out =
        lower.endsWith(".wav") || lower.endsWith(".mp3") ? dest : `${dest}.mp3`;
      const format = out.toLowerCase().endsWith(".wav") ? "wav" : "mp3";
      await roleplayExportMix(wavPath, out, format);
      onToast?.(`Eksport miksu zakończony (${format.toUpperCase()}).`);
    } catch (e) {
      onError(String(e));
    } finally {
      setExporting(false);
    }
  };

  const handleExportMp4 = async () => {
    if (timeline.clips.length === 0) {
      onError("Brak klipów do eksportu MP4.");
      return;
    }
    setExportingMp4(true);
    try {
      const ready = await loadClipBuffers();
      if (!ready) {
        onError("Nie wszystkie klipy audio są gotowe — spróbuj ponownie za chwilę.");
        return;
      }
      const buf = await engine.renderOffline(timeline);
      if (buf.length === 0) {
        onError("Miks jest pusty — brak załadowanych buforów audio.");
        return;
      }
      const wav = audioBufferToWav(buf);
      const bytes = new Uint8Array(await wav.arrayBuffer());
      const b64 = uint8ToBase64(bytes);
      const wavPath = await roleplayWriteMixWav(project.id, b64);
      const safeName = project.name.replace(/[<>:"/\\|?*]/g, "_").trim() || "mix";
      const dest = await save({
        defaultPath: `${safeName}-roleplay.mp4`,
        filters: [{ name: "MP4", extensions: ["mp4"] }],
      });
      if (!dest || typeof dest !== "string") {
        onToast?.("Eksport MP4 anulowany.");
        return;
      }
      const out = dest.toLowerCase().endsWith(".mp4") ? dest : `${dest}.mp4`;
      await roleplayExportMp4(project.id, wavPath, out);
      onToast?.("Multi-głosowe MP4 wygenerowane.");
    } catch (e) {
      onError(String(e));
    } finally {
      setExportingMp4(false);
    }
  };

  const selectedClip = timeline.clips.find((c) => c.id === selectedClipId);
  const selectedTrack = timeline.tracks.find((t) => t.id === selectedTrackId);

  void peaksVersion;

  return (
    <div className="flex flex-col h-full min-h-0 roleplay-studio">
      <div className="flex items-center gap-2 p-2 border-b border-border shrink-0 flex-wrap">
        {!embedded && onBackToSummary ? (
          <button type="button" className="btn text-xs" onClick={onBackToSummary}>
            ← Podsumowanie
          </button>
        ) : null}
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
        <button
          type="button"
          className="btn btn-primary text-xs"
          onClick={() => void handleExport()}
          disabled={exporting || exportingMp4 || timeline.clips.length === 0 || !buffersReady}
          title={!buffersReady ? "Ładowanie audio klipów…" : undefined}
        >
          {exporting ? "Eksport…" : "Eksport miksu"}
        </button>
        <button
          type="button"
          className="btn text-xs"
          onClick={() => void handleExportMp4()}
          disabled={exporting || exportingMp4 || timeline.clips.length === 0 || !buffersReady}
          title={
            !buffersReady
              ? "Ładowanie audio klipów…"
              : "Multi-głosowe MP4 ze ścieżką karaoke (nazwy głosów + dialog)"
          }
        >
          {exportingMp4 ? "MP4…" : "Eksport MP4"}
        </button>
        <label
          className="text-xs text-muted flex items-center gap-1.5"
          title="Gdy włączone, segmenty roleplay nie odtwarzają się automatycznie po wygenerowaniu"
        >
          <input
            type="checkbox"
            checked={mutePreview}
            onChange={(e) => void handleMuteToggle(e.target.checked)}
          />
          Wycisz podgląd generacji
        </label>
        <RoleplayZoomSlider
          value={pxPerSec}
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          onChange={setPxPerSec}
        />
        <span className="text-xs text-muted">
          Kolejka: {queueProgress.done}/{queueProgress.total} · {timeline.clips.length} klipów
        </span>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col shrink-0 border-r border-border bg-panel" style={{ width: HEADER_W }}>
          <div className="shrink-0 border-b border-border bg-panel2" style={{ height: RULER_H }} />
          <div className="flex-1 overflow-y-auto">
            {timeline.tracks.length === 0 ? (
              <p className="text-xs text-muted p-3">Brak ścieżek — wygeneruj segmenty lub importuj audio.</p>
            ) : (
              timeline.tracks.map((track) => (
                <TrackHeader
                  key={track.id}
                  track={track}
                  laneHeight={LANE_H}
                  profile={
                    track.voiceProfileId
                      ? profiles.find((p) => p.id === track.voiceProfileId)
                      : undefined
                  }
                  color={trackColor(track, colorMap)}
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
        </div>

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <div
            ref={rulerScrollRef}
            className="overflow-x-auto shrink-0 border-b border-border"
            onScroll={() => syncScroll("ruler")}
          >
            <TimeRuler
              pxPerSec={pxPerSec}
              durationSec={timelineEnd + 2}
              cursorSec={cursorSec}
              width={timelineWidth}
            />
          </div>
          <div
            ref={timelineScrollRef}
            className="flex-1 min-h-0 overflow-auto"
            onScroll={() => syncScroll("timeline")}
          >
            <div
              className="relative"
              style={{ width: timelineWidth, minHeight: timeline.tracks.length * LANE_H || LANE_H }}
            >
              {timeline.tracks.map((track) => (
                <div
                  key={track.id}
                  className="relative border-b border-border bg-panel2/40"
                  style={{ height: LANE_H, width: timelineWidth }}
                >
                  <TimelineGridLines
                    pxPerSec={pxPerSec}
                    durationSec={timelineEnd + 2}
                    width={timelineWidth}
                    height={LANE_H}
                  />
                  {timeline.clips
                    .filter((c) => c.trackId === track.id)
                    .map((clip) => {
                      const shown = displayClip(clip);
                      const trackClr = trackColor(track, colorMap);
                      return (
                        <ClipBlock
                          key={clip.id}
                          clip={shown}
                          color={trackClr}
                          pxPerSec={pxPerSec}
                          trackHeight={LANE_H}
                          selected={selectedClipId === clip.id}
                          peaks={peaksRef.current.get(clip.id) ?? null}
                          onSelect={() => {
                            setSelectedClipId(clip.id);
                            setSelectedTrackId(track.id);
                          }}
                          onMove={(d) =>
                            applyClipPatch(clip.id, {
                              startSec: Math.max(0, shown.startSec + d),
                            })
                          }
                          onTrimStart={(d) => {
                            const patch = clampTrimPatch(shown, {
                              startSec: shown.startSec + d,
                              offsetSec: shown.offsetSec + d,
                              durationSec: shown.durationSec - d,
                            });
                            applyClipPatch(clip.id, patch);
                          }}
                          onTrimEnd={(d) => {
                            const patch = clampTrimPatch(shown, {
                              durationSec: shown.durationSec + d,
                            });
                            applyClipPatch(clip.id, patch);
                          }}
                          onDragEnd={() => commitClipDrag(clip.id)}
                        />
                      );
                    })}
                </div>
              ))}
            </div>
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
              Offset (s)
              <input
                type="number"
                step={0.01}
                min={0}
                className="ml-1 w-16 border border-border rounded px-1 bg-panel"
                value={selectedClip.offsetSec}
                onChange={(e) =>
                  updateClip(selectedClip.id, { offsetSec: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Długość (s)
              <input
                type="number"
                step={0.01}
                min={0.1}
                className="ml-1 w-16 border border-border rounded px-1 bg-panel"
                value={selectedClip.durationSec}
                onChange={(e) =>
                  updateClip(selectedClip.id, { durationSec: Number(e.target.value) })
                }
              />
            </label>
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
            Kliknij klip na osi czasu, aby edytować trim, fade i gain. Przeciągnij krawędzie klipu, aby przyciąć.
          </div>
        )}
      </div>
    </div>
  );
}
