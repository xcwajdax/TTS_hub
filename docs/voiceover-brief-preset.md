# Preset voiceover — brief portfolio (TOPKEK)

Wbudowany workflow do nagrywania skryptów voiceover w stylu briefu portfolio (markdown z sekcjami, metadanymi produkcyjnymi i timestampami).

## Szybki start

1. Wklej skrypt briefu do edytora (np. `lyric-visualizer-brief-audio.md`).
2. Na pasku filtrów wybierz preset **Voiceover / brief portfolio** (`factory-voiceover-brief`).
3. Sprawdź podgląd **Tekst do syntezy** — znikną metadane (`Cel`, `Styl`, `Tempo`), nagłówki `## OTWARCIE (0:00…)` i notatki `## TIMING`; zostanie treść do przeczytania z pauzami `...` między akapitami.
4. Zaimportuj pakiet głosu **TOPKEK — brief portfolio PL** (Ustawienia → Profile głosu → Importuj pack lub [katalog voice packs](voice-packs/catalog.json)). Import ustawi też preset filtra.
5. Generuj. Szacowany czas mowy (~95 słów/min) widać w podglądzie obok liczby słów.

## Co robi preset filtra

- Usuwa blok metadanych produkcyjnych i tytuł `Brief audio — …`
- Usuwa separatory `---`, nagłówki sekcji z timestampami i notatki po `## TIMING`
- Zostawia cytaty w cudzysłowie (treść mówiona)
- Rozwija `**bold**` do zwykłego tekstu
- Wstawia pauzy ` ... ` między akapitami (przed finalnym scaleniem białych znaków)

## Pakiet głosu TOPKEK

| Parametr | Wartość |
|----------|---------|
| Provider | MiniMax `speech-2.8-hd` |
| Głos | `Polish_male_1_sample4` |
| Speed | `0.75` (~90–100 wpm — strojenie empiryczne) |
| Filtr | `factory-voiceover-brief` (auto przy imporcie) |

Jeśli masz własny klon w Voicebox, podmień profil głosu lokalnie — preset filtra zostaje ten sam.

## Budowa packa z repo

```powershell
pwsh docs/voice-packs/build-voice-packs.ps1
```

## Fallback

Gdy strict preset zwróci pusty wynik (np. cały brief w jednym bloku kodu w edytorze), TTS Hub automatycznie próbuje:

1. **Pełny tekst edytora** zamiast pustego filtered base
2. **Tryb relaxed** — bez reguł tabeli i agresywnego trim pauz
3. **Tryb minimal** — tylko meta, tytuł, TIMING+ i bold
4. **Surowy tekst** — ostatnia deska ratunku

W podglądzie pojawi się ostrzeżenie, np. „użyto trybu relaxed”.

```bash
npm test
```

Fixture: `src/lib/__fixtures__/voiceover-brief-sample.md` (parity TS + Rust).

## Dalsze kroki (planowane)

- Tryb kroków po sekcjach `##` (plan filtr tryb kroków)
- Multivoice per sekcja / rola (Roleplay + `synth_per_step`)
