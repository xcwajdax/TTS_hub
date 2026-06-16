import type { QuickHotkeyPreset, TtsVoiceProfile } from "../appSettings";
import type { SettingsState } from "../components/Settings";
import {
  applyVoiceProfileToSlot,
} from "./editorQuickGen";
import { resolveTtsFromVoiceProfileId } from "./voiceProfiles";
import type { EditorQuickGenSlot } from "../appSettings";
import type { TtsProvider } from "../types";
import { defaultMinimaxSynthesisOptions } from "./minimaxOptions";

const DEFAULT_SPEAKERS = [
  { speaker: "Mowca1", voice: "Kore" },
  { speaker: "Mowca2", voice: "Puck" },
];

/** Krótkie propozycje — jeden klawisz F lub Ctrl+Alt+N */
export const SHORTCUT_QUICK_PICKS: string[] = [
  "F9",
  "F10",
  "F11",
  "F12",
  "Ctrl+Alt+1",
  "Ctrl+Alt+2",
  "Ctrl+Alt+3",
  "Ctrl+Alt+4",
  "Ctrl+Alt+5",
  "Alt+Shift+T",
  "Alt+Shift+Y",
];

function presetInlineSettingsState(preset: QuickHotkeyPreset): SettingsState {
  return {
    provider: (preset.provider as TtsProvider) || "google",
    model: preset.model,
    voice: preset.voice,
    voiceboxProfileId: preset.profile_id ?? "",
    language: preset.language ?? "pl",
    style: preset.style ?? "",
    voiceboxPersonalityEnabled: false,
    multiSpeaker: false,
    speakers: DEFAULT_SPEAKERS,
    minimaxSpeed: preset.minimax_speed ?? 1,
    minimaxVol: preset.minimax_vol ?? 1,
    minimaxPitch: preset.minimax_pitch ?? 0,
    minimaxOptions: preset.minimax_options
      ? { ...defaultMinimaxSynthesisOptions(), ...preset.minimax_options }
      : defaultMinimaxSynthesisOptions(),
  };
}

export function presetToSettingsState(
  preset: QuickHotkeyPreset,
  voiceProfiles: TtsVoiceProfile[] = [],
): SettingsState {
  return resolveTtsFromVoiceProfileId(
    voiceProfiles,
    preset.voice_profile_id,
    presetInlineSettingsState(preset),
  );
}

export function applyVoiceProfileToPreset(
  preset: QuickHotkeyPreset,
  profile: import("../appSettings").TtsVoiceProfile,
): QuickHotkeyPreset {
  const slot: EditorQuickGenSlot = {
    label: preset.name,
    provider: preset.provider,
    model: preset.model,
    voice: preset.voice,
    style: preset.style,
    profile_id: preset.profile_id,
    language: preset.language,
    engine: preset.engine,
    minimax_speed: preset.minimax_speed,
    minimax_vol: preset.minimax_vol,
    minimax_pitch: preset.minimax_pitch,
    filter_preset_id: preset.filter_preset_id,
    format: preset.format,
    voice_profile_id: preset.voice_profile_id,
  };
  const next = applyVoiceProfileToSlot(slot, profile);
  return {
    ...preset,
    voice_profile_id: next.voice_profile_id,
    provider: next.provider,
    model: next.model,
    voice: next.voice,
    style: next.style,
    profile_id: next.profile_id,
    language: next.language,
    minimax_speed: next.minimax_speed,
    minimax_vol: next.minimax_vol,
    minimax_pitch: next.minimax_pitch,
  };
}

export function settingsStateToPreset(state: SettingsState, preset: QuickHotkeyPreset): QuickHotkeyPreset {
  return {
    ...preset,
    provider: state.provider,
    model: state.model,
    voice: state.voice,
    style: state.style.trim() ? state.style : null,
    profile_id: state.provider === "voicebox" ? state.voiceboxProfileId || null : null,
    language:
      state.provider === "voicebox" || state.provider === "minimax"
        ? state.language || null
        : null,
    engine: preset.engine,
    minimax_speed: state.provider === "minimax" ? state.minimaxSpeed : null,
    minimax_vol: state.provider === "minimax" ? state.minimaxVol : null,
    minimax_pitch: state.provider === "minimax" ? state.minimaxPitch : null,
  };
}

const MODIFIER_LABELS: Record<string, string> = {
  Ctrl: "Ctrl",
  Control: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
  Super: "Win",
  Meta: "Win",
  Command: "Win",
};

export function shortcutKeyParts(shortcut: string): string[] {
  if (!shortcut.trim()) return [];
  return shortcut.split("+").map((p) => p.trim()).filter(Boolean);
}

export function shortcutDisplayLabel(shortcut: string): string {
  return shortcutKeyParts(shortcut)
    .map((p) => MODIFIER_LABELS[p] ?? p)
    .join(" + ");
}

/** Normalizuje wpisany ręcznie skrót do formatu pluginu (Ctrl+Alt+1). */
export function parseShortcutString(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed
    .split(/[+,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(normalizeShortcutPart);
  if (parts.length === 0) return null;
  const joined = parts.join("+");
  return validateShortcut(joined) ? joined : null;
}

function normalizeShortcutPart(part: string): string {
  const lower = part.toLowerCase();
  if (lower === "control" || lower === "ctrl") return "Ctrl";
  if (lower === "alt" || lower === "option") return "Alt";
  if (lower === "shift") return "Shift";
  if (lower === "meta" || lower === "cmd" || lower === "command" || lower === "super" || lower === "win") {
    return "Super";
  }
  if (lower === "space") return "Space";
  if (lower === "enter" || lower === "return") return "Enter";
  if (lower === "esc" || lower === "escape") return "Escape";
  if (lower === "tab") return "Tab";
  if (/^f\d{1,2}$/.test(lower)) return lower.toUpperCase();
  if (part.length === 1) return part.toUpperCase();
  if (part.startsWith("Arrow")) return part.replace("Arrow", "");
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function isStandaloneShortcutKey(keyPart: string): boolean {
  return /^F\d{1,2}$/i.test(keyPart) || ["Space", "Enter", "Tab", "Escape"].includes(keyPart);
}

/** Wymaga co najmniej jednego modyfikatora dla liter/cyfr; F9–F12 mogą być same. */
export function validateShortcut(shortcut: string): boolean {
  const parts = shortcutKeyParts(shortcut);
  if (parts.length === 0) return false;
  const last = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);
  if (isStandaloneShortcutKey(last)) return true;
  const hasModifier = modifiers.some((m) => ["Ctrl", "Alt", "Shift", "Super"].includes(m));
  return hasModifier && last.length > 0;
}

export function formatShortcutFromKeyboardEvent(e: KeyboardEvent): string | null {
  if (e.key === "Escape") return null;
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return null;

  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Super");

  let keyPart = e.key;
  if (keyPart.length === 1) keyPart = keyPart.toUpperCase();
  else if (keyPart.startsWith("Arrow")) keyPart = keyPart.replace("Arrow", "");
  else if (keyPart === " ") keyPart = "Space";
  else if (keyPart === "Enter") keyPart = "Enter";
  else if (keyPart.startsWith("F") && keyPart.length <= 3) keyPart = keyPart.toUpperCase();
  else if (!isStandaloneShortcutKey(keyPart) && parts.length === 0) return null;

  parts.push(keyPart);
  const joined = parts.join("+");
  return validateShortcut(joined) ? joined : null;
}

/** Skraca legacy Ctrl+Shift+Alt+N → Ctrl+Alt+N */
export function migrateLegacyShortcut(shortcut: string): string {
  const prefix = "Ctrl+Shift+Alt+";
  if (shortcut.startsWith(prefix)) {
    return `Ctrl+Alt+${shortcut.slice(prefix.length)}`;
  }
  return shortcut;
}

export function suggestShortcutForSlot(slotIndex: number, used: Set<string>): string {
  const candidates = [
    ...SHORTCUT_QUICK_PICKS,
    ...Array.from({ length: 9 }, (_, i) => `Ctrl+Alt+${i + 1}`),
    ...Array.from({ length: 8 }, (_, i) => `F${i + 9}`),
  ];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[(slotIndex + i) % candidates.length];
    const key = c.toLowerCase();
    if (!used.has(key)) return c;
  }
  return `Ctrl+Alt+${(slotIndex % 9) + 1}`;
}

export function findShortcutConflict(
  shortcut: string,
  presets: QuickHotkeyPreset[],
  excludeId?: string,
): QuickHotkeyPreset | null {
  const key = shortcut.trim().toLowerCase();
  if (!key) return null;
  return (
    presets.find((p) => p.id !== excludeId && p.enabled && p.shortcut.trim().toLowerCase() === key) ?? null
  );
}
