/** Skrót README do ostatniego kroku onboardingu (nie pełny plik README). */
export const README_ONBOARDING_MARKDOWN = `## TTS Hub — szybki start

TTS Hub to **natywna aplikacja desktopowa** (Tauri 2), która zamienia tekst na mowę przez **Google Gemini TTS**, **MiniMax** lub lokalny **Voice Box**, z wygodnym UI po polsku.

### Podstawowy workflow

1. Wybierz **profil głosu** w lewym panelu (nowy profil: **Dodaj nowy profil** → zakładka **Głosy Minimax**).
2. Wklej tekst w **edytorze** i naciśnij **Ctrl+Enter** lub przycisk **Generuj**.
3. Odsłuchaj wynik na **pasku odtwarzania** — ostatnie generacje są też po prawej.

### Przydatne skróty

- **Ctrl+Enter** — dodaj do kolejki generacji
- **Ctrl+S** — zapisz bieżącą generację do archiwum
- **Ctrl+O** — otwórz plik tekstowy w edytorze
- **Edycja → Szybkie skróty…** — globalne hotkeye TTS (Windows)

### Lokalne API

Serwer HTTP działa pod adresem \`http://127.0.0.1:8765\` — tylko gdy aplikacja Tauri jest uruchomiona. Przydatne do skryptów, n8n, Cursora i własnych narzędzi.

### Więcej dokumentacji

Pełny README, integracja z Cursor, API HTTP i szybka konfiguracja providerów — w sekcji **Ustawienia → O programie** lub na GitHubie.
`;

export const README_GITHUB_URL = "https://github.com/xcwajdax/TTS_hub#readme";
