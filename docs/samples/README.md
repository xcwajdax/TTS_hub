# Próbki audio (README)

Pliki są w repo i linkują się z głównego [README](../../README.md#-posłuchaj-próbki). GitHub **nie renderuje** tagu `<audio>` w README — używamy linków markdown do tych plików.

Ten sam tekst demo we wszystkich plikach:

> TTS Hub zamienia tekst na mowę na Twoim komputerze. Słuchasz właśnie tej samej próbki w kilku głosach. Wybierz provider i głos w ustawieniach albo przez lokalne API.

| Plik | Provider | Głos |
|------|----------|------|
| [minimax-grzegorz-braun.mp3](minimax-grzegorz-braun.mp3) | MiniMax | `grzegorz_braun` (klon — agent Buch) |
| [minimax-polish-female.mp3](minimax-polish-female.mp3) | MiniMax | `Polish_female_1_sample1` |
| [minimax-polish-male.mp3](minimax-polish-male.mp3) | MiniMax | `Polish_male_1_sample4` |
| [google-kore.wav](google-kore.wav) | Google Gemini TTS | `Kore` |
| [google-charon.wav](google-charon.wav) | Google Gemini TTS | `Charon` |

## Regeneracja

```powershell
# TTS Hub musi działać (npm run tauri dev)
pwsh -File docs/samples/generate-readme-samples.ps1
```

Koszt API ponosisz Ty (własne klucze w `studios.env` / ustawieniach aplikacji).
