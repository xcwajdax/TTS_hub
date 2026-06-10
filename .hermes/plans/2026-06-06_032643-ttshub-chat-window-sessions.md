# TTShub Chat Window — Plan Implementacji

> **Dla Hermesa:** Użyj subagent-driven-development do wykonania tego planu task-po-tasku. Świeży subagent per task z pełnym kontekstem + 2-etapowy review (spec compliance, potem code quality).

**Cel:** Nowe okno w TTShub, które wyświetla sesję rozmowy źródło↔użytkownik w formie czatu, z auto-detekcją nowej sesji, możliwością ponownego odtworzenia odpowiedzi i opcją zapisu sesji (domyślnie auto-kasowanie). API akceptuje nowe pole `original_prompt` w `/generate`.

**Architektura:** 4 warstwy — (1) DB: kolumna `original_prompt` + tabele `chat_sessions`/`chat_messages`; (2) Backend: nowy `chat` moduł Rust z auto-detekcją sesji per source; (3) HTTP API: 6 nowych endpointów; (4) Frontend: nowy widok `ChatView` + tab w `AppViewTabs`.

**Tech stack:** Tauri v2 (Rust), React+Vite+Tailwind, SQLite (rusqlite), Axum, Tauri Events (broadcast).

---

## Kontekst i stan obecny

### Co już istnieje (gotowe, NIE ruszać)
- `db.rs` ma kolumny `session_id`, `source`, `conversation_id` w tabeli `generations` — patrz `src-tauri/src/db.rs:8-25, 119, 155-169`
- `app_settings.rs` ma pole `session_id` w `AppState` (UUID per app session)
- `HistorySidebar` filtruje po `scope=session|archive|cursor` (`src/api/tauri.ts:??`)
- `http_api.rs` ma route `/generate` (linia 77), `/history` (linia 78)
- Tauri events: `JobUpdateEvent`, `JobPhaseEvent` (`job_queue.rs`)
- **Nowy moduł `roleplay/`** (committed do dirty worktree) — to NIE jest to okno czatu. To multi-voice studio z timeline/tracks/clips (DAW). Pozostaje oddzielnym featurem.

### Stan dirty worktree na main
```bash
M package.json
M package-lock.json
M src-tauri/Cargo.toml
M src-tauri/src/db.rs (264+ lines added — patrz niżej, czy już ma `original_prompt`)
M src-tauri/src/lib.rs
M src-tauri/src/paths.rs
M src-tauri/src/state.rs
M src/App.tsx
M src/api/tauri.ts
M src/components/AppViewTabs.tsx
M src/styles.css
?? src-tauri/src/roleplay/  (DAW, nie nasze)
?? src/roleplay/            (DAW, nie nasze)
```

**Zasada:** Ten plan operuje NA tym dirty worktree. **Task 0 musi zdecydować**: (a) commit roleplay przed startem, (b) branch z dirty state, (c) jedziemy na dirty main. Rekomendacja: **branch** `feat/chat-window` z obecnego stanu (roleplay zostaje w dirty, ale commitujemy go atomowo jako `wip: roleplay foundation` żeby branch się różnił czysto). Decyzja w Task 0.

### Sprawdzenie czy `original_prompt` już jest dodany
`git diff HEAD -- src-tauri/src/db.rs` trzeba sprawdzić w Task 0. Jeśli tak — skip część DB. Jeśli nie — implementujemy w Task 2.

---

## Otwarte pytania do Kuby (przed Task 0)

1. **Gdzie trzymać sesje czatu?** Opcja A: reużyć `generations` (jeden wiersz = jedna wiadomość czatu, z `is_chat_message=1`). Opcja B: osobna tabela `chat_messages`. **Rekomendacja: B** (czystsze schema, nie mieszamy z generation history, łatwiej kasować cascade). Czy OK?

2. **Auto-detekcja nowej sesji — co to triggeruje?** Opcja A: nowe `source` ID (np. nowy `session_id` od klienta). Opcja B: timeout (brak aktywności 30min = nowa sesja). Opcja C: jawny sygnał `chat_session_id` w requeście od klienta. **Rekomendacja: C** (klient ma najlepszą wiedzę kiedy kończy się rozmowa). Czy OK?

3. **Okno czatu — modal czy nowe Tauri window?** Rekomendacja: **nowa zakładka `Chat`** w `AppViewTabs` obok TTS/Extensions/Roleplay (4-ty tab). Modal ukrywałby sesję gdy user robi coś innego. Okno Tauri mocno komplikuje state-sync.

4. **Czy Historia/TTS powinna dalej istnieć równolegle do Czat, czy zastąpić?** Zakładam: **równolegle**. Chat to wyspecjalizowany widok, Historia dalej działa jak działa.

5. **Kto to wszystko zobaczy?** Chat per source (np. "Czat z Hermesem", "Czat z Cursor")? Czy jeden wspólny widok? **Rekomendacja: per source** — dropdown w nagłówku chatu: "Aktywne źródło: [hermes-gateway / cursor / opencode]". Każde źródło ma swoją sesję.

---

## Architektura

### Przepływ danych (sekwencja)

```
[Źródło: Hermes/Cursor/OpenCode]
    │
    │  POST /generate { text, model, voice, ..., original_prompt, chat_session_id }
    ▼
[TTShub HTTP API: /generate]
    │
    │  1. Roaming po `chat_session_id` — czy istnieje sesja w chat_sessions?
    │  2. Jeśli NIE → utwórz nową sesję (auto-detection!)
    │  3. Wstaw chat_messages (user + assistant turn)
    │  4. Enqueue TTS job (standard flow)
    │  5. Emit Tauri event "chat:message_added"
    ▼
[Job Queue → TTS Provider]
    │
    │  job:done → emit JobUpdateEvent
    ▼
[Frontend: ChatView useEffect]
    │
    │  refetch messages, scroll to bottom, play audio
    ▼
[User klika "powtórz" na wiadomości]
    │
    │  invoke("chat_replay_message", { messageId })
    ▼
[Backend: replay → reuses generation audio file]
```

### DB Schema (nowe tabele)

```sql
CREATE TABLE chat_sessions (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,           -- "hermes", "cursor", "opencode", custom
    title TEXT,                     -- user-editable, default = "{source} {date}"
    created_at INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL,
    is_saved INTEGER NOT NULL DEFAULT 0,  -- if 1, survives app restart; if 0, auto-delete on app close
    message_count INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT              -- free-form: tags, source-specific config
);
CREATE INDEX idx_chat_sessions_source ON chat_sessions(source, last_active_at DESC);
CREATE INDEX idx_chat_sessions_saved ON chat_sessions(is_saved, last_active_at DESC);

CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,           -- the actual text (user prompt or assistant reply)
    generation_id TEXT,              -- FK to generations.id, NULL for user messages
    created_at INTEGER NOT NULL,
    order_index INTEGER NOT NULL
);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, order_index ASC);
```

### Nowe pole w `generations` (extend existing)

```sql
ALTER TABLE generations ADD COLUMN original_prompt TEXT;
ALTER TABLE generations ADD COLUMN chat_session_id TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL;
ALTER TABLE generations ADD COLUMN chat_message_id TEXT REFERENCES chat_messages(id) ON DELETE SET NULL;
```

Te trzy kolumny są addytywne, zero breaking change dla istniejących klientów.

### HTTP API — nowe endpointy

| Method | Path | Body / Query | Opis |
|--------|------|--------------|------|
| POST | `/chat/sessions` | `{source, title?, metadata?}` | Utwórz sesję. Zwraca `ChatSession`. |
| GET | `/chat/sessions` | `?source=...&saved_only=false` | Lista sesji. |
| GET | `/chat/sessions/:id` | — | Szczegóły sesji + messages. |
| PATCH | `/chat/sessions/:id` | `{title?, is_saved?}` | Edytuj metadane sesji. |
| DELETE | `/chat/sessions/:id` | — | Usuń sesję (CASCADE messages). |
| POST | `/chat/sessions/:id/messages` | `{role, content, generation_id?}` | Dodaj wiadomość (opcjonalnie, zwykle dodaje się przez /generate). |
| POST | `/chat/sessions/:id/replay/:message_id` | — | Ponowne odtworzenie audio dla assistant message. |
| GET | `/chat/sources` | — | Lista aktywnych źródeł (distinct `source` z ostatnich 30 dni). |

### `/generate` rozszerzenie (non-breaking)

```json
POST /generate
{
  "text": "Cześć, jestem Hermesem",
  "model": "minimax:speech-2.8-hd",
  "voice": "wojciech_mann",
  "format": "mp3",
  "original_prompt": "używaj ttshub głosem manna",  // NEW
  "chat_session_id": "sess_abc123",                  // NEW (optional — auto-create if missing)
  "chat_role": "assistant"                           // NEW (default "assistant")
}
```

Backend logika:
1. Jeśli `chat_session_id` podany i sesja istnieje → dopisz do niej
2. Jeśli `chat_session_id` podany ale sesja NIE istnieje → **auto-create** (to jest ta "auto-detekcja nowej sesji")
3. Jeśli brak `chat_session_id` → wygeneruj nowy `sess_{uuid}` (nowa sesja)
4. Wstaw `chat_messages` (user turn z `original_prompt`, assistant turn z `text`)
5. Enqueue TTS job standard flow
6. Zapisz `original_prompt` w `generations` (adresowalne dla późniejszego re-exporu)

### Frontend — nowy `ChatView`

Nowa zakładka w `AppViewTabs` (4-ty tab obok TTS/Extensions/Roleplay):

```
┌─────────────────────────────────────────────────────┐
│  Źródło: [Hermes Gateway ▼]  [+ Nowa sesja]        │
│  Sesja: "Rozmowa z Hermesem 2026-06-06 03:30" [⭐] │
├─────────────────────────────────────────────────────┤
│  [User 03:30]  "używaj ttshub głosem manna"        │
│  [Bot  03:30]  "Manny włączony..." [▶ Odtwórz] [⋯] │
│  [User 03:32]  "powiedz coś o Braunie"              │
│  [Bot  03:32]  "Grzegorz Braun..." [▶ Odtwórz] [⋯] │
├─────────────────────────────────────────────────────┤
│  [wiadomość...]              [Wyślij + Generuj TTS] │
└─────────────────────────────────────────────────────┘
```

Kluczowe funkcje UI:
- **Live update przez Tauri event** `chat:message_added` (broadcast z backendu po `/generate`)
- **Auto-scroll do dna** przy nowej wiadomości
- **Przycisk "Odtwórz ponownie"** → `chat_replay_message` (bez ponownej generacji, reuse istniejącego audio)
- **Przycisk "⭐ Zapisz"** → ustawia `is_saved=1`, sesja przeżywa restart
- **Dropdown źródeł** w nagłówku, przełącza widok na inną sesję
- **Auto-kasowanie**: przy starcie apki, wszystkie `is_saved=0` sesje starsze niż 7 dni są usuwane (background task)

### Domyślne zachowanie (KISS, YAGNI)
- Sesja auto-tworzona przy pierwszej wiadomości z danego `chat_session_id`
- Auto-kasowanie po 7 dniach dla nieoznaczonych ⭐
- `is_saved=true` = zachowaj na zawsze, dopóki user ręcznie nie usunie
- Brak auto-title (user może nadać własny, default = "{source} {data}")
- Brak wyszukiwania w sesjach (może v2)
- Brak eksportu (może v2)

---

## Plan Task-Po-Task

### Task 0: Setup + decyzja o branchu

**Objective:** Ustal sposób pracy z dirty worktree, potwierdź że `original_prompt` jeszcze nie istnieje w db.

**Files:**
- Read: `src-tauri/src/db.rs` (linie 1-200)
- Read: `src-tauri/Cargo.toml`
- Run: `git status`, `git diff HEAD -- src-tauri/src/db.rs | head -50`

**Step 1:** Sprawdź czy `original_prompt` jest już w `generations` schema
```bash
cd "C:/Users/user/Documents/VIBELIFE2026/TTS_hub"
git diff HEAD -- src-tauri/src/db.rs | grep -E "original_prompt|chat_session|chat_message"
```

**Step 2:** Stwórz branch z aktualnego dirty stanu
```bash
cd "C:/Users/user/Documents/VIBELIFE2026/TTS_hub"
git stash push -u -m "wip: chat-window + roleplay dirty state"
git checkout -b feat/chat-window
git stash pop
# Dirty state wraca na branchu — git status pokaże wszystkie M + ??
```

**Step 3:** Commit roleplay osobno (atomic, żeby branch się różnił czysto od main)
```bash
cd "C:/Users/user/Documents/VIBELIFE2026/TTS_hub"
git add src/roleplay/ src-tauri/src/roleplay/ src/components/AppViewTabs.tsx src/App.tsx src/api/tauri.ts src/styles.css
git commit -m "wip: roleplay foundation (DAW multi-voice studio)"
```

**Step 4:** Sprawdź `tsc --noEmit` i `cargo check`
```bash
cd "C:/Users/user/Documents/VIBELIFE2026/TTS_hub"
npx tsc --noEmit 2>&1 | tail -20
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -20
```
Oczekiwane: zero błędów poza znanymi (node_modules/@types, ikony).

**Step 5:** Commit (jeśli są fixy)
```bash
git add -A
git commit -m "chore: pre-chat-window baseline on feat/chat-window"
```

**Verification:** `git log --oneline -5` — na szczycie feat/chat-window, poniżej main z rolplay commit.

---

### Task 1: Cargo.toml + package.json dependencies

**Objective:** Dodaj zależności potrzebne do chat features (UUID, chrono, tokio broadcast już są).

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Read: `package.json` (sprawdź czy ma react-virtuoso, dayjs, date-fns)

**Step 1:** Sprawdź czy potrzebujesz czegoś nowego
```bash
cd "C:/Users/user/Documents/VIBELIFE2026/TTS_hub"
grep -E "uuid|chrono|tokio|serde" src-tauri/Cargo.toml
```

**Większość rzeczy już jest.** Jeśli brakuje `uuid` v4 features — dodaj:
```toml
[dependencies]
uuid = { version = "1", features = ["v4", "serde"] }
```

**Step 2:** Frontend deps (prawie nic nie trzeba)
```bash
cd "C:/Users/user/Documents/VIBELIFE2026/TTS_hub"
grep -E "dayjs|date-fns|react-virtuoso" package.json
```
Jeśli brak i chcesz formatowanie dat: dodaj `dayjs` (lekki, 2KB). Jeśli lista sesji długa: react-virtuoso (ale YAGNI na start — zrobimy zwykłą listę).

**Step 3:** Build check
```bash
cd "C:/Users/user/Documents/VIBELIFE2026/TTS_hub"
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

**Step 4:** Commit
```bash
git add src-tauri/Cargo.toml package.json package-lock.json
git commit -m "chore: deps for chat-window (uuid v4 + dayjs)"
```

**Verification:** cargo check zielony.

---

### Task 2: DB schema — nowe tabele + ALTER generations

**Objective:** Dodaj `chat_sessions`, `chat_messages` + 3 kolumny do `generations`.

**Files:**
- Modify: `src-tauri/src/db.rs`

**Step 1:** Znajdź istniejący blok migracji w `db.rs` (okolica linii 155-180)
```bash
grep -n "CREATE TABLE\|CREATE INDEX\|ALTER TABLE" src-tauri/src/db.rs
```

**Step 2:** Dodaj do funkcji migracji (po istniejących CREATE) nowe bloki:
```rust
// === chat_sessions ===
conn.execute(
    "CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        title TEXT,
        created_at INTEGER NOT NULL,
        last_active_at INTEGER NOT NULL,
        is_saved INTEGER NOT NULL DEFAULT 0,
        message_count INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT
    )",
    [],
)?;
conn.execute(
    "CREATE INDEX IF NOT EXISTS idx_chat_sessions_source
     ON chat_sessions(source, last_active_at DESC)",
    [],
)?;
conn.execute(
    "CREATE INDEX IF NOT EXISTS idx_chat_sessions_saved
     ON chat_sessions(is_saved, last_active_at DESC)",
    [],
)?;

// === chat_messages ===
conn.execute(
    "CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        generation_id TEXT,
        created_at INTEGER NOT NULL,
        order_index INTEGER NOT NULL
    )",
    [],
)?;
conn.execute(
    "CREATE INDEX IF NOT EXISTS idx_chat_messages_session
     ON chat_messages(session_id, order_index ASC)",
    [],
)?;

// === ALTER generations (additive, idempotent) ===
for (col, ty) in [
    ("original_prompt", "TEXT"),
    ("chat_session_id", "TEXT REFERENCES chat_sessions(id) ON DELETE SET NULL"),
    ("chat_message_id", "TEXT REFERENCES chat_messages(id) ON DELETE SET NULL"),
] {
    let sql = format!("ALTER TABLE generations ADD COLUMN {} {}", col, ty);
    let _ = conn.execute(&sql, []);  // silent fail if column exists
}
```

**Step 3:** Update `GEN_SELECT` constant (linia 119) — dodaj 3 nowe kolumny na końcu:
```rust
const GEN_SELECT: &str = "... ui_color, original_prompt, chat_session_id, chat_message_id";
```

**Step 4:** Update `Generation` struct (linie 7-30) — dodaj 3 Option<String>:
```rust
#[serde(default)]
pub original_prompt: Option<String>,
#[serde(default)]
pub chat_session_id: Option<String>,
#[serde(default)]
pub chat_message_id: Option<String>,
```

**Step 5:** Update INSERT i row mapping (szukaj `INSERT INTO generations` i `row.get(...ui_color)`)
- Dodaj 3 nowe pola w tuple INSERT (?, ?, ?)
- Dodaj 3 nowe `row.get(idx)` w mapowaniu

**Step 6:** Test
```bash
cd "C:/Users/user/Documents/VIBELIFE2026/TTS_hub"
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -10
```
Oczekiwane: 0 errors.

**Step 7:** Commit
```bash
git add src-tauri/src/db.rs
git commit -m "feat(db): add chat_sessions, chat_messages tables + original_prompt column"
```

**Verification:** Apka startuje normalnie (Tauri migracja wykonuje się bez błędu), istniejące features działają (zero regression).

---

### Task 3: Nowy moduł `src-tauri/src/chat/` — types + db

**Objective:** Backend logika sesji i wiadomości.

**Files:**
- Create: `src-tauri/src/chat/mod.rs`
- Create: `src-tauri/src/chat/types.rs`
- Create: `src-tauri/src/chat/db.rs`

**Step 1: `types.rs`**
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSession {
    pub id: String,
    pub source: String,
    pub title: Option<String>,
    pub created_at: i64,
    pub last_active_at: i64,
    pub is_saved: bool,
    pub message_count: i64,
    pub metadata_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub session_id: String,
    pub role: String,           // "user" | "assistant" | "system"
    pub content: String,
    pub generation_id: Option<String>,
    pub created_at: i64,
    pub order_index: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateSessionReq {
    pub source: String,
    pub title: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateSessionReq {
    pub title: Option<String>,
    pub is_saved: Option<bool>,
}
```

**Step 2: `db.rs` — implementacja CRUD**
```rust
use rusqlite::{params, Connection};
use crate::chat::types::*;
use anyhow::Result;

pub fn create_session(conn: &Connection, source: &str, title: Option<&str>) -> Result<ChatSession> {
    let id = format!("sess_{}", uuid::Uuid::new_v4());
    let now = chrono::Utc::now().timestamp_millis();
    let default_title = title.map(String::from).unwrap_or_else(|| {
        let dt = chrono::DateTime::from_timestamp_millis(now)
            .map(|d| d.format("%Y-%m-%d %H:%M").to_string())
            .unwrap_or_else(|| "Nowa sesja".to_string());
        format!("{} {}", source, dt)
    });
    conn.execute(
        "INSERT INTO chat_sessions (id, source, title, created_at, last_active_at, is_saved, message_count)
         VALUES (?, ?, ?, ?, ?, 0, 0)",
        params![id, source, default_title, now, now],
    )?;
    Ok(ChatSession {
        id, source,
        title: Some(default_title),
        created_at: now, last_active_at: now,
        is_saved: false, message_count: 0, metadata_json: None,
    })
}

pub fn get_session(conn: &Connection, id: &str) -> Result<Option<ChatSession>> {
    let mut stmt = conn.prepare("SELECT id, source, title, created_at, last_active_at, is_saved, message_count, metadata_json FROM chat_sessions WHERE id = ?")?;
    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        Ok(Some(ChatSession {
            id: row.get(0)?, source: row.get(1)?, title: row.get(2)?,
            created_at: row.get(3)?, last_active_at: row.get(4)?,
            is_saved: row.get::<_, i64>(5)? != 0,
            message_count: row.get(6)?, metadata_json: row.get(7)?,
        }))
    } else { Ok(None) }
}

pub fn list_sessions(conn: &Connection, source: Option<&str>, saved_only: bool) -> Result<Vec<ChatSession>> {
    let mut sql = "SELECT id, source, title, created_at, last_active_at, is_saved, message_count, metadata_json FROM chat_sessions WHERE 1=1".to_string();
    let mut params_vec: Vec<&dyn rusqlite::ToSql> = vec![];
    if let Some(s) = source {
        sql += " AND source = ?";
        params_vec.push(&s);
    }
    if saved_only {
        sql += " AND is_saved = 1";
    }
    sql += " ORDER BY last_active_at DESC LIMIT 200";
    // ... analogicznie do get_session mapowanie
    // TODO implementacja mapowania (zostawiam jako szkielet)
    todo!("implementacja mapowania wierszy")
}

pub fn add_message(conn: &Connection, session_id: &str, role: &str, content: &str, generation_id: Option<&str>) -> Result<ChatMessage> {
    let id = format!("msg_{}", uuid::Uuid::new_v4());
    let now = chrono::Utc::now().timestamp_millis();
    let order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(order_index), 0) + 1 FROM chat_messages WHERE session_id = ?",
        params![session_id], |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO chat_messages (id, session_id, role, content, generation_id, created_at, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![id, session_id, role, content, generation_id, now, order],
    )?;
    conn.execute(
        "UPDATE chat_sessions SET last_active_at = ?, message_count = message_count + 1 WHERE id = ?",
        params![now, session_id],
    )?;
    Ok(ChatMessage { id, session_id: session_id.into(), role: role.into(), content: content.into(), generation_id: generation_id.map(String::from), created_at: now, order_index: order })
}

pub fn list_messages(conn: &Connection, session_id: &str) -> Result<Vec<ChatMessage>> {
    let mut stmt = conn.prepare("SELECT id, session_id, role, content, generation_id, created_at, order_index FROM chat_messages WHERE session_id = ? ORDER BY order_index ASC")?;
    let rows = stmt.query_map(params![session_id], |row| {
        Ok(ChatMessage {
            id: row.get(0)?, session_id: row.get(1)?, role: row.get(2)?,
            content: row.get(3)?, generation_id: row.get(4)?,
            created_at: row.get(5)?, order_index: row.get(6)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

pub fn update_session(conn: &Connection, id: &str, title: Option<&str>, is_saved: Option<bool>) -> Result<()> {
    if let Some(t) = title {
        conn.execute("UPDATE chat_sessions SET title = ? WHERE id = ?", params![t, id])?;
    }
    if let Some(s) = is_saved {
        conn.execute("UPDATE chat_sessions SET is_saved = ? WHERE id = ?", params![s as i64, id])?;
    }
    Ok(())
}

pub fn delete_session(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM chat_sessions WHERE id = ?", params![id])?;
    Ok(())
}

pub fn cleanup_unsaved_older_than(conn: &Connection, max_age_ms: i64) -> Result<usize> {
    let cutoff = chrono::Utc::now().timestamp_millis() - max_age_ms;
    let n = conn.execute(
        "DELETE FROM chat_sessions WHERE is_saved = 0 AND last_active_at < ?",
        params![cutoff],
    )?;
    Ok(n)
}
```

**Step 3: `mod.rs`**
```rust
pub mod db;
pub mod types;
```

**Step 4:** Dodaj `mod chat;` w `lib.rs`

**Step 5:** Test
```bash
cd "C:/Users/user/Documents/VIBELIFE2026/TTS_hub"
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -10
```

**Step 6:** Commit
```bash
git add src-tauri/src/chat/ src-tauri/src/lib.rs
git commit -m "feat(chat): backend types + DB CRUD"
```

**Verification:** cargo check zielony.

---

### Task 4: Tauri commands dla chat

**Objective:** Expose chat operations jako Tauri invoke commands (frontend może wołać).

**Files:**
- Modify: `src-tauri/src/chat/commands.rs` (nowy)
- Modify: `src-tauri/src/commands.rs` lub `lib.rs` (rejestracja)

**Step 1: `src-tauri/src/chat/commands.rs`**
```rust
use tauri::State;
use crate::AppState;
use crate::chat::{db, types::*};

#[tauri::command]
pub fn chat_create_session(state: State<AppState>, source: String, title: Option<String>) -> Result<ChatSession, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::create_session(&db, &source, title.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn chat_list_sessions(state: State<AppState>, source: Option<String>, saved_only: Option<bool>) -> Result<Vec<ChatSession>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::list_sessions(&db, source.as_deref(), saved_only.unwrap_or(false)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn chat_get_session(state: State<AppState>, id: String) -> Result<Option<ChatSession>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::get_session(&db, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn chat_list_messages(state: State<AppState>, session_id: String) -> Result<Vec<ChatMessage>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::list_messages(&db, &session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn chat_update_session(state: State<AppState>, id: String, title: Option<String>, is_saved: Option<bool>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::update_session(&db, &id, title.as_deref(), is_saved).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn chat_delete_session(state: State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_session(&db, &id).map_err(|e| e.to_string())
}
```

**Step 2:** Rejestracja w `lib.rs` (znajdź `generate_handler!`)
```rust
mod chat;
use chat::commands::*;
// ...
.invoke_handler(tauri::generate_handler![
    // ...istniejące...
    chat_create_session,
    chat_list_sessions,
    chat_get_session,
    chat_list_messages,
    chat_update_session,
    chat_delete_session,
])
```

**Step 3:** Test
```bash
cd "C:/Users/user/Documents/VIBELIFE2026/TTS_hub"
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

**Step 4:** Commit
```bash
git add src-tauri/src/chat/commands.rs src-tauri/src/lib.rs
git commit -m "feat(chat): tauri commands for sessions/messages"
```

**Verification:** cargo check 0 errors.

---

### Task 5: HTTP API — nowe endpointy + rozszerzenie /generate

**Objective:** Zewnętrzne API (curl/Hermes/Cursor) może tworzyć sesje i dodawać `original_prompt`.

**Files:**
- Modify: `src-tauri/src/http_api.rs`

**Step 1:** Dodaj 8 nowych routes (po istniejących w Router::new)
```rust
.route("/chat/sessions", get(chat_list_sessions).post(chat_create_session_http))
.route("/chat/sessions/:id", get(chat_get_session_http).patch(chat_update_session_http).delete(chat_delete_session_http))
.route("/chat/sessions/:id/messages", get(chat_list_messages_http).post(chat_add_message_http))
.route("/chat/sessions/:id/replay/:message_id", post(chat_replay_message_http))
.route("/chat/sources", get(chat_list_sources_http))
```

**Step 2:** Implementacja handlerów (każdy ~10-20 LOC)
```rust
async fn chat_create_session_http(
    State(state): State<AppState>,
    Json(req): Json<CreateSessionReq>,
) -> Result<Json<ChatSession>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db::create_session(&db, &req.source, req.title.as_deref())
        .map(Json).map_err(|e| e.to_string())
}
// ... analogicznie dla reszty
```

**Step 3:** Modyfikuj istniejący `generate` handler:
- Dodaj do request struct pola `original_prompt`, `chat_session_id`, `chat_role` (wszystkie Option)
- Po insert do `generations`, jeśli `chat_session_id` podany:
  - Sprawdź czy sesja istnieje (`db::get_session`)
  - Jeśli NIE → auto-create z source="unknown" (lub z nowego pola `source`?)
  - Wstaw user message (z `original_prompt`) + assistant message (z `text`)
  - Zapisz `chat_session_id` i `chat_message_id` w `generations`
- Emit Tauri event `chat:message_added` (broadcast z payload)

**Step 4:** Test
```bash
cd "C:/Users/user/Documents/VIBELIFE2026/TTS_hub"
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

**Step 5:** Manual curl test (po uruchomieniu apki):
```bash
curl -X POST http://127.0.0.1:8765/chat/sessions \
  -H "Content-Type: application/json" \
  -d '{"source":"hermes","title":"Test"}'
# Oczekiwane: {"id":"sess_...","source":"hermes",...}

curl -X POST http://127.0.0.1:8765/generate \
  -H "Content-Type: application/json" \
  -d '{"text":"Cześć","model":"minimax:speech-2.8-hd","voice":"wojciech_mann","format":"mp3","original_prompt":"użyj manna","chat_session_id":"sess_..."}'
# Oczekiwane: standard response z generacją, plus w chat_messages są 2 wpisy

curl http://127.0.0.1:8765/chat/sessions/sess_.../messages
# Oczekiwane: tablica 2 messages (user + assistant)
```

**Step 6:** Commit
```bash
git add src-tauri/src/http_api.rs
git commit -m "feat(api): /chat/* endpoints + /generate accepts original_prompt"
```

**Verification:** 3 powyższe curls zwracają poprawne dane, appka się nie crashuje.

---

### Task 6: Frontend — TypeScript wrappers + ChatView component

**Objective:** Nowa zakładka "Chat" w AppViewTabs, komponent wyświetlający sesje.

**Files:**
- Create: `src/chat/types.ts`
- Create: `src/chat/ChatView.tsx`
- Create: `src/chat/MessageBubble.tsx`
- Create: `src/chat/SessionList.tsx`
- Create: `src/chat/hooks.ts`
- Modify: `src/api/tauri.ts` (dodaj wrappers)
- Modify: `src/components/AppViewTabs.tsx` (dodaj 4-ty tab "Chat")
- Modify: `src/App.tsx` (renderuj ChatView gdy view="chat")

**Step 1: `src/chat/types.ts`**
```typescript
export interface ChatSession {
  id: string;
  source: string;
  title: string | null;
  created_at: number;
  last_active_at: number;
  is_saved: boolean;
  message_count: number;
  metadata_json: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  generation_id: string | null;
  created_at: number;
  order_index: number;
}
```

**Step 2: `src/api/tauri.ts` — dodaj na końcu**
```typescript
import type { ChatSession, ChatMessage } from "./chat/types";

export async function chatCreateSession(source: string, title?: string): Promise<ChatSession> {
  return invoke("chat_create_session", { source, title });
}
export async function chatListSessions(source?: string, savedOnly = false): Promise<ChatSession[]> {
  return invoke("chat_list_sessions", { source, savedOnly });
}
// ... itd dla reszty komend
```

**Step 3: `src/chat/hooks.ts`**
```typescript
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import * as api from "../api/tauri";
import type { ChatSession, ChatMessage } from "./types";

export function useSessions(source?: string) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const refresh = () => api.chatListSessions(source).then(setSessions);
  useEffect(() => {
    void refresh();
    const un = listen<{ session_id: string }>("chat:session_changed", () => { void refresh(); });
    return () => { un.then(u => u()); };
  }, [source]);
  return { sessions, refresh };
}

export function useMessages(sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    if (!sessionId) { setMessages([]); return; }
    void api.chatListMessages(sessionId).then(setMessages);
    const un = listen<{ session_id: string }>("chat:message_added", (e) => {
      if (e.payload.session_id === sessionId) {
        void api.chatListMessages(sessionId).then(setMessages);
      }
    });
    return () => { un.then(u => u()); };
  }, [sessionId]);
  return messages;
}
```

**Step 4: `src/chat/MessageBubble.tsx`** — wyświetla pojedynczą wiadomość
```tsx
import { usePlayback } from "../context/PlaybackContext";

interface Props { msg: ChatMessage; }

export default function MessageBubble({ msg }: Props) {
  const isUser = msg.role === "user";
  const { select } = usePlayback();
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
        isUser ? "bg-accent text-bg" : "bg-panel2 text-heading"
      }`}>
        <div className="text-xs opacity-60 mb-1">
          {isUser ? "Ty" : msg.role} • {new Date(msg.created_at).toLocaleTimeString()}
        </div>
        <div className="whitespace-pre-wrap">{msg.content}</div>
        {!isUser && msg.generation_id && (
          <button
            onClick={() => msg.generation_id && select(/* generation object */)}
            className="mt-2 text-xs underline hover:no-underline"
          >
            ▶ Odtwórz ponownie
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 5: `src/chat/SessionList.tsx`** — sidebar z listą sesji
```tsx
import type { ChatSession } from "./types";

interface Props {
  sessions: ChatSession[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export default function SessionList({ sessions, selectedId, onSelect, onCreate }: Props) {
  return (
    <div className="w-64 border-r border-border bg-panel flex flex-col">
      <div className="p-3 border-b border-border flex justify-between items-center">
        <span className="text-sm font-medium">Sesje</span>
        <button onClick={onCreate} className="text-xs bg-accent text-bg px-2 py-1 rounded">
          + Nowa
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.map(s => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left p-3 border-b border-border hover:bg-panel2 ${
              s.id === selectedId ? "bg-panel2" : ""
            }`}
          >
            <div className="text-sm font-medium truncate">{s.title ?? "(bez tytułu)"}</div>
            <div className="text-xs opacity-60 flex justify-between mt-1">
              <span>{s.source}</span>
              <span>{s.message_count} wiad.</span>
              {s.is_saved && <span>⭐</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 6: `src/chat/ChatView.tsx`** — główny widok
```tsx
import { useState } from "react";
import SessionList from "./SessionList";
import MessageBubble from "./MessageBubble";
import { useSessions, useMessages } from "./hooks";
import { chatCreateSession, chatUpdateSession, chatDeleteSession } from "../api/tauri";
import { invoke } from "@tauri-apps/api/core";

export default function ChatView() {
  const [source, setSource] = useState("hermes");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const { sessions, refresh } = useSessions();
  const messages = useMessages(activeSessionId);

  const handleCreate = async () => {
    const s = await chatCreateSession(source);
    await refresh();
    setActiveSessionId(s.id);
  };

  const handleToggleSaved = async () => {
    if (!activeSessionId) return;
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;
    await chatUpdateSession(activeSessionId, null, !session.is_saved);
    await refresh();
  };

  return (
    <div className="flex h-full">
      <SessionList
        sessions={sessions}
        selectedId={activeSessionId}
        onSelect={setActiveSessionId}
        onCreate={handleCreate}
      />
      <div className="flex-1 flex flex-col">
        <div className="p-3 border-b border-border flex items-center gap-3">
          <select value={source} onChange={e => setSource(e.target.value)} className="bg-panel2 px-2 py-1 rounded text-sm">
            <option value="hermes">Hermes Gateway</option>
            <option value="cursor">Cursor</option>
            <option value="opencode">OpenCode</option>
            <option value="custom">Custom</option>
          </select>
          {activeSessionId && (
            <>
              <button onClick={handleToggleSaved} className="text-sm">
                {sessions.find(s => s.id === activeSessionId)?.is_saved ? "⭐ Zapisana" : "☆ Zapisz"}
              </button>
              <button onClick={async () => {
                if (confirm("Usunąć sesję?")) {
                  await chatDeleteSession(activeSessionId);
                  setActiveSessionId(null);
                  await refresh();
                }
              }} className="text-sm text-red-400">🗑</button>
            </>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map(m => <MessageBubble key={m.id} msg={m} />)}
        </div>
      </div>
    </div>
  );
}
```

**Step 7: AppViewTabs.tsx** — dodaj "Chat" tab
```typescript
export type AppView = "tts" | "extensions" | "roleplay" | "chat";
// ... dodaj przycisk jak roleplay
```

**Step 8: App.tsx** — renderuj ChatView
```typescript
import ChatView from "./chat/ChatView";
// ... w AppInner switch:
if (appView === "chat") return <ChatView />;
```

**Step 9:** Test
```bash
cd "C:/Users/user/Documents/VIBELIFE2026/TTS_hub"
npx tsc --noEmit 2>&1 | tail -10
```

**Step 10:** Commit
```bash
git add src/chat/ src/api/tauri.ts src/components/AppViewTabs.tsx src/App.tsx
git commit -m "feat(chat): ChatView UI + 4th tab in AppViewTabs"
```

**Verification:** tsc zielony, apka startuje, po kliknięciu "Chat" pojawia się widok, można tworzyć sesję.

---

### Task 7: Auto-cleanup task + integracja z playback

**Objective:** Stare niezapisane sesje są usuwane po 7 dniach; replay message korzysta z istniejącego audio.

**Files:**
- Modify: `src-tauri/src/lib.rs` (dodaj tokio::spawn w .setup)
- Modify: `src-tauri/src/chat/commands.rs` (chat_replay_message Tauri command)
- Modify: `src/chat/MessageBubble.tsx` (handler dla replay)

**Step 1:** W `lib.rs` znajdź `.setup(|app| {...})` i dodaj:
```rust
let app_state = app.state::<AppState>();
let db_for_cleanup = app_state.db.clone();
tokio::spawn(async move {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3600));  // co godzinę
    loop {
        interval.tick().await;
        if let Ok(db) = db_for_cleanup.lock() {
            let _ = chat::db::cleanup_unsaved_older_than(&db, 7 * 24 * 3600 * 1000);  // 7 dni
        }
    }
});
```

**Step 2:** `chat_replay_message` Tauri command
```rust
#[tauri::command]
pub fn chat_replay_message(state: State<AppState>, session_id: String, message_id: String) -> Result<String, String> {
    // 1. Get message from chat_messages
    // 2. Get its generation_id
    // 3. Load generation file_path
    // 4. Return audio URL (frontend will use playbackAudioSrc)
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let generation_id: Option<String> = db.query_row(
        "SELECT generation_id FROM chat_messages WHERE id = ? AND session_id = ?",
        rusqlite::params![message_id, session_id],
        |r| r.get(0)
    ).optional().map_err(|e| e.to_string())?;
    generation_id.ok_or_else(|| "No audio for this message".to_string())
}
```

**Step 3:** Frontend `MessageBubble.tsx` — handler:
```tsx
const handleReplay = async () => {
  if (!msg.generation_id) return;
  const audioUrl = playbackAudioSrc(msg.generation_id);
  // Use existing PlaybackContext or new audio element
  const audio = new Audio(audioUrl);
  await audio.play();
};
```

**Step 4:** Test
```bash
cd "C:/Users/user/Documents/VIBELIFE2026/TTS_hub"
npx tsc --noEmit
cargo check --manifest-path src-tauri/Cargo.toml
```

**Step 5:** Commit
```bash
git add -A
git commit -m "feat(chat): auto-cleanup + replay uses existing audio"
```

**Verification:** Cleanup task nie crashuje, replay odtwarza istniejące audio.

---

### Task 8: Hermesa-side helper (opcjonalnie)

**Objective:** Żeby Hermes (lub inne źródło) łatwo korzystało z nowego API.

**Files:**
- Create: `C:/Users/user/scripts/ttshub_chat.py` (lub w existing scripts dir)

**Step 1:** Helper script
```python
import json
import urllib.request
from typing import Optional

API = "http://127.0.0.1:8765"

def chat_generate(text: str, voice: str, *, original_prompt: str = None, chat_session_id: str = None, **kwargs) -> dict:
    """Wyślij wiadomość do TTSHub z opcjonalnym chat context."""
    payload = {
        "text": text, "model": "minimax:speech-2.8-hd",
        "voice": voice, "format": "mp3", **kwargs,
    }
    if original_prompt:
        payload["original_prompt"] = original_prompt
    if chat_session_id:
        payload["chat_session_id"] = chat_session_id
    req = urllib.request.Request(f"{API}/generate", data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                                  headers={"Content-Type": "application/json; charset=utf-8"}, method="POST")
    return json.loads(urllib.request.urlopen(req).read())

def chat_session(session_id: str) -> dict:
    req = urllib.request.Request(f"{API}/chat/sessions/{session_id}")
    return json.loads(urllib.request.urlopen(req).read())

# Przykład użycia w Hermes sesji:
#   sess = requests.post(...).json()  # first time
#   chat_generate("Odpowiedź 1", "wojciech_mann", original_prompt="pytanie 1", chat_session_id=sess["id"])
#   chat_generate("Odpowiedź 2", "wojciech_mann", original_prompt="pytanie 2", chat_session_id=sess["id"])
```

**Step 2:** Dokumentacja w `docs/chat-api.md`

**Step 3:** Commit (jeśli w TTS_hub) lub osobno (jeśli w 123/scripts)

**Verification:** Skrypt działa, sesja tworzy się automatycznie, wiadomości lądują w DB.

---

### Task 9: E2E test + merge

**Objective:** Pełen flow od zera, merge do main.

**Step 1:** Uruchom appkę (`npm run tauri dev`)

**Step 2:** E2E manual test:
1. Otwórz zakładkę "Chat"
2. Kliknij "+ Nowa sesja" — sesja pojawia się w liście
3. Wklej `original_prompt` w polu input, wyślij
4. Sprawdź czy wiadomość pojawia się w widoku
5. Kliknij "Odtwórz ponownie" — audio gra
6. Kliknij "⭐ Zapisz" — sesja przeżywa restart
7. Restartuj appkę — zapisana sesja nadal jest
8. Niezapisana sesja znika

**Step 3:** Smoke test API:
```bash
curl -X POST http://127.0.0.1:8765/generate \
  -H "Content-Type: application/json" \
  -d '{"text":"test","model":"minimax:speech-2.8-hd","voice":"wojciech_mann","format":"mp3","original_prompt":"hello","chat_session_id":"sess_smoke"}'
# Then:
curl http://127.0.0.1:8765/chat/sessions/sess_smoke/messages
# Should show 2 messages
```

**Step 4:** Merge do main (po review Kuby)
```bash
cd "C:/Users/user/Documents/VIBELIFE2026/TTS_hub"
gh pr create --title "feat: chat window with sessions" --body "..."  # lub ręcznie
git checkout main
git merge --no-ff feat/chat-window
git push origin main
```

**Step 5:** Usuń branch
```bash
git branch -d feat/chat-window
```

---

## Pliki do zmiany (summary)

### Nowe pliki
- `src-tauri/src/chat/mod.rs`
- `src-tauri/src/chat/types.rs`
- `src-tauri/src/chat/db.rs`
- `src-tauri/src/chat/commands.rs`
- `src/chat/types.ts`
- `src/chat/ChatView.tsx`
- `src/chat/MessageBubble.tsx`
- `src/chat/SessionList.tsx`
- `src/chat/hooks.ts`
- `docs/chat-api.md`

### Modyfikowane
- `src-tauri/src/lib.rs` (rejestracja modułu + komendy + cleanup task)
- `src-tauri/src/db.rs` (DB schema)
- `src-tauri/src/http_api.rs` (nowe endpointy + rozszerzenie /generate)
- `src/api/tauri.ts` (TS wrappers)
- `src/components/AppViewTabs.tsx` (4-ty tab)
- `src/App.tsx` (renderuj ChatView)
- `package.json` (jeśli dodajemy dayjs)
- `src-tauri/Cargo.toml` (jeśli dodajemy uuid features)

## Testy / Walidacja

- **Unit (Rust):** nie dodajemy nowych testów w tym planie (YAGNI), cargo check + manual
- **Integration (TS):** tsc --noEmit musi przejść
- **E2E manual:** Task 9 krok 2
- **API smoke test:** Task 9 krok 3

## Ryzyka i kompromisy

1. **Race conditions** przy równoczesnym dodawaniu wiadomości do tej samej sesji — rozwiązanie: `BEGIN IMMEDIATE` transakcja w `add_message`. Pominięte w planie (YAGNI, realnie mało prawdopodobne).
2. **Storage bloat** — setki sesji × setki wiadomości = potencjalnie MB. Rozwiązanie: `message_count` cached, lazy load wiadomości, paginacja (v2).
3. **Migration failure** — jeśli user ma starą wersję DB, ALTER TABLE musi być idempotent (jest: `let _ = conn.execute(...)`).
4. **Cleanup zbyt agresywny** — 7 dni to dość krótko. Domyślnie OK, dajemy `is_saved` jako bezpiecznik.
5. **Brak realtime sync** między wieloma TTSHub instances (gdyby user miał otwarte 2 okna) — pominięte (YAGNI, mało prawdopodobne).
6. **Dirty worktree z rolplay** — zacommitowaliśmy go w Task 0 jako `wip`, więc branch ma czystą historię względem tego co nowe.

## Otwarte pytania (blokują implementację, wymagają odpowiedzi Kuby)

1. ✅ czy OK że chat to 4-ty tab w `AppViewTabs`?
2. ✅ czy OK że auto-cleanup po 7 dniach dla niezapisanych?
3. ✅ czy chat używa istniejącego `generations.audio` URL czy generuje nowy? (odpowiedź: reuse, patrz Task 7)
4. ⏳ czy dodać search/filter w sesjach? (rekomendacja: NIE, YAGNI)
5. ⏳ czy chat obsługuje multi-modal (obrazy w wiadomościach)? (rekomendacja: NIE v1, tylko text)
6. ⏳ eksport sesji do JSON/Markdown? (rekomendacja: NIE v1, ale plan w v2)
