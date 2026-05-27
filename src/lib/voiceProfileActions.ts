/** Uruchom generację TTS z zapisanym profilem głosu (tekst z edytora). */
export const VOICE_PROFILE_GENERATE_EVENT = "tts-hub:voice-profile-generate";

export interface VoiceProfileGenerateDetail {
  profileId: string;
}

export function requestGenerateWithVoiceProfile(profileId: string): void {
  window.dispatchEvent(
    new CustomEvent<VoiceProfileGenerateDetail>(VOICE_PROFILE_GENERATE_EVENT, {
      detail: { profileId },
    }),
  );
}
