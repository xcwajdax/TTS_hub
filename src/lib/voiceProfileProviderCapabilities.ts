import type { TtsProvider } from "../types";

export type FieldAvailability = "implemented" | "disabled" | "roadmap";

export interface CapabilityFieldDef {
  key: string;
  label: string;
  tooltip: string;
  defaultHint?: string;
  mode: "basic" | "advanced";
  availability: FieldAvailability;
  disabledReason?: string;
}

const VOICE_BOX_DISABLED: CapabilityFieldDef[] = [
  {
    key: "vb_seed",
    label: "Seed",
    tooltip: "Stały seed losowości syntezy Voice Box.",
    defaultHint: "losowy",
    mode: "advanced",
    availability: "disabled",
    disabledReason: "Klient TTS Hub nie przekazuje seed do serwera Voice Box.",
  },
  {
    key: "vb_model_size",
    label: "Rozmiar modelu",
    tooltip: "Wariant wag modelu (np. 1.7B, 0.6B).",
    defaultHint: "1.7B",
    mode: "advanced",
    availability: "disabled",
    disabledReason: "Niedostępne w kliencie TTS Hub.",
  },
  {
    key: "vb_max_chunk_chars",
    label: "Max znaków na chunk",
    tooltip: "Dzielenie długiego tekstu na fragmenty.",
    defaultHint: "800",
    mode: "advanced",
    availability: "disabled",
    disabledReason: "Niedostępne w kliencie TTS Hub.",
  },
  {
    key: "vb_crossfade_ms",
    label: "Crossfade (ms)",
    tooltip: "Płynne łączenie chunków audio.",
    defaultHint: "50",
    mode: "advanced",
    availability: "disabled",
    disabledReason: "Niedostępne w kliencie TTS Hub.",
  },
  {
    key: "vb_normalize",
    label: "Normalizacja głośności",
    tooltip: "Wyrównanie poziomu wyjściowego.",
    defaultHint: "włączone",
    mode: "advanced",
    availability: "disabled",
    disabledReason: "Niedostępne w kliencie TTS Hub.",
  },
  {
    key: "vb_effects_chain",
    label: "Łańcuch efektów",
    tooltip: "Efekty post-processingu na profilu Voice Box.",
    mode: "advanced",
    availability: "roadmap",
    disabledReason: "Planowany rozszerzony edytor efektów dźwiękowych.",
  },
];

const MINIMAX_ROADMAP: CapabilityFieldDef[] = [
  {
    key: "mm_voice_modify_2d",
    label: "2D placement (pitch / intensity / timbre)",
    tooltip: "Sterowanie parametrami voice_modify na płaszczyźnie XY.",
    mode: "advanced",
    availability: "roadmap",
    disabledReason: "Planowany interfejs 2D w kolejnej wersji.",
  },
  {
    key: "mm_sound_effects_studio",
    label: "Studio efektów dźwiękowych",
    tooltip: "Rozszerzony kreator efektów poza prostym wyborem presetu.",
    mode: "advanced",
    availability: "roadmap",
    disabledReason: "Planowany edytor łańcucha efektów.",
  },
];

const GOOGLE_FIELDS: CapabilityFieldDef[] = [];

const MINIMAX_FIELDS: CapabilityFieldDef[] = [...MINIMAX_ROADMAP];

const VOICE_BOX_FIELDS: CapabilityFieldDef[] = [...VOICE_BOX_DISABLED];

export function capabilityFieldsForProvider(provider: TtsProvider): CapabilityFieldDef[] {
  switch (provider) {
    case "google":
      return GOOGLE_FIELDS;
    case "minimax":
      return MINIMAX_FIELDS;
    case "voicebox":
      return VOICE_BOX_FIELDS;
    default:
      return [];
  }
}

export function visibleCapabilityFields(
  provider: TtsProvider,
  advancedMode: boolean,
): CapabilityFieldDef[] {
  return capabilityFieldsForProvider(provider).filter(
    (f) => f.availability !== "implemented" && (advancedMode || f.mode === "basic"),
  );
}
