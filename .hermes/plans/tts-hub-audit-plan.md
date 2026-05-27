# Plan działania: Audyt i refaktor TTS Hub v0.1.0

> **Data:** 25 maja 2026  
> **Agent:** Buuch v4.20 (Hermes)  
> **Repozytorium:** `C:\Users\user\Documents\VIBELIFE2026\TTS_hub`  
> **Status:** PLAN DO AKCEPTACJI (nic zaimplementowane)

---

## 📋 Cel planu

Kompleksowy audyt kodu + plan naprawczy dla TTS Hub — aplikacji desktop TTS (Tauri 2 + React + Rust).  
Plan podzielony na fazy, od krytycznych bugów po usprawnienia.

---

## 🔴 FAZA 0: KRYTYCZNE BUGI (do naprawy NATYCHMIAST)

### 0.1 — 24-bit PCM zapis w `audio.rs` (linie 122-126)

**Problem:** `match tts.bits_per_sample { 16 => {…} _ => { for &b in &tts.pcm_bytes { writer.write_sample(b as i32)?; } } }`  
Dla 24-bit PCM (Google zwraca `audio/L24`), każdy bajt pisany jako osobny sample. Tylko 8-bit działa poprawnie w tej gałęzi.

**Fix:** Dodać osobny case dla `24` (3 bajty → i32), zachować `_` jako 8-bit fallback.

**Plik:** `src-tauri/src/audio.rs`  
**Priorytet:** 🔴 WYSOKI (zniekształcone audio dla 24-bit)

### 0.2 — `conn.lock().unwrap()` w `db.rs` (wszystkie metody)

**Problem:** Każda metoda `Db` woła `self.conn.lock().unwrap()`. Jeśli Mutex jest zatruty (panika w innym wątku), aplikacja panikuje przy każdym dostępie do bazy.

**Fix:** Użyć `lock().map_err()` lub własnego wrappera z recovery. Można też użyć `catch_unwind` w job_queue.

**Plik:** `src-tauri/src/db.rs`  
**Priorytet:** 🔴 WYSOKI (ryzyko panic w produkcji)

---

## 🟡 FAZA 1: WAŻNE BUGI I PROBLEMY BEZPIECZEŃSTWA

### 1.1 — CORS: `allow_origin(Any)` w `http_api.rs`

**Problem:** `CorsLayer::new().allow_origin(Any)` — każda strona WWW może fetchować `127.0.0.1:8765`. Ryzyko CSRF.

**Fix:** Zawęzić do `http://127.0.0.1:1420` (Vite dev) + `tauri://localhost` (Tauri runtime).

**Plik:** `src-tauri/src/http_api.rs:64-67`

### 1.2 — Potencjalny deadlock w `global_shortcuts.rs`

**Problem:** `settings.read()` → `plugins_state.read()` → `soundboard.write()` — łańcuch RwLock. Przy zbiegu okoliczności może być deadlock.

**Fix:** Zmniejszyć zakres locków, unikać trzymania read locka podczas próby write locka.

**Plik:** `src-tauri/src/global_shortcuts.rs`

### 1.3 — Race condition w `job_queue::set_max_concurrent`

**Problem:** Release `current_permits` lock → `acquire_many_owned().await` — async-unsafe gap.

**Fix:** Użyć atomics lub restrukturyzować sekwencję.

**Plik:** `src-tauri/src/job_queue.rs`

### 1.4 — Brak rate limitu na HTTP API

**Problem:** `/generate`, `/minimax/clone-voice`, `/text/filter` — żadnego limitu requestów.

**Fix:** Dodać prosty token-bucket lub middleware w axum.

**Plik:** `src-tauri/src/http_api.rs`

### 1.5 — Path traversal w `read_text_file`

**Problem:** Brak walidacji ścieżki — `../../windows/system32/config/sam` jest dozwolone.

**Fix:** Znormalizować ścieżkę i sprawdzić czy jest w dozwolonym katalogu.

**Plik:** `src-tauri/src/commands.rs`

### 1.6 — `foreground_tracker` detached thread bez shutdown

**Problem:** Wątek w pętli 40ms bez mechanizmu zakończenia. Blokuje clean shutdown.

**Fix:** Dodać `Arc<AtomicBool>` flagę stop.

**Plik:** `src-tauri/src/selection_capture.rs`

### 1.7 — `quick_setup_window::close` niszczy okno zamiast ukrywać

**Problem:** `window.close()` niszczy WebView, potem `get_webview_window()` zwraca `None`.

**Fix:** Użyć `window.hide()` zamiast `close()`.

**Plik:** `src-tauri/src/quick_setup_window.rs`

---

## 🟠 FAZA 2: INFRASTRUKTURA I KONFIGURACJA

### 2.1 — Brak `package-lock.json`

**Problem:** Deterministic builds nie są możliwe. Każde `npm install` może dać inne wersje.

**Fix:** `npm install --package-lock-only` → commitnąć `package-lock.json` do repo.

### 2.2 — Brak CI/CD (GitHub Actions)

**Problem:** Żadnego workflow — `cargo check`, `npm run build`, testy nie są automatycznie walidowane.

**Fix:** Dodać `.github/workflows/ci.yml` z:
- `cargo check` na Rust
- `npm ci && npm run build` na TypeScript
- Opcjonalnie: testy jednostkowe

### 2.3 — Zbyt szeroki `assetProtocol.scope`

**Problem:** `"scope": ["**"]` pozwala na dostęp do dowolnego pliku przez `http://asset.localhost/`.

**Fix:** Zawęzić do katalogów aplikacji: `["$APPDATA/TTS_hub/**", "$RESOURCE/**"]`

**Plik:** `src-tauri/tauri.conf.json`

### 2.4 — Uzupełnienie `.gitignore`

**Problem:** Brakuje: `.DS_Store`, `Thumbs.db`, `*.log`, `*.tsbuildinfo`

**Fix:** Dodać brakujące wpisy.

**Plik:** `.gitignore`

### 2.5 — Duplikacja kodu

- `position_bottom_right()` w `toast_window.rs` i `playback_toast_window.rs` — identyczna
- `truncate()` w `google.rs` i `voicebox.rs` — identyczna
- `reveal_path` i `open_folder` w `commands.rs` — bardzo podobne

**Fix:** Wyciągnąć do współdzielonych funkcji w helper module.

---

## 🔵 FAZA 3: USPRAWNIENIA KODU

### 3.1 — Dodanie timeoutu na WebSocket Minimax

**Problem:** Pętla `loop { read.next().await }` w minimax.rs może wisieć w nieskończoność.

**Fix:** Dodać `tokio::time::timeout()` na odczyt.

### 3.2 — Retry mechanizm dla transient failures

**Problem:** Google API 429 (rate limit) lub MiniMax WebSocket disconnect = permanent fail.

**Fix:** Dodać retry z exponential backoff (2-3 próby).

### 3.3 — Timeout na `oneshot` w pick_folder_dialog

**Problem:** Jeśli user anuluje dialog, `rx.await` wisi wiecznie.

**Fix:** Dodać `tokio::time::timeout()`.

### 3.4 — Niespójny error handling

**Problem:** `err()` helper vs inline `map_err(|e| format!("{e}")` w różnych miejscach.

**Fix:** Ustandaryzować — używać helpera `err()` wszędzie.

---

## 🟢 FAZA 4: FRONTEND (TypeScript/React)

(Po wstępnym skanie — frontend wygląda solidnie. Wymaga głębszej analizy, ale na szybko:)

### 4.1 — Potencjalne problemy wydajnościowe

- `AppInner` ma dużo stanu i `useCallback` na refresh — warto sprawdzić czy nie ma zbędnych re-renderów
- `HistorySidebar` może być ciężki przy dużej liczbie generacji — rozważyć wirtualizację (react-window)

### 4.2 — TypeScript

- Kilka miejsc z `any` zamiast konkretnych typów
- `useEffect` bez wszystkich dependency w array

---

## 📚 FAZA 5: DOKUMENTACJA

### 5.1 — Utworzenie `docs/CHANGELOG.md`

Zebrać historię zmian z `RELEASE_v0.1.0.md` i commit message.

### 5.2 — Aktualizacja `docs/PROJECT_GUIDELINES.md`

Po implementacji powyższych zmian:
- Dodać sekcję o CI/CD (jak już będzie)
- Zaktualizować listę znanych braków

### 5.3 — Aktualizacja `README.md`

- Dodać badge CI (po dodaniu GitHub Actions)
- Dodać sekcję "Contributing" z linkiem do PROJECT_GUIDELINES.md

### 5.4 — Aktualizacja vajb-tts skill

Odkryłem że `read_file` narzędzie renderuje długie linie mylnie — zaktualizować skill o tę lekcję.

---

## ⚡ PRIORYTETYZACJA

```
FAZA 0: 🔴 Krytyczne bugi       → NATYCHMIAST
FAZA 1: 🟡 Ważne bugi/security  → PO FAZIE 0
FAZA 2: 🟠 Infrastruktura        → RÓWNOLEGLE Z FAZĄ 1
FAZA 3: 🔵 Usprawnienia          → PO FAZIE 1-2
FAZA 4: 🟢 Frontend              → RÓWNOLEGLE Z FAZĄ 3
FAZA 5: 📚 Dokumentacja          → CIĄGLE
```

---

## ✅ ZALECENIA KOŃCOWE

1. **Nie ufać ślepo subagentom** — zweryfikowałem 3 krytyczne bugi zgłoszone przez subagenta i tylko 1 (audio.rs 32-bit) był prawdziwy. Google API key bug okazał się fałszywym alarmem przez mylne renderowanie długich linii w `read_file`.

2. **Dodać narzędzia weryfikacyjne** — hexdump (`xxd`) albo Python do dokładnego odczytu podejrzanych linii zamiast polegać na `read_file`.

3. **Frontend wymaga osobnego deep dive** — subagent timeoutnął, a wstępny skan nie wykazał oczywistych bugów, ale pełna analiza może ujawnić subtelne problemy.

4. **Uruchamianie `cargo check` przed każdym commitem** — kod się kompiluje, to dobry znak.

---

*Plan utworzony przez Buuch v4.20 · Hermes Agent · 25 maja 2026*