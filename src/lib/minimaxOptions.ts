/** Mirror of Rust `MinimaxSynthesisOptions` — keep in sync with minimax_options.rs */

export type MinimaxEmotion =
  | "happy"
  | "sad"
  | "angry"
  | "fearful"
  | "disgusted"
  | "surprised"
  | "calm"
  | "fluent"
  | "whisper";

export type MinimaxSoundEffect =
  | "spacious_echo"
  | "auditorium_echo"
  | "lofi_telephone"
  | "robotic";

export type MinimaxSubtitleType = "sentence" | "word" | "word_streaming";

export type MinimaxOutputFormat = "hex" | "url";

export type MinimaxTransport = "websocket" | "http";

export type MinimaxHttpRegion = "default" | "uw";

export interface MinimaxTimbreWeight {
  voice_id: string;
  weight: number;
}

export interface MinimaxPronunciationDict {
  tone: string[];
}

export interface MinimaxVoiceModify {
  pitch: number;
  intensity: number;
  timbre: number;
  sound_effects?: MinimaxSoundEffect | null;
}

export interface MinimaxAudioSettingOptions {
  sample_rate: number;
  bitrate: number;
  format: string;
  channel: number;
  force_cbr: boolean;
}

export interface MinimaxVoiceSettingOptions {
  speed: number;
  vol: number;
  pitch: number;
  emotion?: MinimaxEmotion | null;
  english_normalization: boolean;
  text_normalization: boolean;
  latex_read: boolean;
}

export interface MinimaxStreamOptions {
  exclude_aggregated_audio: boolean;
}

export interface MinimaxSynthesisOptions {
  voice: MinimaxVoiceSettingOptions;
  audio: MinimaxAudioSettingOptions;
  voice_modify?: MinimaxVoiceModify | null;
  pronunciation_dict?: MinimaxPronunciationDict | null;
  timbre_weights: MinimaxTimbreWeight[];
  language?: string | null;
  subtitle_enable: boolean;
  subtitle_type: MinimaxSubtitleType;
  continuous_sound: boolean;
  output_format: MinimaxOutputFormat;
  transport: MinimaxTransport;
  http_region: MinimaxHttpRegion;
  stream: boolean;
  stream_options: MinimaxStreamOptions;
  text_file_id?: number | null;
}

export interface MinimaxCloneOptions {
  need_noise_reduction: boolean;
  need_volume_normalization: boolean;
  language?: string | null;
}

export interface MinimaxProviderSettings {
  default_synthesis: MinimaxSynthesisOptions;
}

export function defaultMinimaxSynthesisOptions(): MinimaxSynthesisOptions {
  return {
    voice: {
      speed: 1,
      vol: 1,
      pitch: 0,
      emotion: null,
      english_normalization: false,
      text_normalization: false,
      latex_read: false,
    },
    audio: {
      sample_rate: 32000,
      bitrate: 128000,
      format: "mp3",
      channel: 1,
      force_cbr: false,
    },
    voice_modify: null,
    pronunciation_dict: null,
    timbre_weights: [],
    language: "pl",
    subtitle_enable: true,
    subtitle_type: "word",
    continuous_sound: false,
    output_format: "hex",
    transport: "websocket",
    http_region: "default",
    stream: false,
    stream_options: { exclude_aggregated_audio: false },
    text_file_id: null,
  };
}

export function defaultMinimaxCloneOptions(): MinimaxCloneOptions {
  return {
    need_noise_reduction: false,
    need_volume_normalization: false,
    language: null,
  };
}
