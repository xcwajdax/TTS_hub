/**
 * @file Voice Profiles — advanced MiniMax / Voice Box editor
 * Canvas documentation for the XY pad, MiniMax sound-effects studio,
 * and Voice Box generate options wired through the Rust client.
 */

export const TITLE = "Profile głosu — edytor zaawansowany";
export const UPDATED_AT = "2026-08-27";
export const STATUS = "done";

export const CONTEXT = `
Pad XY i studio efektów MiniMax w zakładce Profile Głosu (tryb zaawansowany).
Pola Voice Box seed / chunking / normalize idą do /generate. effects_chain zostaje odłączony.
`;

export const CHANGED_FILES = [
  "src/components/MinimaxAdvancedOptions.tsx",
  "src/components/voiceProfiles/fields/VoiceModifyXyPad.tsx",
  "src/components/voiceProfiles/fields/MinimaxSoundEffectsStudio.tsx",
  "src/components/voiceProfiles/fields/VoiceBoxAdvancedFields.tsx",
  "src/lib/minimaxVoiceModify.ts",
  "src/lib/voiceboxOptions.ts",
  "src/lib/voiceProfileProviderCapabilities.ts",
  "src-tauri/src/voicebox.rs",
  "src-tauri/src/job_queue.rs",
  "src-tauri/src/voice_profiles.rs",
];

export const PAD_MAPPING = {
  x: "pitch (głębiej −100 ↔ jaśniej +100)",
  y: "intensity, inverted visually (góra = mocniej = API −100)",
  slider: "timbre (pełniej −100 ↔ ostrzej +100)",
};

export const VERIFICATION = [
  "npm test",
  "npm run build",
  "cargo test -p tts-hub --lib voice_profiles voicebox",
  "npm run dev:mock → Profile Głosu → MiniMax → Zaawansowany → pad + studio",
];
