import {
  defaultCursorIntegration,
  defaultEditorQuickGenSettings,
  defaultQuickHotkeysSettings,
  defaultTextFiltersSettings,
  DEFAULT_MAX_CONCURRENT_JOBS,
  DEFAULT_QUICK_HISTORY_PAGE_SIZE,
  DEFAULT_TEMP_HISTORY_MAX,
  DEFAULT_TIMELINE_VIEW,
  type AppSettingsView,
  type TtsVoiceProfile,
} from "../../appSettings";
import type { VoiceBoxHealth, VoiceBoxHistoryItem, VoiceBoxProfile } from "../../api/tauri";
import type { MinimaxClonedVoice, MinimaxPresetVoice } from "../../api/tauri";
import type { ChatMessage, ChatSession } from "../../chat/types";
import { BUILTIN_PLUGIN_STUBS } from "../../plugins/registry";
import type { PluginManifest, SoundboardPublicView } from "../../plugins/types";
import type { RoleplayProject, RoleplayProjectSummary } from "../../roleplay/types";
import type { ArchiveFolder, ArchiveTag, Generation } from "../../types";
import type { VideoExportRecord } from "../../types/videoTemplate";

export const MOCK_SESSION_ID = "mock-session-001";

export const MOCK_EDITOR_TEXT = `Cześć! To przykładowy tekst w trybie podglądu mockup.

Możesz przeglądać historię, ustawienia i layout bez uruchomionego backendu Tauri. Generowanie TTS jest wyłączone — użyj npm run tauri dev dla pełnej aplikacji.`;

export const MOCK_VOICE_PROFILES: TtsVoiceProfile[] = [
  {
    id: "mock-vp-narracja",
    name: "Narracja PL",
    provider: "google",
    model: "gemini-2.5-flash-preview-tts",
    voice: "Kore",
    style: "Powiedz spokojnie po polsku:",
    profile_id: null,
    language: "pl",
    engine: null,
    multi_speaker: false,
    speakers: [],
    minimax_speed: null,
    minimax_vol: null,
    minimax_pitch: null,
    last_preview: "Witaj w TTS Hub — przykładowa narracja.",
    shortcut: "Ctrl+Alt+1",
    shortcut_enabled: true,
  },
  {
    id: "mock-vp-minimax",
    name: "MiniMax — Kasia",
    provider: "minimax",
    model: "speech-2.8-hd",
    voice: "Polish_female_1_sample1",
    style: null,
    profile_id: null,
    language: "pl",
    engine: null,
    multi_speaker: false,
    speakers: [],
    minimax_speed: 1,
    minimax_vol: 1,
    minimax_pitch: 0,
    last_preview: "Podsumowanie z Cursor — mockup.",
    shortcut: "Ctrl+Alt+2",
    shortcut_enabled: false,
  },
];

export const MOCK_GOOGLE_VOICES = ["Kore", "Charon", "Puck", "Aoede", "Fenrir"];

export const MOCK_VOICEBOX_PROFILES: VoiceBoxProfile[] = [
  {
    id: "mock-vb-profile",
    name: "Mój głos (mock)",
    description: "Przykładowy profil Voice Box",
    language: "pl",
    default_engine: "chatterbox",
    personality: null,
    generation_count: 12,
    sample_count: 3,
  },
];

const minutesAgo = (minutes: number) => Date.now() - minutes * 60_000;

function baseGeneration(partial: Partial<Generation> & Pick<Generation, "id" | "text" | "source">): Generation {
  const created = partial.created_at ?? minutesAgo(5);
  return {
    id: partial.id,
    created_at: created,
    text: partial.text,
    title: partial.title ?? null,
    model: partial.model ?? "gemini-2.5-flash-preview-tts",
    voice: partial.voice ?? "Kore",
    style: partial.style ?? "Powiedz spokojnie po polsku:",
    format: partial.format ?? "mp3",
    duration_ms: partial.duration_ms ?? 4200,
    file_path: partial.file_path ?? "mock://sample.wav",
    is_archived: partial.is_archived ?? false,
    session_id: partial.session_id ?? MOCK_SESSION_ID,
    source: partial.source,
    conversation_id: partial.conversation_id ?? null,
    summary_text: partial.summary_text ?? null,
    status: partial.status ?? "done",
    error: partial.error ?? null,
    attempts: partial.attempts ?? 1,
    updated_at: partial.updated_at ?? created,
    provider: partial.provider ?? "google",
    folder_id: partial.folder_id ?? null,
    tag_ids: partial.tag_ids ?? [],
    voice_profile_id: partial.voice_profile_id ?? null,
    origin_kind: partial.origin_kind ?? null,
  };
}

export const MOCK_FOLDERS: ArchiveFolder[] = [
  {
    id: "mock-folder-promo",
    name: "Promo",
    slug: "promo",
    color: "#f59e0b",
    sort_order: 0,
    created_at: minutesAgo(60 * 24),
  },
  {
    id: "mock-folder-cursor",
    name: "Cursor",
    slug: "cursor",
    color: "#38bdf8",
    sort_order: 1,
    created_at: minutesAgo(60 * 24),
  },
];

export const MOCK_TAGS: ArchiveTag[] = [
  {
    id: "mock-tag-demo",
    name: "demo",
    slug: "demo",
    color: "#a78bfa",
    sort_order: 0,
    created_at: minutesAgo(60 * 24),
  },
];

export const MOCK_SESSION: Generation[] = [
  baseGeneration({
    id: "mock-gen-editor",
    text: MOCK_EDITOR_TEXT.split("\n\n")[0] ?? MOCK_EDITOR_TEXT,
    title: "Przykład z edytora",
    source: "manual",
    created_at: minutesAgo(2),
    voice_profile_id: "mock-vp-narracja",
  }),
  baseGeneration({
    id: "mock-gen-hotkey",
    text: "Szybki skrót Ctrl+Alt+1 — przykładowa generacja.",
    title: "Skrót globalny",
    source: "quick_hotkey",
    created_at: minutesAgo(8),
    provider: "minimax",
    model: "speech-2.8-hd",
    voice: "Polish_female_1_sample1",
    voice_profile_id: "mock-vp-minimax",
  }),
];

export const MOCK_ARCHIVE: Generation[] = [
  baseGeneration({
    id: "mock-gen-archived",
    text: "Zarchiwizowany wpis z folderem Promo i tagiem demo.",
    title: "Archiwum — promo",
    source: "manual",
    is_archived: true,
    created_at: minutesAgo(60 * 26),
    folder_id: "mock-folder-promo",
    tag_ids: ["mock-tag-demo"],
  }),
];

export const MOCK_CURSOR_FEED: Generation[] = [
  baseGeneration({
    id: "mock-gen-cursor",
    text: "Podsumowanie asystenta Cursor — tryb mockup pokazuje ten wpis w feedzie Cursor.",
    title: "Cursor TTS",
    source: "cursor",
    created_at: minutesAgo(4),
    provider: "minimax",
    model: "speech-2.8-hd",
    voice: "Polish_female_1_sample1",
    summary_text: "Podsumowanie asystenta Cursor — tryb mockup.",
    voice_profile_id: "mock-vp-minimax",
  }),
];

export const MOCK_BOTS_FEED: Generation[] = [
  baseGeneration({
    id: "mock-gen-telegram",
    text: "Wiadomość z bota Telegram — przykładowa generacja TTS dla kanału powiadomień.",
    title: "Telegram — alert",
    source: "http",
    created_at: minutesAgo(12),
    provider: "google",
    voice: "Kore",
    origin_kind: "telegram",
    origin_platform_id: "telegram",
    origin_user_name: "Demo Bot",
    voice_profile_id: "mock-vp-narracja",
  }),
  baseGeneration({
    id: "mock-gen-webhook",
    text: "Webhook z zewnętrznego serwisu — placeholder w feedzie botów.",
    title: "Webhook demo",
    source: "http",
    created_at: minutesAgo(35),
    provider: "minimax",
    model: "speech-2.8-hd",
    voice: "Polish_male_1_sample4",
    origin_kind: "webhook",
    origin_platform_id: "webhook",
    voice_profile_id: "mock-vp-minimax",
  }),
];

export function getMockHistoryState() {
  return {
    session: MOCK_SESSION,
    archive: MOCK_ARCHIVE,
    cursorFeed: MOCK_CURSOR_FEED,
    botsFeed: MOCK_BOTS_FEED,
    folders: MOCK_FOLDERS,
    tags: MOCK_TAGS,
    interrupted: [] as Generation[],
    currentSessionId: MOCK_SESSION_ID,
  };
}

export function getMockAppSettingsView(): AppSettingsView {
  return {
    save_mode: "auto",
    save_format: "mp3",
    temp_path: null,
    archive_path: null,
    api_profiles: [{ id: "mock-api", name: "Google AI Studio (mock)", api_key: "" }],
    active_api_id: "mock-api",
    cursor_integration: { ...defaultCursorIntegration(), enabled: true },
    max_concurrent_jobs: DEFAULT_MAX_CONCURRENT_JOBS,
    active_skin_id: "vibelife",
    skin_registry_urls: [],
    text_filters: defaultTextFiltersSettings(),
    quick_hotkeys: defaultQuickHotkeysSettings(),
    editor_quick_gen: defaultEditorQuickGenSettings(),
    voice_profiles: MOCK_VOICE_PROFILES,
    quick_setup_completed: true,
    ui_tutorial_completed: true,
    enabled_providers: ["google", "minimax", "voicebox"],
    minimax_enabled_languages: ["pl", "en"],
    voicebox_base_url: "http://127.0.0.1:17493",
    voicebox_server_mode: "external",
    minimax_api_key: null,
    temp_history_max: DEFAULT_TEMP_HISTORY_MAX,
    quick_history_page_size: DEFAULT_QUICK_HISTORY_PAGE_SIZE,
    timeline_view: DEFAULT_TIMELINE_VIEW,
    safe_mode: false,
    privacy_mode: "normal",
    safe_mode_auto_open_queue: true,
    default_video_template_id: "builtin-whatsapp-karaoke",
    auto_archive_mp4_on_clipboard: true,
    effective_temp_path: "%APPDATA%\\TTS_hub\\temp (mock)",
    effective_archive_path: "%APPDATA%\\TTS_hub\\archive (mock)",
    env_api_key_available: false,
    env_minimax_api_key_available: false,
    effective_voicebox_url: "http://127.0.0.1:17493",
    env_voicebox_url: "",
    effective_minimax_configured: true,
  };
}

export const MOCK_PLUGINS: PluginManifest[] = BUILTIN_PLUGIN_STUBS.map((plugin) =>
  plugin.id === "soundboard" ? { ...plugin, installed: true, enabled: true } : plugin,
);

export function getMockSoundboardView(): SoundboardPublicView {
  return {
    enabled: true,
    slots: Array.from({ length: 8 }, (_, index) => ({
      index,
      label:
        index === 0
          ? "Intro mock"
          : index === 1
            ? "Cursor ping"
            : index === 2
              ? "Skrót hotkey"
              : `Slot ${index + 1}`,
      enabled: true,
      shortcut: `Ctrl+Shift+${index + 1}`,
      shortcutConflict: index === 7,
      hasAudio: index < 3,
      generationId:
        index === 0
          ? MOCK_SESSION[0]?.id ?? null
          : index === 1
            ? MOCK_CURSOR_FEED[0]?.id ?? null
            : index === 2
              ? MOCK_SESSION[1]?.id ?? null
              : null,
    })),
  };
}

export const MOCK_CHAT_SESSION_ID = "mock-chat-session-1";

export const MOCK_CHAT_SESSIONS: ChatSession[] = [
  {
    id: MOCK_CHAT_SESSION_ID,
    source: "cursor",
    title: "Cursor — podsumowanie (mock)",
    created_at: minutesAgo(45),
    last_active_at: minutesAgo(3),
    is_saved: true,
    message_count: 3,
    metadata_json: null,
  },
  {
    id: "mock-chat-session-2",
    source: "hermes",
    title: "Hermes — test TTS",
    created_at: minutesAgo(180),
    last_active_at: minutesAgo(90),
    is_saved: false,
    message_count: 2,
    metadata_json: null,
  },
];

const MOCK_CHAT_MESSAGES: Record<string, ChatMessage[]> = {
  [MOCK_CHAT_SESSION_ID]: [
    {
      id: "mock-chat-msg-1",
      session_id: MOCK_CHAT_SESSION_ID,
      role: "user",
      content: "Przeczytaj podsumowanie tej odpowiedzi na głos.",
      generation_id: null,
      created_at: minutesAgo(5),
      order_index: 0,
    },
    {
      id: "mock-chat-msg-2",
      session_id: MOCK_CHAT_SESSION_ID,
      role: "assistant",
      content:
        "Podsumowanie asystenta Cursor — tryb mockup pokazuje ten wpis w oknie czatu z odznaką profilu głosu.",
      generation_id: "mock-gen-cursor",
      created_at: minutesAgo(4),
      order_index: 1,
      voice_profile_id: "mock-vp-minimax",
    },
    {
      id: "mock-chat-msg-3",
      session_id: MOCK_CHAT_SESSION_ID,
      role: "assistant",
      content: "Druga wiadomość bez audio — placeholder w podglądzie UI.",
      generation_id: null,
      created_at: minutesAgo(3),
      order_index: 2,
    },
  ],
  "mock-chat-session-2": [
    {
      id: "mock-chat-msg-4",
      session_id: "mock-chat-session-2",
      role: "user",
      content: "Wygeneruj krótkie powitanie po polsku.",
      generation_id: null,
      created_at: minutesAgo(91),
      order_index: 0,
    },
    {
      id: "mock-chat-msg-5",
      session_id: "mock-chat-session-2",
      role: "assistant",
      content: "Witaj w TTS Hub — to przykładowa odpowiedź bota Hermes.",
      generation_id: "mock-gen-editor",
      created_at: minutesAgo(90),
      order_index: 1,
      voice_profile_id: "mock-vp-narracja",
    },
  ],
};

export function getMockChatMessages(sessionId: string): ChatMessage[] {
  return MOCK_CHAT_MESSAGES[sessionId] ?? [];
}

export const MOCK_ROLEPLAY_PROJECTS: RoleplayProjectSummary[] = [
  {
    id: "mock-rp-tawerna",
    name: "Rozdział 1 — tawerna (mock)",
    created_at: minutesAgo(60 * 24),
    updated_at: minutesAgo(120),
    status: "draft",
    segment_count: 4,
  },
  {
    id: "mock-rp-kronika",
    name: "Kronika podróży — scena 2",
    created_at: minutesAgo(60 * 48),
    updated_at: minutesAgo(60 * 5),
    status: "script",
    segment_count: 3,
  },
];

const MOCK_ROLEPLAY_PALETTE = [
  { color: "#38bdf8", voiceProfileId: "mock-vp-narracja" },
  { color: "#f472b6", voiceProfileId: "mock-vp-minimax" },
  { color: "#4ade80", voiceProfileId: "mock-vp-narracja" },
] as const;

function highlight(color: string, text: string) {
  return {
    type: "text" as const,
    text,
    marks: [{ type: "highlight" as const, attrs: { color } }],
  };
}

function paragraph(...parts: ReturnType<typeof highlight>[]) {
  return { type: "paragraph" as const, content: parts };
}

const MOCK_ROLEPLAY_DOCS: Record<string, object> = {
  "mock-rp-tawerna": {
    type: "doc",
    content: [
      paragraph(
        highlight(
          "#38bdf8",
          "W tawernie „Złoty Liść” panował gwar. Bartholomew wszedł do środka i roztoczył ręce szeroko.",
        ),
      ),
      paragraph(
        highlight("#f472b6", "— Witajcie, podróżnicy! Czy ktoś zamówi kolejkę miodu?"),
      ),
      paragraph(
        highlight(
          "#38bdf8",
          "Kelner skinął głową i zniknął w tłumie. Przy kominku siedziała młoda elfka z mapą rozłożoną na stole.",
        ),
      ),
      paragraph(
        highlight("#f472b6", "— Szukam drogi na północ. Słyszałam, że przechodzi przez Most Cieni."),
      ),
      paragraph(
        highlight(
          "#4ade80",
          "Bartholomew pochylił się nad mapą i wskazał palcem zarysowaną linią szlaku.",
        ),
      ),
    ],
  },
  "mock-rp-kronika": {
    type: "doc",
    content: [
      paragraph(
        highlight("#38bdf8", "Poranek nad jeziorem był spokojny. Mgła unosiła się tuż nad taflą wody."),
      ),
      paragraph(highlight("#f472b6", "— Płyniemy za dwie godziny. Sprawdź liny i żagle.")),
      paragraph(
        highlight(
          "#4ade80",
          "Marynarz kiwnął głową i pobiegł w stronę cumy, a wiatr delikatnie falował chorągiewką na maszcie.",
        ),
      ),
    ],
  },
};

export function getMockRoleplayProject(id: string): RoleplayProject | null {
  const doc = MOCK_ROLEPLAY_DOCS[id];
  const summary = MOCK_ROLEPLAY_PROJECTS.find((project) => project.id === id);
  if (!doc || !summary) return null;

  return {
    id: summary.id,
    name: summary.name,
    created_at: summary.created_at,
    updated_at: summary.updated_at,
    doc_json: JSON.stringify(doc),
    palette_json: JSON.stringify(MOCK_ROLEPLAY_PALETTE),
    timeline_json: JSON.stringify({ tracks: [], clips: [] }),
    status: summary.status,
    segments: [],
  };
}

export const MOCK_MINIMAX_PRESETS: MinimaxPresetVoice[] = [
  {
    voice_id: "Polish_female_1_sample1",
    display_name: "Polish Female 1 (mock)",
    language: "pl",
  },
  {
    voice_id: "Polish_male_1_sample4",
    display_name: "Polish Male 1 (mock)",
    language: "pl",
  },
  {
    voice_id: "English_female_sample1",
    display_name: "English Female (mock)",
    language: "en",
  },
];

export const MOCK_MINIMAX_CLONED: MinimaxClonedVoice[] = [
  {
    voice_id: "mock_clone_kasia",
    name: "Kasia — klon (mock)",
    created_at: minutesAgo(60 * 72),
    output_vol: 1,
  },
];

export function getMockMinimaxCatalog() {
  return {
    cloned: MOCK_MINIMAX_CLONED,
    presets: MOCK_MINIMAX_PRESETS,
    syncedAt: minutesAgo(30),
    hasApiKey: true,
    enabledLanguages: ["pl", "en"],
  };
}

export const MOCK_VOICEBOX_HISTORY: VoiceBoxHistoryItem[] = [
  {
    id: "mock-vb-hist-1",
    profile_id: "mock-vb-profile",
    profile_name: "Mój głos (mock)",
    text: "Przykładowa generacja Voice Box — podgląd historii serwera.",
    language: "pl",
    audio_path: "mock://voicebox/sample.wav",
    duration: 3.8,
    seed: null,
    instruct: null,
    engine: "chatterbox",
    model_size: "mock",
    status: "done",
    error: null,
    is_favorited: true,
    created_at: new Date(minutesAgo(15)).toISOString(),
  },
  {
    id: "mock-vb-hist-2",
    profile_id: "mock-vb-profile",
    profile_name: "Mój głos (mock)",
    text: "Drugi wpis w historii Voice Box — placeholder UI.",
    language: "pl",
    audio_path: "mock://voicebox/sample2.wav",
    duration: 2.1,
    seed: null,
    instruct: null,
    engine: "chatterbox",
    model_size: "mock",
    status: "done",
    error: null,
    is_favorited: false,
    created_at: new Date(minutesAgo(45)).toISOString(),
  },
];

export function getMockVoiceboxHistory() {
  return { items: MOCK_VOICEBOX_HISTORY, total: MOCK_VOICEBOX_HISTORY.length };
}

export const MOCK_VIDEO_EXPORTS: VideoExportRecord[] = [
  {
    id: "mock-video-export-1",
    generationId: "mock-gen-editor",
    templateId: "builtin-whatsapp-karaoke",
    filePath: "mock://video/export.mp4",
    thumbPath: null,
    durationMs: 4200,
    fileSizeBytes: 512_000,
    renderParamsHash: "mock",
    createdAt: minutesAgo(20),
    source: "manual",
    title: "WhatsApp karaoke (mock)",
  },
];

export const MOCK_VOICEBOX_HEALTH: VoiceBoxHealth = {
  status: "ok",
  model_loaded: true,
  model_downloaded: true,
  model_size: "mock",
  gpu_available: false,
  gpu_type: null,
  vram_used_mb: null,
  backend_type: "mock",
  backend_variant: null,
  gpu_compatibility_warning: null,
};
