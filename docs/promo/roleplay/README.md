# Projekt Roleplay — film promocyjny

Gotowy szablon projektu audiobooka z trzema personami + lektorem.

## Pliki

| Plik | Opis |
|------|------|
| [voice-profiles.json](voice-profiles.json) | 4 profile głosów (Lektor, Twórca, Developer, Cursor) |
| [promo-project.json](promo-project.json) | Dokument TipTap + paleta kolorów + ID projektu |

## Szybki start

1. Uruchom TTS Hub (`npm run tauri dev` lub instalator).
2. **Zamknij aplikację** przed importem (skrypt zapisuje do SQLite i `settings.json`).
3. Uruchom:

```powershell
pwsh -File docs/promo/scripts/setup-roleplay-promo.ps1
```

4. Otwórz TTS Hub → zakładka **Roleplay** → projekt **„Film promocyjny TTS Hub”**.
5. Przypisz kolory w palecie do profili (powinny być już w ustawieniach).
6. Przejdź do **Podsumowanie** → **Generuj wszystko**.

## Persony i kolory

| Kolor | Persona | Profil |
|-------|---------|--------|
| `#facc15` | Lektor (hook, CTA) | Promo — Lektor |
| `#f472b6` | Twórca treści | Promo — Twórca |
| `#38bdf8` | Developer | Promo — Developer |
| `#4ade80` | Użytkownik Cursor | Promo — Cursor |

## Ręczna konfiguracja (bez skryptu)

1. **Ustawienia → Profile głosów** — dodaj 4 profile z `voice-profiles.json`.
2. **Roleplay → Nowy projekt** — nazwa: „Film promocyjny TTS Hub”.
3. W edytorze wklej tekst z sekcji `doc_json` w `promo-project.json` (lub zaimportuj przez DevTools — skopiuj `doc_json` do schowka i wklej w edytorze TipTap).
4. Paleta głosów: dodaj 4 wpisy z `palette` w `promo-project.json`.

## Po generacji

- Eksport segmentów: **Studio** → miks → WAV.
- Alternatywnie: `generate-promo-audio.ps1` generuje pliki bezpośrednio przez HTTP API (bez Roleplay).
