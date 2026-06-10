# Plan: Personality Layer (LLM Text-Rewrite Before TTS)

## Goal

Each `TtsVoiceProfile` (or a global default) can be paired with a **Personality** — a multi-source "identity" (system prompt + few-shot examples + optional uploaded file + preset library). When generating, the input text is **first rewritten by an LLM** through that personality, **then** sent to the TTS provider. A live preview shows the rewrite before clicking generate. Pluggable across multiple LLM backends.

---

## Architecture (one picture)

```
[ Editor text ]
      │
      ▼
applyTextFilters()        (existing)
      │
      ▼
personalityRewrite()      ◀── NEW: frontend preview (debounced)
      │                         calls invoke('personality_rewrite', {…})
      │                         (or returns the cached rewrite from history)
      ▼
GenerateRequest { text, filtered_text, rewritten_text, personality_id }
      │
      ▼
[Rust: enqueue_request]
      │
      ▼
[Rust: JobQueue::execute]  re-validates / re-applies personality server-side
      │                     (authoritative) — picks req.rewritten_text
      ▼
TTS provider (google / voicebox / minimax)
```

The frontend **previews** the rewrite (fast UX); the backend **authoritatively re-rewrites** in case the frontend preview was stale, the user toggled personalities after preview, or the request came from HTTP/Cursor/roleplay without a frontend preview.

---

## 1. Data Model

### 1.1 New file: `src/personality/types.ts`

```ts
export type PersonalityProviderId =
  | "minimax-llm"   // MiniMax chat completions (reuses minimax_api_key)
  | "google-gemini" // gemini-2.5-flash (reuses api_profiles)
  | "openai-compatible" // any /v1/chat/completions endpoint
  | "none";          // disabled, personality still stored for record

export interface PersonalityExample {
  user: string;
  assistant: string;
}

export interface PersonalitySource {
  kind: "prompt" | "file" | "preset";
  /** kind="prompt": inline text. kind="file": absolute path on disk. kind="preset": preset id (see PRESETS). */
  value: string;
  /** Optional display label. */
  label?: string | null;
  /** Bytes (files only) — informational, for UI. */
  bytes?: number | null;
}

export interface Personality {
  id: string;
  name: string;
  enabled: boolean;
  provider: PersonalityProviderId;
  /** Per-provider model id, e.g. "MiniMax-Text-01" / "gemini-2.5-flash" / "gpt-4o-mini". */
  model: string;
  /** System prompt — the "identity / role / tone" definition. */
  system_prompt: string;
  /** Few-shot examples (user → assistant rewrite pairs). */
  examples: PersonalityExample[];
  /** Free-form rewrite instructions appended after the system prompt. */
  rewrite_instructions: string;
  /** Optional sources (prompt / file / preset) merged into system_prompt. */
  sources: PersonalitySource[];
  /** Output language hint (e.g. "pl-PL"); passed as instruction. */
  output_language: string;
  temperature: number;       // default 0.7
  max_output_tokens: number; // default 1024
  /** Voice-profile ↔ personality link. */
  voice_profile_ids: string[];  // empty = available globally
  /** Cache rewrite per (personality_id, input_hash) to avoid re-billing. */
  cache: { enabled: boolean; ttl_sec: number };
  created_at: number;
  updated_at: number;
}

/** Built-in starter presets the user can clone or apply. */
export const PERSONALITY_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  system_prompt: string;
  rewrite_instructions: string;
  examples: PersonalityExample[];
  output_language: string;
}> = [
  // "Lektor spokojny", "Narrator ciepły", "DJ radiowy",
  // "Czatowy asystent", "Tłumacz PL↔EN", "Streszczacz"
];
```

### 1.2 Extend `src/appSettings.ts` `AppSettings`

```ts
// New fields (additive — defaults keep backwards compat):
personalities: Personality[];                 // default []
active_personality_id: string | null;          // default null
personality_global_enabled: boolean;           // master switch
personality_openai_base_url: string | null;    // for "openai-compatible"
```

### 1.3 Extend `src/types.ts` `GenerateRequest` + `Generation`

```ts
// In GenerateRequest:
personality_id?: string | null;        // snapshot of active personality
rewritten_text?: string | null;        // cache of the rewrite (server may re-do)

// In Generation (history row):
personality_id?: string | null;        // snapshot
rewritten_text?: string | null;        // persisted for replay/diff
original_text?: string | null;         // text before rewrite (= filtered_text, for clarity)
```

### 1.4 Extend `TtsVoiceProfile` (`src/appSettings.ts`)

```ts
// Additive:
personality_id: string | null;          // override global active personality
```

When `null`, falls back to `appSettings.active_personality_id`.

### 1.5 Extend Rust `GenerateReq` (`src-tauri/src/commands.rs`)

```rust
#[serde(default)]
pub personality_id: Option<String>,
#[serde(default)]
pub rewritten_text: Option<String>,
```

### 1.6 DB migration (`src-tauri/src/db.rs`)

Add 3 columns to `generations` (following the existing `ALTER TABLE` migration pattern around line 259):

- `personality_id TEXT`
- `rewritten_text TEXT`
- `original_text TEXT`

Add 3 columns to `voice_profiles` (or store in JSON `request_json`):

- `personality_id TEXT` (a denormalised view) — optional, the canonical source is `appSettings.voice_profiles`.

---

## 2. LLM Provider Abstraction (pluggable)

### 2.1 New file: `src-tauri/src/personality/mod.rs`

```rust
pub mod providers {
    pub mod minimax;       // POST https://api.minimax.chat/v1/text/chatcompletion_v2
    pub mod google_gemini; // POST generativelanguage.googleapis.com/.../models/{m}:generateContent
    pub mod openai_compat; // POST {base_url}/v1/chat/completions
}

pub struct PersonalityInvokeRequest {
    pub provider: String,
    pub model: String,
    pub system_prompt: String,
    pub rewrite_instructions: String,
    pub examples: Vec<PersonalityExample>,
    pub output_language: String,
    pub temperature: f32,
    pub max_output_tokens: u32,
    pub input_text: String,
}

pub async fn invoke(req: PersonalityInvokeRequest, api_keys: &ApiKeys) -> Result<String, String>
```

Each provider module returns `Result<String, String>` — the rewritten text. Errors are surfaced as a phase event so the UI can show "Personality rewrite failed: <reason>" but **fallback to the un-rewritten text** rather than failing the whole generation.

### 2.2 New Tauri commands (`src-tauri/src/commands.rs`)

```rust
#[tauri::command]
pub async fn personality_rewrite(
    app: AppHandle, state: State<'_, AppArc>,
    req: PersonalityRewriteReq,
) -> Result<PersonalityRewriteResult, String>;

#[tauri::command]
pub async fn personality_test(
    state: State<'_, AppArc>, personality_id: String, sample: String,
) -> Result<String, String>;  // for the "Test" button in settings

#[tauri::command]
pub async fn personality_presets_list() -> Vec<PersonalityPresetMeta>;
```

`PersonalityRewriteReq`:

```rust
{ personality_id: String, text: String, voice_profile_id: Option<String> }
```

`PersonalityRewriteResult`:

```rust
{ rewritten: String, cached: bool, ms: u64, provider: String, model: String }
```

### 2.3 MiniMax provider (reuses existing key)

POST `https://api.minimax.chat/v1/text/chatcompletion_v2` (or the current MiniMax text endpoint — confirm against the existing `minimax.rs` HTTP call conventions). Auth: `Authorization: Bearer ${MINIMAX_API_KEY}`. Model default: `MiniMax-Text-01`. Build messages:

```
system: <personality.system_prompt + "\n\n" + rewrite_instructions + "\n\nJęzyk wyjścia: " + output_language>
[few-shot: user/assistant pairs…]
user:    <input_text>   ("Przepisz poniższy tekst zachowując osobowość…\n\n" + text)
```

Strip code fences / leading "Here is the rewrite:" chatter before returning.

### 2.4 Cache

Simple in-memory `Mutex<HashMap<(personality_id, blake3(input_text)), (rewritten, expires_at)>>` in Rust. TTL configurable per personality. Avoids double-billing when the user clicks Generate twice in a row.

---

## 3. Pipeline Integration

### 3.1 Frontend: `src/components/MainPanel.tsx` `enqueueGeneration` (line 211)

After `applyTextFilters`:

```ts
const personality = resolvePersonalityForRequest(tts, voiceProfileId, appSettingsSnapshot);
let rewritten: string | null = null;
if (personality?.enabled && appSettingsSnapshot?.personality_global_enabled) {
  rewritten = await personalityRewrite({ personality_id: personality.id, text: filtered, voice_profile_id: voiceProfileId });
}
// continue existing flow, attach to invoke('generate', { …, personality_id, rewritten_text })
```

Where `resolvePersonalityForRequest` is a new helper in `src/lib/personalities.ts`:

```ts
export function resolvePersonalityForRequest(
  tts: SettingsState, voiceProfileId: string | null, app: AppSettings | null
): Personality | null
```

Lookup order: voice_profile_id → that profile's `personality_id` → global `active_personality_id` → `null`.

### 3.2 Frontend: live preview in `src/components/textFilters/SynthTextPreview.tsx`

Add a third diff line: `original → filtered → rewritten` (only when personality is active). Use the same debounce pattern as the filter preview (call `personality_rewrite` 350 ms after the user stops typing). Cancellable via `AbortController` so a fast typist doesn't pile up requests.

### 3.3 Frontend: quick toggle in `TextFiltersBar.tsx`

Add a small chip "Osobowość: <name> ✔" / "Osobowość: wyłączona" — clicking it opens a popover with the list of personalities to switch the **active** one (mirrors how voice profiles switch in the sidebar).

### 3.4 Backend: `src-tauri/src/commands.rs` `enqueue_request` (line 181)

After `resolve_filtered_text`, before the queue insert:

```rust
if let Some(pid) = req.personality_id.as_deref() {
    if !req.rewritten_text.as_deref().map(|s| !s.trim().is_empty()).unwrap_or(false) {
        // No frontend preview — re-rewrite server-side
        match personality::personality_rewrite_for(&state, pid, &req.filtered_text.clone().unwrap_or(req.text.clone())).await {
            Ok(r) => req.rewritten_text = Some(r),
            Err(e) => log::warn!("personality rewrite failed: {e}"), // graceful fallback
        }
    }
    req.original_text = Some(req.filtered_text.clone().unwrap_or(req.text.clone()));
}
```

### 3.5 Backend: `src-tauri/src/job_queue.rs` `run_job` (line 183)

Extend the `synth_text` resolution chain:

```rust
let synth_text = req.summary_text
    .as_deref()
    .filter(|s| !s.trim().is_empty())
    .or(req.rewritten_text.as_deref().filter(|s| !s.trim().is_empty()))
    .or(req.filtered_text.as_deref().filter(|s| !s.trim().is_empty()))
    .unwrap_or(&req.text);
```

This means: **if a personality is active and produced a rewrite, that rewrite is what gets spoken**, otherwise the existing fallback chain is used.

### 3.6 DB persistence

In `enqueue_request` insert (around line 200-280) add the three new columns to the INSERT. Extend the `Generation` struct in `db.rs` and add the SELECT columns.

### 3.7 Voice-profile integration point

`src/lib/voiceProfileActions.ts::requestGenerateWithVoiceProfile` — pass the `voice_profile_id` to `enqueueGeneration` so the new helper can resolve the linked personality. The existing chain (`dispatchEvent → MainPanel.generateWithProfileRef → enqueueGeneration`) is the single funnel; the new `voice_profile_id` arg is enough.

### 3.8 Other entry points (auto-include personality)

These call paths must pass `personality_id`/`rewritten_text` too — they go through the same `enqueue_request` server-side, so as long as we re-write server-side when `rewritten_text` is missing, **everything works automatically**:

- `quick_hotkeys.rs` — global hotkey
- `cursor_integration.rs` — Cursor agent
- `roleplay/queue.rs` — roleplay segments
- `http_api.rs` — `POST /generate`
- `chat/ChatView.tsx` — in-app chat TTS

Server-side authoritative rewrite covers all of these without frontend work.

---

## 4. UI Surfaces

### 4.1 New settings tab `personality` (mirrors `filters` tab)

`src/components/settings/pages/PersonalityPage.tsx`:

- **Master switch**: `personality_global_enabled` toggle
- **Personality list** (left column): cards with name, provider/model badge, linked voice-profile chips, edit/duplicate/delete
- **Editor (right column)**: name, enabled, provider dropdown, model field, output language, temperature slider, max tokens, system_prompt textarea, few-shot examples list (add/remove rows), rewrite_instructions textarea, sources section (add `prompt | file | preset` rows), voice_profile_ids multi-select, cache toggles
- **Action bar**: "Test" button (calls `personality_test` with a sample), "Zapisz"
- **Provider-specific key** (for MiniMax: "Używa klucza z ustawień MiniMax" info; for OpenAI-compat: base_url + key fields added to a new "LLM Keys" subsection in `GeneralPage`)

`src/components/settings/settingsTabs.ts`: insert `personality` after `filters` in `SETTINGS_TAB_IDS` and add the meta entry. Add a `Pages` mapping in `SettingsView.tsx`.

### 4.2 Link from `TtsVoiceProfile` editor

In `src/components/Settings.tsx` voice-profile save footer (and the saved-profile row UI in `VoiceProfilesListPanel.tsx`), add a small dropdown "Osobowość: <select>" sourced from the personalities list. The chosen `personality_id` is stored on the `TtsVoiceProfile`.

### 4.3 History row badge (new component)

`src/components/PersonalityBadge.tsx` (mirrors `VoiceProfileBadge.tsx`):

- Renders a small chip with the personality icon + name
- Click → modal with the system prompt + the original vs rewritten text diff (reuses `SynthTextPreview` styling)
- Resolved via `resolvePersonalityForHistory` in `src/lib/personalities.ts`

Wired into `MainPanel` history rendering and `chat/ChatView.tsx` message rendering.

### 4.4 Roleplay per-segment personality (optional, simple add)

Add `personality_id: string | null` to `RoleplaySegment` in `src/roleplay/types.ts`. In `VoicePalette.tsx` (the color → voice-profile picker) add a second column for "Osobowość". The existing `build_generate_req_from_profile` already maps per-segment to `GenerateReq` — extend it to forward the personality too.

---

## 5. Files to Add / Modify

### New

- `src/personality/types.ts` — TS types + presets
- `src/personality/presets.ts` — built-in starter presets
- `src/lib/personalities.ts` — resolve helpers, hashing, change events
- `src/lib/personalitiesEvents.ts` — `PERSONALITIES_CHANGED` event
- `src/hooks/usePersonalities.ts` — list + CRUD hook
- `src/components/PersonalityBadge.tsx`
- `src/components/settings/pages/PersonalityPage.tsx`
- `src-tauri/src/personality/mod.rs` — provider abstraction + cache
- `src-tauri/src/personality/providers/minimax.rs`
- `src-tauri/src/personality/providers/google_gemini.rs`
- `src-tauri/src/personality/providers/openai_compat.rs`

### Modified

- `src/types.ts` — `GenerateRequest` + `Generation` add 3 fields
- `src/appSettings.ts` — `AppSettings` add 4 fields; `TtsVoiceProfile` add `personality_id`
- `src/api/tauri.ts` — `generate` wrapper + `personalityRewrite` + `personalityTest` + `personalityPresetsList`
- `src/components/MainPanel.tsx` — `enqueueGeneration` adds preview + passes `personality_id` / `rewritten_text`
- `src/components/Settings.tsx` — personality dropdown in voice-profile save
- `src/components/VoiceProfilesListPanel.tsx` — show linked personality chip
- `src/components/HistorySidebar.tsx` (or wherever the history rows render) — render `<PersonalityBadge>`
- `src/components/textFilters/SynthTextPreview.tsx` — third diff line
- `src/components/textFilters/TextFiltersBar.tsx` — quick switcher chip
- `src/chat/ChatView.tsx` — render badge on TTS-attached chat messages
- `src/roleplay/types.ts` + `src/roleplay/VoicePalette.tsx` + `src/roleplay/segments.ts` — per-segment personality
- `src/components/settings/settingsTabs.ts` + `src/components/settings/SettingsView.tsx` — new tab
- `src-tauri/src/commands.rs` — `GenerateReq` add 2 fields; new Tauri commands; rewrite step in `enqueue_request`
- `src-tauri/src/lib.rs` — register new commands in `generate_handler!`
- `src-tauri/src/job_queue.rs` — extend `synth_text` chain
- `src-tauri/src/db.rs` — `Generation` struct + `INSERT` + `SELECT` + `ALTER TABLE` migration
- `src-tauri/src/app_settings.rs` — `AppSettings` + serialise/deserialise new fields
- `studios.env.example` — add `OPENAI_API_KEY` (optional) and `OPENAI_BASE_URL` (optional)

---

## 6. Behavior Summary (UX)

| Surface | When personality is active | When disabled / null |
|---|---|---|
| Editor → click "Generuj" | Frontend previews rewrite → user sees the new text in SynthTextPreview → invoke('generate', {…, rewritten_text}) → backend trusts it | Falls through to existing filtered text |
| Editor → Gen Ust 1/2 | Same (resolvePersonalityForRequest called with the slot's voice_profile_id) | Same |
| Voice profile click (sidebar) | Resolves via that profile's `personality_id` | Falls through to global active or null |
| Quick hotkey (global) | Server-side authoritative rewrite (no frontend preview needed) | Original flow |
| Cursor integration | Same | Original flow |
| HTTP POST /generate | Same | Original flow |
| Roleplay segment | Per-segment personality override | Per-voice-profile personality or null |
| Chat TTS | Server-side authoritative rewrite | Original flow |

In every case where the frontend is in play, a **live preview** is shown before generation. Where only the backend is in play, the rewrite happens **once** on the server.

---

## 7. Error / Fallback Semantics

- LLM call fails (network, auth, rate limit): log warning, **use the un-rewritten text**, surface a non-fatal toast "Personality rewrite failed: <reason> — generated with original text".
- Personality disabled mid-flight: server uses `rewritten_text` only if non-empty.
- Cache hit (same `personality_id` + same input hash within TTL): no second LLM call.
- Provider "none": personality is preserved as a record but never invoked (acts as a dry-run / placeholder).

---

## 8. Privacy / Security

- All LLM calls are made **from the Rust backend**, never from the renderer. The API keys (MiniMax / Gemini / OpenAI) live where they already live (env file + `AppSettings`).
- The optional OpenAI-compat provider stores `openai_base_url` + key in `AppSettings`, written by `PersonalityPage`, persisted via the existing `setAppSettings` path. No new persistence layer.
- The cache is in-process and cleared on app restart (no PII at rest).

---

## 9. Testing Approach (manual smoke checklist for first ship)

1. Create personality "Lektor spokojny" from preset → assign to existing voice profile → click Generuj in editor → confirm preview shows rewrite → confirm audio reflects rewrite.
2. Same flow with file upload (`*.md`).
3. Disable personality globally → confirm original text is spoken.
4. Voice profile with no linked personality + global active set → confirm global is used.
5. Quick hotkey `Ctrl+Shift+1` triggers TTS with no frontend preview → confirm server-side rewrite happens (audio differs).
6. HTTP `POST /generate` with `personality_id` set → confirm same.
7. Roleplay segment with personality override → confirm per-segment.
8. LLM call forced to fail (wrong key) → confirm generation still completes with un-rewritten text + warning toast.
9. Re-click Generuj with identical text → confirm cache hit (no second LLM call, log line).
10. `npm run build` (tsc + vite) + `cargo build` (Tauri) pass clean.
