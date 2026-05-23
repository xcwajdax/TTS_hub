# Szybka konfiguracja TTS Hub

Kreator **Szybka konfiguracja** pomaga włączyć providery TTS i zweryfikować połączenia przed pierwszą generacją.

## Gdzie uruchomić

| Wejście | Zachowanie |
|---------|------------|
| Pierwszy start | Baner u góry okna — **Rozpocznij** otwiera kreator w osobnym oknie; **Później** ukrywa baner i oznacza konfigurację jako zakończoną |
| Menu **Edycja → Szybka konfiguracja…** | Osobne okno kreatora |
| **Ustawienia → Ogólne → Szybka konfiguracja…** | To samo okno (zamyka modal ustawień) |

## Kroki

1. **Wybór providerów** — Google Gemini, Voice Box, MiniMax (minimum jeden).
2. **Konfiguracja per provider** — tylko zaznaczone; na każdym kroku panel **Pomocy** i przycisk **Testuj połączenie**.
3. **Zakończ** — zapis do `%APPDATA%\TTS_hub\settings.json` i natychmiastowe zastosowanie w aplikacji (bez restartu).

## Google Gemini

- Klucz: [Google AI Studio](https://aistudio.google.com/apikey) lub zmienna `GOOGLE_API_KEY` w `studios.env`.
- W aplikacji klucz może być w **profilu API** (zakładka Ogólne w ustawieniach zaawansowanych).
- Test wywołuje listę modeli TTS — przy błędnym kluczu zobaczysz komunikat HTTP (bez cichego fallbacku).

## Voice Box

- Lokalny serwer HTTP (domyślnie `http://127.0.0.1:17493`).
- Zmienna env: `VOICEBOX_BASE_URL` lub `VOICEBOX_URL` w `studios.env`.
- W kreatorze możesz nadpisać adres w `settings.json` (`voicebox_base_url`).
- Test: `GET {url}/health`.

## MiniMax Portal

- Klucz: [platform.minimax.io](https://platform.minimax.io/) lub `MINIMAX_API_KEY` w `studios.env`.
- W kreatorze klucz można zapisać w `settings.json` (`minimax_api_key`).
- Test: krótkie połączenie WebSocket (bez syntezy audio).

## Env vs ustawienia aplikacji

| Źródło | Kiedy używane |
|--------|----------------|
| `studios.env` / `.env` | Ładowane przy starcie backendu |
| `settings.json` | Nadpisuje env dla Voice Box URL i klucza MiniMax; Google przez profile API |

Pole w formularzu **puste** przy wykrytym kluczu z env oznacza „użyj env”; test można pominąć z komunikatem informacyjnym.

## Pole `enabled_providers`

Po zakończeniu kreatora lista providerów w lewym panelu TTS pokazuje tylko zaznaczone. Pusta lista = wszystkie trzy (kompatybilność wsteczna).

## Reset kreatora

W `%APPDATA%\TTS_hub\settings.json` ustaw `"quick_setup_completed": false` i uruchom aplikację ponownie.
