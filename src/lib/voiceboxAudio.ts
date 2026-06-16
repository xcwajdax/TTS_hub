import type { VoiceBoxAudioPayload } from "../api/tauri";

export function voiceboxPayloadToBlob(payload: VoiceBoxAudioPayload): Blob {
  const binary = atob(payload.bytes_base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const mime =
    payload.format === "mp3"
      ? "audio/mpeg"
      : payload.format === "ogg"
        ? "audio/ogg"
        : "audio/wav";
  return new Blob([bytes], { type: mime });
}

export function voiceboxPayloadToObjectUrl(payload: VoiceBoxAudioPayload): string {
  return URL.createObjectURL(voiceboxPayloadToBlob(payload));
}
