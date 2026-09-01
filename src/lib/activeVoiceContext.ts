import type { TtsVoiceProfile } from "../appSettings";
import type { SettingsState } from "../components/Settings";
import type { IconSlug } from "./icons";
import { MINIMAX_LANGUAGE_CATALOG } from "./minimaxLanguages";
import { PROVIDER_TABS } from "./providerSwitch";
import {
  resolvePlaybackPreviewMode,
  type PlaybackPreviewMode,
} from "./playbackPreviewRegistry";
import type { TextFilterPreset } from "./textFiltersTypes";
import { formatModelLabel } from "../ttsModels";
import type { TtsProvider } from "../types";
import { effectiveVoiceId } from "./voiceProfiles";

export interface ContextChip {
  label: string;
  title?: string;
}

export interface ContextCardRow {
  label: string;
  value: string;
  muted?: boolean;
}

export interface ActiveVoiceContext {
  profileName: string;
  providerLabel: string;
  providerIcon: IconSlug;
  provider: TtsProvider;
  barMetaLine: string;
  barChips: ContextChip[];
  cardRows: ContextCardRow[];
  filterPreviewMode: PlaybackPreviewMode;
  filterPreviewLabel: string;
}

export const PLAYBACK_PREVIEW_LABELS: Record<PlaybackPreviewMode, string> = {
  "karaoke-scroll": "Karaoke",
  "step-guide": "Kroki",
  "compact-title": "Brief",
};

function formatLanguage(code: string | null | undefined): string {
  if (!code?.trim()) return "—";
  const found = MINIMAX_LANGUAGE_CATALOG.find((l) => l.code === code);
  return found ? `${found.display_name} (${code})` : code;
}

function formatSpeedChip(speed: number): string {
  return speed % 1 === 0 ? `×${speed}` : `×${speed.toFixed(1)}`;
}

function voiceDisplayForSettings(ttsSettings: SettingsState): string {
  if (ttsSettings.provider === "voicebox") {
    return (
      ttsSettings.voiceboxProfileId.trim() ||
      ttsSettings.voice.trim() ||
      effectiveVoiceId(ttsSettings) ||
      "—"
    );
  }
  return ttsSettings.voice.trim() || effectiveVoiceId(ttsSettings) || "—";
}

export function buildActiveVoiceContext(
  ttsSettings: SettingsState,
  activeProfile: TtsVoiceProfile | null,
  activePreset: TextFilterPreset | null | undefined,
): ActiveVoiceContext {
  const provider = ttsSettings.provider;
  const providerTab = PROVIDER_TABS.find((t) => t.id === provider);
  const providerLabel = providerTab?.label ?? provider;
  const providerIcon = providerTab?.icon ?? "info";

  const profileName = activeProfile?.name ?? "Własne ustawienia";
  const modelLabel = formatModelLabel(ttsSettings.model);
  const voiceDisplay = voiceDisplayForSettings(ttsSettings);

  const barMetaLine = `${providerLabel} · ${modelLabel} · ${voiceDisplay}`;

  const barChips: ContextChip[] = [];
  const cardRows: ContextCardRow[] = [
    { label: "Profil", value: profileName },
    { label: "Provider", value: providerLabel },
    { label: "Model", value: `${modelLabel} (${ttsSettings.model})` },
    { label: "Głos", value: voiceDisplay },
  ];

  if (provider === "minimax") {
    const speed = ttsSettings.minimaxSpeed;
    const emotion = ttsSettings.minimaxOptions?.voice?.emotion;
    const lang = ttsSettings.language;

    if (speed !== 1) {
      barChips.push({ label: formatSpeedChip(speed), title: `Tempo: ${speed}` });
    }
    if (emotion) {
      barChips.push({ label: emotion, title: `Emocja: ${emotion}` });
    }
    if (lang?.trim()) {
      barChips.push({ label: lang, title: formatLanguage(lang) });
    }

    cardRows.push({ label: "Język", value: formatLanguage(lang) });
    cardRows.push({ label: "Tempo", value: String(speed) });
    cardRows.push({ label: "Pitch", value: String(ttsSettings.minimaxPitch) });
    cardRows.push({ label: "Głośność", value: String(ttsSettings.minimaxVol) });
    cardRows.push({ label: "Emocja", value: emotion ?? "Auto" });
  } else if (provider === "voicebox") {
    if (ttsSettings.language?.trim()) {
      barChips.push({
        label: ttsSettings.language,
        title: formatLanguage(ttsSettings.language),
      });
    }
    cardRows.push({ label: "Język", value: formatLanguage(ttsSettings.language) });
    cardRows.push({
      label: "Personality",
      value: ttsSettings.voiceboxPersonalityEnabled ? "Włączone" : "Wyłączone",
    });
    cardRows.push({
      label: "Tempo / emocja",
      value: "Niedostępne u Voice Box",
      muted: true,
    });
  } else {
    if (ttsSettings.style?.trim()) {
      cardRows.push({ label: "Styl", value: ttsSettings.style.trim() });
    }
    if (ttsSettings.multiSpeaker && ttsSettings.speakers.length > 0) {
      cardRows.push({
        label: "Multi-speaker",
        value: ttsSettings.speakers.map((s) => `${s.speaker}: ${s.voice}`).join(", "),
      });
    }
    cardRows.push({
      label: "Tempo / emocja",
      value: "Niedostępne u Google Gemini",
      muted: true,
    });
  }

  const filterPreviewMode = resolvePlaybackPreviewMode(activePreset, activeProfile);
  const filterPreviewLabel = PLAYBACK_PREVIEW_LABELS[filterPreviewMode];

  if (activePreset) {
    const enabledRules = activePreset.custom.filter((c) => c.enabled).length;
    cardRows.push({ label: "Filtr", value: activePreset.name });
    cardRows.push({ label: "Reguły własne", value: String(enabledRules) });
    cardRows.push({ label: "Tryb podglądu", value: filterPreviewLabel });
  }

  return {
    profileName,
    providerLabel,
    providerIcon,
    provider,
    barMetaLine,
    barChips,
    cardRows,
    filterPreviewMode,
    filterPreviewLabel,
  };
}
