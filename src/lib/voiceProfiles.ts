import { getAppSettings, setAppSettings } from "../api/tauri";
import { appSettingsViewToPayload, type TtsVoiceProfile } from "../appSettings";
import type { SettingsState } from "../components/Settings";
import { defaultMinimaxSynthesisOptions } from "./minimaxOptions";
import { inferGenerationProvider } from "./avatars";
import { VOICE_PROFILES_CHANGED } from "./voiceProfilesEvents";
import type { Generation, SpeakerConfig, TtsProvider } from "../types";

const DEFAULT_SPEAKERS: SpeakerConfig[] = [
  { speaker: "Mowca1", voice: "Kore" },
  { speaker: "Mowca2", voice: "Puck" },
];

export function effectiveVoiceId(state: SettingsState): string {
  if (state.provider === "voicebox") {
    return state.voiceboxProfileId.trim() || state.voice.trim();
  }
  return state.voice.trim();
}

export function settingsStateToVoiceProfile(
  state: SettingsState,
  name: string,
  existingId?: string,
  shortcutOpts?: { shortcut?: string | null; shortcut_enabled?: boolean },
): TtsVoiceProfile {
  const shortcut = shortcutOpts?.shortcut?.trim() ?? "";
  return {
    id: existingId ?? crypto.randomUUID(),
    name: name.trim() || "Profil głosu",
    provider: state.provider,
    model: state.model,
    voice: state.voice,
    style: state.style.trim() ? state.style : null,
    profile_id:
      state.provider === "voicebox"
        ? state.voiceboxProfileId.trim() || state.voice || null
        : null,
    language:
      state.provider === "voicebox" || state.provider === "minimax"
        ? state.language || null
        : null,
    engine: null,
    minimax_speed: state.provider === "minimax" ? state.minimaxSpeed : null,
    minimax_vol: state.provider === "minimax" ? state.minimaxVol : null,
    minimax_pitch: state.provider === "minimax" ? state.minimaxPitch : null,
    minimax_options: state.provider === "minimax" ? state.minimaxOptions : null,
    multi_speaker: state.provider === "google" && state.multiSpeaker,
    speakers:
      state.provider === "google" && state.multiSpeaker
        ? state.speakers.map((s) => ({ speaker: s.speaker, voice: s.voice }))
        : [],
    shortcut: shortcut || null,
    shortcut_enabled: shortcutOpts?.shortcut_enabled ?? !!shortcut,
  };
}

export function voiceProfileToSettingsState(profile: TtsVoiceProfile): SettingsState {
  const speakers: SpeakerConfig[] =
    profile.speakers.length > 0
      ? profile.speakers.map((s) => ({ speaker: s.speaker, voice: s.voice }))
      : DEFAULT_SPEAKERS;

  return {
    provider: (profile.provider as TtsProvider) || "google",
    model: profile.model,
    voice: profile.voice,
    voiceboxProfileId: profile.profile_id ?? "",
    language: profile.language ?? "pl",
    style: profile.style ?? "",
    multiSpeaker: profile.multi_speaker,
    speakers,
    minimaxSpeed: profile.minimax_speed ?? 1,
    minimaxVol: profile.minimax_vol ?? 1,
    minimaxPitch: profile.minimax_pitch ?? 0,
    minimaxOptions: profile.minimax_options
      ? {
          ...defaultMinimaxSynthesisOptions(),
          ...profile.minimax_options,
          voice: {
            ...defaultMinimaxSynthesisOptions().voice,
            ...(profile.minimax_options.voice ?? {}),
          },
          audio: {
            ...defaultMinimaxSynthesisOptions().audio,
            ...(profile.minimax_options.audio ?? {}),
          },
        }
      : defaultMinimaxSynthesisOptions(),
  };
}

export function resolveVoiceProfile(
  profiles: TtsVoiceProfile[],
  voiceProfileId: string | null | undefined,
): TtsVoiceProfile | null {
  if (!voiceProfileId?.trim()) return null;
  return profiles.find((p) => p.id === voiceProfileId) ?? null;
}

export function resolveTtsFromVoiceProfileId(
  profiles: TtsVoiceProfile[],
  voiceProfileId: string | null | undefined,
  inline: SettingsState,
): SettingsState {
  const found = resolveVoiceProfile(profiles, voiceProfileId);
  return found ? voiceProfileToSettingsState(found) : inline;
}

export function profileVoiceId(profile: TtsVoiceProfile): string {
  if (profile.provider === "voicebox") {
    return (profile.profile_id ?? profile.voice).trim();
  }
  return profile.voice.trim();
}

export function profileMatchesSettings(
  profile: TtsVoiceProfile,
  state: SettingsState,
): boolean {
  if (profile.provider !== state.provider || profile.model !== state.model) {
    return false;
  }
  if (profile.provider === "voicebox") {
    const pid = state.voiceboxProfileId.trim() || state.voice.trim();
    const saved = (profile.profile_id ?? profile.voice).trim();
    return pid === saved;
  }
  return profile.voice.trim() === state.voice.trim();
}

export function generationMatchesProfile(
  gen: Generation,
  profile: TtsVoiceProfile,
): boolean {
  const provider = (gen.provider ?? inferGenerationProvider(gen)) as string;
  if (provider !== profile.provider || gen.model !== profile.model) {
    return false;
  }
  if (profile.provider === "voicebox") {
    const saved = (profile.profile_id ?? profile.voice).trim();
    const gv = gen.voice.trim();
    return gv === saved || gv === profile.voice.trim();
  }
  return gen.voice.trim() === profile.voice.trim();
}

/**
 * Resolve a Generation to the TtsVoiceProfile that produced it.
 *
 * 1. If `gen.voice_profile_id` is set, look it up by id (the snapshot is
 *    authoritative — survives profile renames and deletions).
 * 2. Otherwise fuzzy-match on (provider, model, voice) so legacy rows
 *    (created before the column existed) still resolve correctly.
 *
 * Returns `null` when no profile can be resolved; callers should then
 * fall back to displaying the raw `gen.voice` string.
 */
export function resolveProfileForGeneration(
  gen: Generation,
  profiles: TtsVoiceProfile[],
): TtsVoiceProfile | null {
  if (gen.voice_profile_id) {
    const hit = profiles.find((p) => p.id === gen.voice_profile_id);
    if (hit) return hit;
  }
  return profiles.find((p) => generationMatchesProfile(gen, p)) ?? null;
}

export function oneLinePreview(text: string, maxLen = 72): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (!line) return "";
  if (line.length <= maxLen) return line;
  return `${line.slice(0, maxLen - 1)}…`;
}

export function previewTextForProfile(
  profile: TtsVoiceProfile,
  recentGenerations: Generation[],
): string {
  if (profile.last_preview?.trim()) {
    return profile.last_preview.trim();
  }
  const sorted = [...recentGenerations].sort((a, b) => b.created_at - a.created_at);
  for (const gen of sorted) {
    if (gen.status !== "done") continue;
    if (!generationMatchesProfile(gen, profile)) continue;
    const raw = gen.summary_text?.trim() || gen.text?.trim() || "";
    const snippet = oneLinePreview(raw);
    if (snippet) return snippet;
  }
  return "";
}

export function sortProfilesForChatList(profiles: TtsVoiceProfile[]): TtsVoiceProfile[] {
  return [...profiles].sort((a, b) => {
    const ta = a.last_preview_at ?? 0;
    const tb = b.last_preview_at ?? 0;
    if (tb !== ta) return tb - ta;
    return a.name.localeCompare(b.name, "pl");
  });
}

export async function setRerouteVoiceProfile(profileId: string | null): Promise<void> {
  const view = await getAppSettings();
  await setAppSettings(
    appSettingsViewToPayload({
      ...view,
      reroute_voice_profile_id: profileId,
    }),
  );
  window.dispatchEvent(new Event(VOICE_PROFILES_CHANGED));
}

export function isRerouteProfile(
  profileId: string,
  rerouteVoiceProfileId: string | null | undefined,
): boolean {
  return !!rerouteVoiceProfileId?.trim() && rerouteVoiceProfileId === profileId;
}

export async function deleteVoiceProfile(profileId: string): Promise<TtsVoiceProfile[]> {
  const view = await getAppSettings();
  const profiles = view.voice_profiles ?? [];
  const next = profiles.filter((p) => p.id !== profileId);
  if (next.length === profiles.length) return next;

  const rerouteId =
    view.reroute_voice_profile_id === profileId ? null : (view.reroute_voice_profile_id ?? null);
  const { persistVoiceProfilesWithHotkeySync } = await import("./voiceProfileShortcuts");
  await persistVoiceProfilesWithHotkeySync(
    {
      ...view,
      reroute_voice_profile_id: rerouteId,
    },
    next,
  );
  return next;
}

export async function touchVoiceProfilePreviews(
  tts: SettingsState,
  text: string,
  explicitProfileId?: string | null,
): Promise<void> {
  const snippet = oneLinePreview(text);
  if (!snippet) return;

  const view = await getAppSettings();
  const profiles = view.voice_profiles ?? [];
  if (profiles.length === 0) return;

  const now = Date.now();
  let changed = false;
  const next = profiles.map((p) => {
    const hit =
      (explicitProfileId && p.id === explicitProfileId) ||
      (!explicitProfileId && profileMatchesSettings(p, tts));
    if (!hit) return p;
    changed = true;
    return { ...p, last_preview: snippet, last_preview_at: now };
  });

  if (!changed) return;

  await setAppSettings(
    appSettingsViewToPayload({
      ...view,
      voice_profiles: next,
    }),
  );
  window.dispatchEvent(new Event(VOICE_PROFILES_CHANGED));
}
