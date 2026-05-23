# Ocena gotowości do publikacji (GitHub)

**Data:** 2026-05-19 · **Wersja aplikacji:** 0.1.0

## Werdykt

| Obszar | Ocena | Uwagi |
|--------|-------|-------|
| **UI / UX** | ✅ Gotowe | Spójny dark mode, waveform, historia, próbki głosów — poziom „showcase”. |
| **Dokumentacja** | ✅ Gotowe | README, specyfikacja, API, zrzut ekranu w `docs/screenshots/`. |
| **Build release** | ❌ Bloker | `npm run build` kończy się błędem TS (`captureStream` na `HTMLAudioElement`). |
| **Repozytorium Git** | ⚠️ Do zrobienia | Brak commitów, brak `remote`, brak tagu wersji. |
| **Licencja** | ⚠️ Do decyzji | README wskazuje „projekt osobisty” — brak pliku `LICENSE`. |
| **Bezpieczeństwo / sekrety** | ✅ OK | `studios.env` w `.gitignore`, jest `studios.env.example`. |
| **Testy / CI** | ❌ Brak | Brak testów jednostkowych i workflow GitHub Actions. |
| **Dystrybucja** | ⚠️ Częściowo | `tauri build` niezweryfikowany w tej ocenie; wymaga naprawy frontend build. |

### Podsumowanie

**~70% gotowości** do publicznego repo na GitHubie jako **early preview / v0.1.0**.

Można opublikować **repozytorium z dokumentacją i kodem** już teraz, oznaczając release jako *pre-release*, pod warunkiem że w README wyraźnie zaznaczysz wymóg klucza API i ewentualny `ffmpeg`.

**Pełna gotowość „production release”** wymaga naprawy buildu TypeScript, wyboru licencji, pierwszego zielonego CI i opcjonalnie podpisanego instalatora.

---

## Checklist przed pierwszym push

### Must-have (blokery)

- [ ] Naprawić `src/context/PlaybackContext.tsx` — typy dla `captureStream` (rozszerzenie DOM lub guard + cast).
- [ ] Uruchomić `npm run build` i `npm run tauri build` bez błędów.
- [ ] `git init` / pierwszy commit, `git remote add`, push na GitHub.
- [ ] Wybrać licencję (np. MIT) i dodać `LICENSE`.
- [ ] Ustawić `"private": false` w `package.json` jeśli repo ma być publiczne.

### Should-have (jakość PR / repo)

- [x] README ze zrzutem ekranu.
- [x] `studios.env.example`.
- [x] Dokumentacja API i specyfikacji.
- [ ] 2–3 zrzuty: główny widok, archiwum z listą, modal ustawień.
- [ ] Sekcja „Known issues” w README (preview modele Google, limity API).
- [ ] `.github/pull_request_template.md` (szablon PR).

### Nice-to-have

- [ ] GitHub Actions: `npm ci`, `npm run build`, `cargo check` w `src-tauri`.
- [ ] Dependabot / Renovate.
- [ ] Releases z artefaktami MSI/EXE z Actions.
- [x] [PROJECT_GUIDELINES.md](PROJECT_GUIDELINES.md) — zasady pracy (zamiast CONTRIBUTING dla OSS).
- [ ] Usunięcie warningu Rust `dead_code` (`new_api_profile`).

---

## Ryzyka prawne i operacyjne

1. **Google Gemini TTS** — modele w stanie *preview*; API i cennik mogą się zmienić. W README warto podlinkować [Google AI Studio](https://aistudio.google.com/) i warunki użycia.
2. **Klucz API użytkownika** — aplikacja nie powinna logować kluczy; upewnij się, że profile API nie trafiają do issue/screenów.
3. **ffmpeg** — licencja LGPL/GPL zależnie od buildu; w README już jest jako opcjonalna zależność.

---

## Rekomendowany flow publikacji

1. Napraw build TS → zweryfikuj `tauri build`.
2. Commit + push + utwórz repo **public** lub **private** wg potrzeb.
3. Tag `v0.1.0` + GitHub Release (pre-release) z installerem.
4. Opcjonalnie: wpis na Discussions / README badge „Preview”.

---

## Co już jest na miejscu

- Dopracowany interfejs z waveformem i archiwum.
- Lokalne API na porcie 8765.
- Sensowny `.gitignore`.
- Zrzut ekranu produkcyjny: `docs/screenshots/main-window.png`.
