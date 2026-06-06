import type { RoleplayTimeline, TimelineClip, TrackEffect } from "../types";

export interface StudioTransport {
  playing: boolean;
  positionSec: number;
}

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

function envelopeGainAt(clip: TimelineClip, localSec: number): number {
  if (clip.gainEnvelope.length === 0) return dbToGain(clip.gainDb);
  const pts = [...clip.gainEnvelope].sort((a, b) => a.t - b.t);
  if (localSec <= pts[0].t) return dbToGain(pts[0].gainDb);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (localSec <= b.t) {
      const t = (localSec - a.t) / Math.max(b.t - a.t, 0.001);
      const g = a.gainDb + (b.gainDb - a.gainDb) * t;
      return dbToGain(g);
    }
  }
  return dbToGain(pts[pts.length - 1].gainDb);
}

function fadeGain(clip: TimelineClip, localSec: number): number {
  let g = 1;
  if (clip.fadeInSec > 0 && localSec < clip.fadeInSec) {
    g *= localSec / clip.fadeInSec;
  }
  const end = clip.durationSec;
  if (clip.fadeOutSec > 0 && localSec > end - clip.fadeOutSec) {
    g *= Math.max(0, (end - localSec) / clip.fadeOutSec);
  }
  return g;
}

function buildTrackEffects(ctx: AudioContext, effects: TrackEffect[]): AudioNode {
  let node: AudioNode = ctx.createGain();
  for (const fx of effects) {
    if (!fx.enabled) continue;
    if (fx.type === "eq") {
      const low = ctx.createBiquadFilter();
      low.type = "lowshelf";
      low.frequency.value = fx.params.lowFreq ?? 200;
      low.gain.value = fx.params.lowGain ?? 0;
      const mid = ctx.createBiquadFilter();
      mid.type = "peaking";
      mid.frequency.value = fx.params.midFreq ?? 1000;
      mid.Q.value = fx.params.midQ ?? 1;
      mid.gain.value = fx.params.midGain ?? 0;
      const high = ctx.createBiquadFilter();
      high.type = "highshelf";
      high.frequency.value = fx.params.highFreq ?? 4000;
      high.gain.value = fx.params.highGain ?? 0;
      node.connect(low);
      low.connect(mid);
      mid.connect(high);
      node = high;
    } else if (fx.type === "compressor") {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = fx.params.threshold ?? -24;
      comp.ratio.value = fx.params.ratio ?? 3;
      comp.attack.value = (fx.params.attackMs ?? 10) / 1000;
      comp.release.value = (fx.params.releaseMs ?? 120) / 1000;
      node.connect(comp);
      node = comp;
    } else if (fx.type === "reverb") {
      const conv = ctx.createConvolver();
      const len = ctx.sampleRate * 0.4;
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2) * (fx.params.mix ?? 0.25);
        }
      }
      conv.buffer = ir;
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      dry.gain.value = 1 - (fx.params.mix ?? 0.25);
      wet.gain.value = fx.params.mix ?? 0.25;
      node.connect(dry);
      node.connect(conv);
      conv.connect(wet);
      const merge = ctx.createGain();
      dry.connect(merge);
      wet.connect(merge);
      node = merge;
    }
  }
  return node;
}

export class StudioEngine {
  readonly ctx: AudioContext;
  private master: GainNode;
  private trackChains = new Map<string, { input: GainNode; output: AudioNode }>();
  private scheduled: AudioBufferSourceNode[] = [];
  private buffers = new Map<string, AudioBuffer>();
  private startTime = 0;
  private startOffset = 0;
  private playing = false;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
  }

  async loadBuffer(key: string, url: string): Promise<void> {
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const buf = await this.ctx.decodeAudioData(arr.slice(0));
    this.buffers.set(key, buf);
  }

  setBuffer(key: string, buffer: AudioBuffer) {
    this.buffers.set(key, buffer);
  }

  rebuildGraph(timeline: RoleplayTimeline) {
    for (const [, chain] of this.trackChains) {
      try {
        chain.input.disconnect();
        chain.output.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.trackChains.clear();
    for (const track of timeline.tracks) {
      const input = this.ctx.createGain();
      const fxOut = buildTrackEffects(this.ctx, track.effects);
      const trackGain = this.ctx.createGain();
      trackGain.gain.value = track.muted ? 0 : dbToGain(track.gainDb);
      input.connect(fxOut);
      fxOut.connect(trackGain);
      trackGain.connect(this.master);
      this.trackChains.set(track.id, { input, output: trackGain });
    }
  }

  stop() {
    this.playing = false;
    for (const src of this.scheduled) {
      try {
        src.stop();
      } catch {
        /* ignore */
      }
    }
    this.scheduled = [];
  }

  async play(timeline: RoleplayTimeline, fromSec = 0) {
    await this.ctx.resume();
    this.stop();
    this.rebuildGraph(timeline);
    this.playing = true;
    this.startTime = this.ctx.currentTime;
    this.startOffset = fromSec;

    const solo = timeline.tracks.some((t) => t.solo);
    for (const clip of timeline.clips) {
      const track = timeline.tracks.find((t) => t.id === clip.trackId);
      if (!track) continue;
      if (solo && !track.solo) continue;
      const chain = this.trackChains.get(track.id);
      if (!chain) continue;
      const buf = this.buffers.get(clip.sourcePath) ?? this.buffers.get(clip.generationId ?? "");
      if (!buf) continue;

      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      src.connect(g);
      g.connect(chain.input);

      const when = this.startTime + Math.max(0, clip.startSec - fromSec);
      const offset = clip.offsetSec + Math.max(0, fromSec - clip.startSec);
      const playDur = clip.durationSec - Math.max(0, fromSec - clip.startSec);
      if (playDur <= 0) continue;

      const scheduleGain = () => {
        const t0 = when;
        const steps = 32;
        for (let i = 0; i <= steps; i++) {
          const local = (i / steps) * playDur;
          const env = envelopeGainAt(clip, clip.offsetSec + local);
          const fade = fadeGain(clip, clip.offsetSec + local);
          g.gain.setValueAtTime(env * fade, t0 + local);
        }
      };
      scheduleGain();
      src.start(when, offset, playDur);
      this.scheduled.push(src);
      src.onended = () => {
        if (this.scheduled.length === 1) this.playing = false;
      };
    }
  }

  getPositionSec(): number {
    if (!this.playing) return this.startOffset;
    return this.startOffset + (this.ctx.currentTime - this.startTime);
  }

  getTimelineEnd(timeline: RoleplayTimeline): number {
    return timeline.clips.reduce((m, c) => Math.max(m, c.startSec + c.durationSec), 0);
  }

  async renderOffline(timeline: RoleplayTimeline, sampleRate = 44100): Promise<AudioBuffer> {
    const duration = this.getTimelineEnd(timeline) + 0.5;
    const offline = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
    const master = offline.createGain();
    master.connect(offline.destination);

    for (const track of timeline.tracks) {
      const trackGain = offline.createGain();
      trackGain.gain.value = track.muted ? 0 : dbToGain(track.gainDb);
      trackGain.connect(master);

      for (const clip of timeline.clips.filter((c) => c.trackId === track.id)) {
        const buf =
          this.buffers.get(clip.sourcePath) ?? this.buffers.get(clip.generationId ?? "");
        if (!buf) continue;
        const src = offline.createBufferSource();
        src.buffer = buf;
        const g = offline.createGain();
        const steps = 64;
        for (let i = 0; i <= steps; i++) {
          const local = (i / steps) * clip.durationSec;
          g.gain.setValueAtTime(
            envelopeGainAt(clip, clip.offsetSec + local) *
              fadeGain(clip, clip.offsetSec + local),
            clip.startSec + local,
          );
        }
        src.connect(g);
        g.connect(trackGain);
        src.start(clip.startSec, clip.offsetSec, clip.durationSec);
      }
    }

    return offline.startRendering();
  }
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = length * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}
