# Profile głosu, skróty, soundboard i wyjście audio

Ten dokument opisuje bieżące przepływy głosowe po stronie aplikacji Tauri. Obejmuje zapisane profile TTS, globalne skróty, wbudowany soundboard i wybór urządzenia odtwarzania.

## Mapa modułów

| Obszar | Frontend | Backend / stan |
|--------|----------|----------------|
| Profile głosu | `src/components/SaveVoiceProfileFooter.tsx`, `src/components/VoiceProfilesListPanel.tsx`, `src/lib/voiceProfiles.ts` | `src-tauri/src/voice_profiles.rs`, pole `voice_profiles` w `settings.json` |
| Skróty szybkiego TTS | `src/components/QuickHotkeysPanel.tsx`, `src/lib/voiceProfileShortcuts.ts` | `src-tauri/src/quick_hotkeys.rs`, global shortcut plugin Tauri |
| Soundboard | `src/plugins/soundboard/SoundboardPanel.tsx`, `src/plugins/useSoundboardPlugin.ts` | `src-tauri/src/plugins/soundboard.rs`, `src-tauri/src/global_shortcuts.rs` |
| Wyjście audio | `src/components/StatusBarAudioOutput.tsx`, `src/lib/audioOutputDevice.ts`, `src/context/PlaybackContext.tsx` | `src-tauri/src/audio_output_devices.rs`, `src-tauri/src/webview_media_permissions.rs` |

## Profile głosu

Profil głosu to zapisany zestaw parametrów TTS używany ponownie w UI i skrótach. Dane są przechowywane w `%APPDATA%\TTS_hub\settings.json` w polu `voice_profiles`.

Przykład skrócony:

```json
{
  "voice_profiles": [
    {
      "id": "uuid",
      "name": "Makłowicz - komentarz",
      "provider": "minimax",
      "model": "minimax:speech-2.8-hd",
      "voice": "robert_maklowicz",
      "style": "Mów po polsku, z lekkim żartem.",
      "profile_id": null,
      "language": "pl",
      "engine": null,
      "minimax_speed": 0.9,
      "minimax_vol": 1.0,
      "minimax_pitch": -2,
      "multi_speaker": false,
      "speakers": [],
      "shortcut": "F9",
      "shortcut_enabled": true
    }
  ]
}
```

### Co zapisuje profil

- `provider`: `google`, `voicebox` albo `minimax`.
- `model`, `voice`, `style`: podstawowe parametry syntezy.
- `profile_id`: tylko dla Voice Box; jest ID profilu Voice Box, nie ID profilu TTS Hub.
- `language`, `engine`: używane przez Voice Box i MiniMax według dostępnych pól providera.
- `minimax_speed`, `minimax_vol`, `minimax_pitch`: zakresy są normalizowane przez backend MiniMax (`speed` 0.5-2.0, `vol` 0-10, `pitch` -12-12).
- `multi_speaker` i `speakers`: obsługiwane tylko dla Google; dla MiniMax i Voice Box backend wyłącza multi-speaker.
- `last_preview` i `last_preview_at`: opcjonalny podgląd ostatniej generacji profilem, aktualizowany po użyciu profilu.
- `shortcut` i `shortcut_enabled`: skrót profilu synchronizowany z presetami szybkiego TTS.

### Użycie w UI

1. Ustaw parametry TTS w panelu ustawień.
2. W stopce panelu kliknij **Zapisz profil głosu**; opcjonalnie wpisz nazwę i skrót.
3. Lista profili pojawia się w panelu profili. Kliknięcie profilu uruchamia generację z tekstu edytora.
4. Prawy przycisk na profilu otwiera menu edycji. Dolna stopka listy pozwala zmienić skrót profilu.

## Skróty szybkiego TTS

Skróty globalne działają tylko, gdy aplikacja TTS Hub jest uruchomiona i w ustawieniach włączono master switch **Włącz globalne skróty szybkiego TTS**.

Przepływ wykonania:

1. Użytkownik zaznacza tekst w innym oknie.
2. Globalny skrót wywołuje `quick_hotkeys::run_preset`.
3. Aplikacja próbuje przechwycić zaznaczenie przez symulację kopiowania.
4. Preset buduje `GenerateReq` i dodaje generację do kolejki.
5. Jeśli preset wskazuje `voice_profile_id`, parametry z profilu mają pierwszeństwo przed parametrami zapisanymi bezpośrednio w presecie.

Ograniczenia:

- Przechwytywanie zależy od standardowego `Ctrl+C`; terminale, gry lub aplikacje blokujące schowek mogą nie zwrócić oczekiwanego tekstu.
- Skrót profilu zapisany w `voice_profiles` tworzy lub aktualizuje preset szybkiego TTS z tym samym `voice_profile_id`.
- Konflikty skrótów są wykrywane w UI; konflikt w soundboardzie jest oznaczany flagą `shortcutConflict`.
- Test skrótu w ustawieniach używa aktualnego zaznaczenia systemowego, więc przed testem trzeba zaznaczyć tekst.

## Soundboard

Soundboard jest wbudowanym rozszerzeniem z 8 slotami. Instalacja/włączenie rozszerzenia jest osobnym stanem od samej konfiguracji slotów.

### Stan i pliki

| Element | Lokalizacja / wartość |
|---------|------------------------|
| Konfiguracja slotów | `%APPDATA%\TTS_hub\plugins\soundboard.json` |
| Pliki przypisane ręcznie | `%APPDATA%\TTS_hub\plugins\soundboard\slot-{index}.{ext}` |
| Liczba slotów | `0`-`7` w API, `1`-`8` w UI |
| Domyślne skróty | `Ctrl+Shift+1` ... `Ctrl+Shift+8` |

Slot może wskazywać:

- generację z historii (`generation_id`) - odtwarzanie używa aktualnej ścieżki pliku z SQLite;
- plik z dysku (`file_path`) - backend kopiuje plik do katalogu soundboarda;
- pusty stan.

Odtworzenie slotu emituje zdarzenie `soundboard:play`, a frontend odtwarza klip przez osobny element audio. Główne odtwarzanie TTS jest pauzowane na czas uruchomienia klipu.

### HTTP API dla agentów

Szczegóły endpointów są w [API.md](API.md). Minimalny przykład:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8765/plugins/soundboard/slots/0" -Method Put `
  -ContentType "application/json" -Body '{"generation_id":"<uuid>"}'

Invoke-RestMethod -Uri "http://127.0.0.1:8765/plugins/soundboard/slots/0/play" -Method Post
```

Najczęstsze błędy:

- `Soundboard nie jest zainstalowany lub jest wyłączony` - włącz rozszerzenie w Hubie rozszerzeń lub panelu soundboarda.
- `Slot ... jest pusty` - przypisz generację albo plik.
- `Plik generacji nie istnieje` - wpis historii istnieje, ale plik audio został usunięty lub przeniesiony.

## Wybór wyjścia audio

Wybór głośnika działa przez Web Audio i `HTMLMediaElement.setSinkId`. W Tauri/WebView2 lista urządzeń bywa pusta, dopóki Chromium nie ma uprawnień do audio. Aplikacja próbuje więc:

1. wstępnie przyznać uprawnienia WebView2 po stronie Tauri;
2. wykonać krótkie `getUserMedia({ audio: true })`, zatrzymać strumień i odświeżyć `enumerateDevices()`;
3. na Windows użyć natywnej listy WASAPI przez `cpal`, jeśli lista Chromium nadal nie zawiera realnych wyjść;
4. dla natywnego ID `native:<encoded label>` dopasować urządzenie do sinka Chromium po etykiecie.

Wybór jest zapisywany w `localStorage` pod kluczem `tts-hub.playback.outputDeviceId`. Puste ID oznacza domyślne urządzenie systemowe.

### Ograniczenia i troubleshooting

- `setSinkId` wymaga nowszego WebView2/Chromium; gdy API nie istnieje, UI pokazuje tylko domyślne wyjście.
- Windows może ukrywać listę głośników bez zgody na mikrofon. Włącz dostęp w **Ustawienia Windows -> Prywatność -> Mikrofon** albo użyj przycisku **Wybierz**.
- Natywna lista Windows jest fallbackiem. Jeśli nazwa urządzenia z WASAPI nie dopasuje się do etykiety Chromium, odtwarzanie pokaże ostrzeżenie i trzeba wybrać urządzenie systemowym pickerem.
- Analizator waveform używa grafu Web Audio; gdy przeglądarka obsługuje `AudioContext.setSinkId`, aplikacja ustawia sink także na kontekście audio.
- Sam frontend Vite w przeglądarce nie ma komend Tauri (`prepare_audio_device_enumeration`, `list_native_audio_output_devices`), więc pełny test wyjść audio wykonuj w oknie Tauri.

## Minimalny test regresji

Po zmianach w tych przepływach sprawdź:

1. `npm run build`.
2. `npm run tauri dev`.
3. Zapis profilu głosu i generację z listy profili.
4. Skrót szybkiego TTS na zaznaczonym tekście.
5. Soundboard: przypisanie generacji do slotu, odtworzenie i konflikt skrótu.
6. Wyjście audio: odświeżenie listy, wybór domyślnego urządzenia i powrót do domyślnego systemowego.
