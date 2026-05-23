# Skórki TTS Hub

TTS Hub obsługuje **skórki wyglądu** — paczki kolorów, czcionek i opcjonalnego CSS. Wbudowane skórki: **VIBELIFE** (domyślna), **Matrix** (zielono-czarna) i **Light / Zen** (jasny, kremowy UI).

## Format `skin.json`

Plik w katalogu skórki (np. `%APPDATA%/TTS_hub/skins/moja-skorka/skin.json`):

```json
{
  "id": "moja-skorka",
  "name": "Moja skórka",
  "version": "1.0.0",
  "author": "Jan Kowalski",
  "extends": "vibelife",
  "tokens": {
    "color-accent": "255 100 50",
    "color-bg": "10 10 12"
  },
  "css": "skin.css",
  "icons": {
    "filter": "brightness(0) invert(0.88)"
  },
  "registry": {
    "homepage": "https://example.com/skins/moja-skorka"
  }
}
```

### Pola

| Pole | Wymagane | Opis |
|------|----------|------|
| `id` | tak | Małe litery, cyfry, `_`, `-`; musi zgadzać się z nazwą folderu |
| `name`, `version`, `author` | tak | Metadane |
| `extends` | nie | Id wbudowanej skórki do dziedziczenia tokenów (`vibelife`) |
| `tokens` | nie | Nadpisania CSS — klucze bez `--`, wartości RGB triplets lub pełne CSS |
| `css` | nie | Plik dodatkowych reguł w tym samym folderze |
| `icons.filter` | nie | CSS `filter` dla `.vl-icon` |
| `registry` | nie | Metadane pod przyszły rejestr online (v1: bez pobierania) |
| `preferences` | nie | Domyślne zachowanie UI (np. `timeline_view`) — stosowane przy przełączeniu skórki |

### Tokeny kolorów (RGB triplets)

Używane przez Tailwind i komponenty canvas:

- `color-bg`, `color-panel`, `color-panel2`, `color-border`
- `color-accent`, `color-accent2`, `color-muted`, `color-text`
- `color-text-heading`, `color-bg-deep`, `color-code-bg`, …

Pełna lista domyślna: [`src/skins/builtin/vibelife.json`](../src/skins/builtin/vibelife.json).

### Preferencje (`preferences`)

Opcjonalny obiekt — nie trafia do CSS, tylko do logiki aplikacji przy aktywacji skórki:

| Klucz | Wartości | Opis |
|-------|----------|------|
| `timeline_view` | `bars`, `bars-detailed`, `line` | Domyślny wygląd dolnego timeline (słupki / słupki szczegółowe / linia fali) |

Przykład w `skin.json`:

```json
"preferences": {
  "timeline_view": "line"
}
```

Użytkownik może nadpisać wybór w **Ustawienia → Wygląd** lub menu pod **prawym przyciskiem** na timeline. Wartość jest też zapisywana w `settings.json` (`timeline_view`).

Tokeny specjalne (pełne wartości CSS):

- `font-ui`, `gradient-primary`, `glow-accent`, `glow-current`, `glow-playing`, `icon-filter`

## Instalacja

1. **Ustawienia → Wygląd → Importuj skórkę…** — wybierz plik `.ttskin` lub `.zip`
2. Lub skopiuj folder do `%APPDATA%/TTS_hub/skins/<id>/` (Windows)

## Eksport i udostępnianie

- Eksport działa dla skórek **własnych** (folder w `skins/`).
- Paczka `.ttskin` to ZIP z `skin.json` i opcjonalnymi plikami (`skin.css`, `preview.png`).
- Szablon autora: [`skins/_template/`](../skins/_template/)

## Rejestr online (przyszłość)

Pole `skin_registry_urls` w ustawieniach aplikacji jest przygotowane pod listę katalogów URL. W v1 nie pobiera skórek z sieci.

## Core UI poza skórkami

**Equalizer na żywo** (karta historii + popup odtwarzania) używa stałej palety w [`src/lib/playbackVizColors.ts`](../src/lib/playbackVizColors.ts) i klasy `.tts-playback-viz` — **nie** reaguje na tokeny skórki. Statyczny **timeline** w dolnym pasku (`WaveformPlayer`) korzysta z tokenów skórki (kolory) oraz trybu `timeline_view` (kształt: słupki / szczegółowe słupki / linia).

## Dobre praktyki

- Zachowaj kontrast tekstu (`color-text` na `color-bg`).
- Testuj historię i modale po zmianie `color-accent` / `color-accent2` (waveform odtwarzacza pozostaje bez zmian).
- Unikaj animacji pełnoekranowych — wpływają na czytelność i GPU.
