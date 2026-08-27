/**
 * @file TTS Hub overview canvas — roadmap + canvas index
 */

export const UPDATED_AT = "2026-08-27";

export const ROADMAP = [
  { topic: "Panel Profile Głosu", status: "done", source: "voice-profiles-panel.plan.md" },
  {
    topic: "MiniMax voice_modify XY pad + studio sound_effects",
    status: "done",
    source: "voice-profiles-advanced-editor.canvas.tsx",
  },
  {
    topic: "Voice Box seed / chunking / normalize w kliencie Rust",
    status: "done",
    source: "voice-profiles-advanced-editor.canvas.tsx",
  },
  {
    topic: "Voice Box effects_chain (pedalboard)",
    status: "planned",
    source: "voice-profiles-panel.plan.md §8",
  },
  { topic: "Node Audio Routing", status: "planned", source: "node-audio-routing.plan.md" },
  { topic: "VS Code / Cursor extension", status: "planned", source: "vscode-cursor-extension.plan.md" },
];

export const CANVAS_INDEX = [
  {
    topic: "Edytor zaawansowany profili głosu",
    file: "voice-profiles-advanced-editor.canvas.tsx",
    blurb: "Pad XY MiniMax, studio presetów sound_effects, voicebox_options w generate.",
  },
];
