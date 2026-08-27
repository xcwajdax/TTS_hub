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
    key: "vb_effects_chain",
    label: "Łańcuch efektów Voice Box",
    tooltip: "Pedalboard post-processingu na profilu Voice Box (`effects_chain`).",
    mode: "advanced",
    availability: "disabled",
    disabledReason:
      "Klient TTS Hub nie wysyła `effects_chain` — to osobny łańcuch DSP (reverb, delay, chorus…) na serwerze Voice Box, inny niż presety MiniMax. Podłączenie wymagałoby edytora pedalboardu i nowego kontraktu generate.",
  },
];

const GOOGLE_FIELDS: CapabilityFieldDef[] = [];

const MINIMAX_FIELDS: CapabilityFieldDef[] = [];

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
