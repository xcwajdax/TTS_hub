import type { CursorIntegration } from "../appSettings";
import type { SettingsState } from "../components/Settings";
import type { AudioFormat, GenerateRequest, TtsProvider } from "../types";

export function cursorToSettingsState(cfg: CursorIntegration): SettingsState {
  return {
    provider: (cfg.provider as TtsProvider) || "minimax",
    model: cfg.model,
    voice: cfg.voice,
    voiceboxProfileId: cfg.profile_id ?? cfg.voice ?? "",
    language: cfg.language ?? "pl",
    style: cfg.style ?? "",
    multiSpeaker: false,
    speakers: [
      { speaker: "Mowca1", voice: "Kore" },
      { speaker: "Mowca2", voice: "Puck" },
    ],
    minimaxSpeed: cfg.minimax_speed ?? 1,
    minimaxVol: cfg.minimax_vol ?? 1,
    minimaxPitch: cfg.minimax_pitch ?? 0,
  };
}

export function settingsStateToCursor(
  state: SettingsState,
  cfg: CursorIntegration,
): CursorIntegration {
  const defaultFormat = state.provider === "minimax" ? "mp3" : "wav";
  const format =
    cfg.format === "mp3" || cfg.format === "wav" || cfg.format === "ogg" ? cfg.format : defaultFormat;
  return {
    ...cfg,
    provider: state.provider,
    model: state.model,
    voice: state.voice,
    style: state.style.trim() ? state.style : null,
    format,
    profile_id: state.provider === "voicebox" ? state.voiceboxProfileId || state.voice || null : null,
    language:
      state.provider === "voicebox" || state.provider === "minimax"
        ? state.language || null
        : null,
    engine: cfg.engine,
    minimax_speed: state.provider === "minimax" ? state.minimaxSpeed : null,
    minimax_vol: state.provider === "minimax" ? state.minimaxVol : null,
    minimax_pitch: state.provider === "minimax" ? state.minimaxPitch : null,
  };
}

export function cursorToGenerateRequest(
  cfg: CursorIntegration,
  summaryText: string,
  source: "cursor" | "cursor-skill",
  conversationId?: string | null,
): GenerateRequest {
  const format = (cfg.format ?? (cfg.provider === "minimax" ? "mp3" : "wav")) as AudioFormat;
  const req: GenerateRequest = {
    text: summaryText,
    summary_text: summaryText,
    model: cfg.model,
    voice: cfg.voice,
    style: cfg.style ?? null,
    format,
    provider: cfg.provider as TtsProvider,
    autoplay: cfg.autoplay,
    source,
    conversation_id: conversationId ?? null,
  };
  if (cfg.provider === "voicebox") {
    req.profile_id = cfg.profile_id ?? cfg.voice;
    req.language = cfg.language ?? "pl";
    req.engine = cfg.engine ?? null;
  }
  if (cfg.provider === "minimax") {
    req.language = cfg.language ?? "pl";
    req.minimax_speed = cfg.minimax_speed ?? 1;
    req.minimax_vol = cfg.minimax_vol ?? 1;
    req.minimax_pitch = cfg.minimax_pitch ?? 0;
  }
  return req;
}
