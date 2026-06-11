import type { MinimaxEmotion, MinimaxSynthesisOptions } from "./minimaxOptions";

export function modelId(model: string): string {
  return model.startsWith("minimax:") ? model.slice("minimax:".length) : model;
}

export function supportsWhisperEmotion(model: string): boolean {
  return modelId(model).includes("2.6");
}

export function supportsContinuousSound(model: string): boolean {
  return modelId(model).includes("2.8");
}

export function supportsInterjections(model: string): boolean {
  return modelId(model).includes("2.8");
}

export function voiceModifySupported(format: string): boolean {
  const f = format.trim().toLowerCase();
  return f === "mp3" || f === "wav" || f === "flac";
}

export function emotionOptionsForModel(model: string): MinimaxEmotion[] {
  const base: MinimaxEmotion[] = [
    "happy",
    "sad",
    "angry",
    "fearful",
    "disgusted",
    "surprised",
    "calm",
    "fluent",
  ];
  if (supportsWhisperEmotion(model)) {
    base.push("whisper");
  }
  return base;
}

export function isAdvancedOptionDisabled(
  model: string,
  opts: MinimaxSynthesisOptions,
  key: string,
): string | null {
  switch (key) {
    case "whisper":
      if (opts.voice.emotion === "whisper" && !supportsWhisperEmotion(model)) {
        return "whisper tylko speech-2.6";
      }
      return null;
    case "continuous_sound":
      return supportsContinuousSound(model) ? null : "tylko speech-2.8";
    case "voice_modify":
      return voiceModifySupported(opts.audio.format)
        ? null
        : "voice_modify: mp3/wav/flac";
    case "word_streaming":
      return opts.transport === "http" || opts.stream
        ? null
        : "word_streaming wymaga HTTP+stream";
    case "latex_read":
      return null;
    default:
      return null;
  }
}
