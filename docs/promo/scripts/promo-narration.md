# TTS Hub — scenariusz filmu promocyjnego

Trzy persony użytkowników przekazują sobie pałeczkę narracji. Głosy generowane w TTS Hub (patrz `voice-profiles.json`).

| Persona | Kolor Roleplay | Profil głosu | Provider |
|---------|----------------|--------------|----------|
| **Lektor** (hook + CTA) | `#facc15` | Promo — Lektor | Google Kore |
| **Twórca treści** | `#f472b6` | Promo — Twórca | MiniMax kobieta PL |
| **Developer** | `#38bdf8` | Promo — Developer | Google Charon |
| **Użytkownik Cursor** | `#4ade80` | Promo — Cursor | MiniMax mężczyzna PL |

SFX handoff: krótki whoosh (0,3 s) między personami — dodaj w montażu, nie w TTS.

---

## Wariant A — Social cut (≤60 s)

**Format docelowy:** 9:16 (1080×1920), opcjonalnie crop 1:1.  
**Słowa łącznie:** ~118 · **Szacowany czas mowy:** ~52 s + SFX/muzyka.

### Segment A0 — Hook · Lektor · 0:00–0:05

| | |
|---|---|
| **Obraz** | Logo TTS Hub na tle animowanego waveformu (gradient VIBELIFE `#7c5cff` → `#22d3ee`). Napisy: brak (tylko logo). |
| **Audio** | Cichnie muzyka lo-fi. |
| **Kwestia** | Masz tekst. Chcesz mowę. Na swoim komputerze. |
| **Plik audio** | `audio/social/00-hook-lektor.wav` |

---

### Segment A1 — Twórca · 0:05–0:20

| | |
|---|---|
| **Obraz** | Split: avatar „Twórca” (lewo) + Notepad → globalny hotkey → waveform w TTS Hub (prawo). Napisy on-screen: `3 providery`, `hotkey globalny`. |
| **Handoff in** | SFX whoosh po hooku. |
| **Kwestia** | Nagrywam podcasty i audiobooki. Zaznaczam fragment w dowolnym oknie — i słyszę go od razu w wybranym głosie. Google, MiniMax albo lokalny Voice Box. Ale mój kolega woli API… |
| **Plik audio** | `audio/social/01-tworca.wav` |
| **Handoff out** | Ostatnie słowo „API…” + whoosh. |

---

### Segment A2 — Developer · 0:20–0:35

| | |
|---|---|
| **Obraz** | Terminal: `curl http://127.0.0.1:8765/generate` → szybki cut na zakładkę Soundboard. Napisy: `localhost`, `REST API`, `BYOK`. |
| **Kwestia** | Jeden endpoint na localhost. Skrypt, n8n, bot — generacja, historia, próbki. Hotkeye działają w każdym programie. A w Cursorze Agent czyta mi podsumowania… |
| **Plik audio** | `audio/social/02-developer.wav` |

---

### Segment A3 — Cursor · 0:35–0:50

| | |
|---|---|
| **Obraz** | Cursor Agent Chat z blokiem `<!-- tts-summary -->` → autoplay w TTS Hub (integracja Cursor). Napisy: `@tts-hub-speak`, `po polsku`. |
| **Kwestia** | Agent kończy turę — aplikacja czyta na głos po polsku. Bez kopiowania, bez przełączania okien. |
| **Plik audio** | `audio/social/03-cursor.wav` |

---

### Segment A4 — CTA · Lektor · 0:50–1:00

| | |
|---|---|
| **Obraz** | Hero mockup + przycisk „Pobierz”. Tekst on-screen: `TTS Hub · MIT · BYOK` oraz `Pełna wersja → link w bio`. |
| **Kwestia** | TTS Hub — darmowy rdzeń open source, Twoje klucze API. Pełna wersja — link w bio. |
| **Plik audio** | `audio/social/04-cta-lektor.wav` |

---

## Wariant B — Pełna wersja (2:45–3:15)

**Format docelowy:** 16:9 (1920×1080). Rozdziały YouTube poniżej.

### B0 — Intro · Lektor · 0:00–0:20 · Rozdział: Intro

| | |
|---|---|
| **Obraz** | Jak A0, potem fade-in głównego okna aplikacji (skórka VIBELIFE). |
| **Kwestia** | Masz tekst. Chcesz mowę. Na swoim komputerze. TTS Hub to natywna aplikacja desktopowa — Tauri, interfejs po polsku, wersja preview zero jeden zero. Zamienia tekst na mowę przez Google Gemini TTS, MiniMax i lokalny Voice Box. Zobacz, jak trzech użytkowników korzysta z tego na co dzień. |
| **Plik audio** | `audio/full/00-intro-lektor.wav` |

---

### B1 — Twórca · 0:20–1:10 · Rozdział: Twórca treści

| | |
|---|---|
| **Obraz — sekwencja** | |
| 0:20–0:35 | Hotkey demo (Notepad → TTS Hub), jak A1 |
| 0:35–0:50 | Edytor blokowy + filtry tekstu (podgląd przed generacją) |
| 0:50–1:00 | Waveform, seek, historia sesji + archiwum |
| 1:00–1:05 | Profile głosów z avatarami; batch próbek |
| 1:05–1:10 | Teaser Roleplay (multi-głos, 5 s) |
| **Kwestia** | Jestem twórcą treści — podcasty, lektorstwo, audiobooki. W TTS Hub wklejam tekst albo zaznaczam fragment w dowolnym oknie i od razu słyszę wynik. Mam Google, MiniMax i Voice Box w jednym miejscu — przełączam providera, gdy mi pasuje. Filtry tekstu usuwają kod i cytaty zanim generuję, a waveform z seekiem pozwala słuchać fragmentów bez eksportu. Historia sesji i archiwum trzymają wszystko w SQLite — wracam do wcześniejszych nagrań jednym kliknięciem. Profile głosów z avatarami pamiętają moje ulubione ustawienia. A gdy robię dialogi wielogłosowe — wchodzę w Roleplay. Gdy mam dziesiątki plików dziennie, wchodzi API… |
| **Plik audio** | `audio/full/01-tworca.wav` |

---

### B2 — Developer · 1:10–2:00 · Rozdział: Developer

| | |
|---|---|
| **Obraz — sekwencja** | |
| 1:10–1:25 | Terminal: `GET /health`, `POST /generate`, odpowiedź JSON |
| 1:25–1:40 | Edycja → Szybkie skróty — konfiguracja globalnego hotkeya |
| 1:40–1:52 | Soundboard: 8 slotów, `Ctrl+Shift+1` |
| 1:52–2:00 | Szybka konfiguracja providerów (kreator) |
| **Kwestia** | Ja automatyzuję. TTS Hub wystawia REST API na localhost — bez auth, tylko na mojej maszynie. Jeden POST na generate, historia, audio, próbki głosów — skrypt, n8n albo własny bot. Globalne hotkeye działają w każdym oknie Windows: zaznaczony tekst, skrót, gotowe. Soundboard daje mi osiem slotów z historii lub dysku — Ctrl Shift i cyfra. Szybka konfiguracja prowadzi przez Google, MiniMax i Voice Box krok po kroku. A gdy pracuję w Cursorze z Agentem… |
| **Plik audio** | `audio/full/02-developer.wav` |

---

### B3 — Cursor · 2:00–2:45 · Rozdział: Cursor

| | |
|---|---|
| **Obraz — sekwencja** | |
| 2:00–2:15 | Ustawienia → Integracja Cursor (głos, autoplay) |
| 2:15–2:30 | Skill `@tts-hub-speak` w `.cursor/skills/` |
| 2:30–2:45 | Live: jedna tura Agent → marker `tts-summary` → odtworzenie w aplikacji |
| **Kwestia** | Pracuję w Cursorze z Agentem AI. Po każdej turze asystent owija podsumowanie w markery TTS Hub — i aplikacja czyta je na głos po polsku. Skill tts-hub-speak woła lokalne API; nie muszę nic kopiować. Wybieram głos w ustawieniach integracji — preset albo własny profil. Autoplay odpala audio w aplikacji, mogę słuchać w tle podczas kodowania. Trzy perspektywy — jedna aplikacja. Chcesz więcej szczegółów? |
| **Plik audio** | `audio/full/03-cursor.wav` |

---

### B4 — Zamknięcie · Lektor · 2:45–3:15 · Rozdział: Pobierz

| | |
|---|---|
| **Obraz — sekwencja** | |
| 2:45–2:55 | Tekst on-screen: rdzeń MIT gratis · BYOK |
| 2:55–3:05 | Linki pobierania Windows (NSIS + MSI) |
| 3:05–3:15 | Montaż 3 skórek: VIBELIFE → Matrix → Light Zen |
| **Kwestia** | TTS Hub — rdzeń aplikacji jest darmowy i open source na licencji MIT. Klucze API providerów są Twoje — płacisz bezpośrednio Google, MiniMax albo korzystasz lokalnie z Voice Box. Pobierz instalator dla Windows z GitHub Releases. Trzy skórki — VIBELIFE, Matrix i Light Zen — wybierz styl, który Ci pasuje. Link w opisie. |
| **Plik audio** | `audio/full/04-cta-lektor.wav` |

---

## Rozdziały YouTube (pełna wersja)

| Timestamp | Tytuł rozdziału |
|-----------|-----------------|
| 0:00 | Intro |
| 0:20 | Twórca treści |
| 1:10 | Developer i API |
| 2:00 | Integracja Cursor |
| 2:45 | Pobierz TTS Hub |

---

## Opis YouTube (szablon)

```
TTS Hub — desktopowa synteza mowy (Google · MiniMax · Voice Box) z lokalnym API i integracją Cursor.

Trzy persony, jedna aplikacja:
• Twórca treści — hotkeye, providery, Roleplay
• Developer — REST API localhost, soundboard, automatyzacja
• Użytkownik Cursor — podsumowania Agent Chat na głos po polsku

⏱ Rozdziały:
0:00 Intro
0:20 Twórca treści
1:10 Developer i API
2:00 Integracja Cursor
2:45 Pobierz TTS Hub

🔗 Pobierz: https://github.com/xcwajdax/TTS_hub/releases/tag/v0.1.0
📖 Dokumentacja: https://github.com/xcwajdax/TTS_hub

#TTS #TextToSpeech #Cursor #OpenSource #Polski
```

---

## Checklist montażu

- [ ] Muzyka lo-fi: −18 dB pod mową, ducking −6 dB przy kwestiach
- [ ] SFX whoosh przy każdym handoff (0:05, 0:20, 0:35, 0:50 w social)
- [ ] Napisy kluczowych hasek (BYOK, localhost, Cursor) — font Segoe UI
- [ ] Eksport social: H.264, 30 fps, audio AAC 192 kbps
- [ ] Eksport full: H.264, 60 fps (jeśli materiał ekranu 60 fps), −14 LUFS (skrypt `master-promo-audio.ps1`)
