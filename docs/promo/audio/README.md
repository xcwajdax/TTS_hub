# Audio — film promocyjny

Pliki WAV generowane przez `generate-promo-audio.ps1` (TTS Hub API).

## Warianty

| Katalog | Segmenty | Użycie |
|---------|----------|--------|
| `social/` | 5 plików | Cut ≤60 s (9:16, 1:1) |
| `full/` | 5 plików | Pełna wersja 16:9 |
| *(root)* | `mann-ttshub-explainer-*.mp3` | Monolog Mann — skrót i pełna wersja (MiniMax `wojciech_mann`) |

Manifest głosów i tekstów: [segments.json](segments.json)

Scenariusz Manna: [../scripts/mann-ttshub-explainer.md](../scripts/mann-ttshub-explainer.md)

## Regeneracja

```powershell
# TTS Hub musi działać
pwsh -File docs/promo/scripts/generate-promo-audio.ps1
pwsh -File docs/promo/scripts/master-promo-audio.ps1
```

## Uwaga: Google TTS

Profile Roleplay używają Google (Kore/Charon) dla Lektora i Developera. Jeśli Google API zwraca 403, `segments.json` fallbackuje na MiniMax (szybkość 0.95–1.05 dla rozróżnienia person). Po przywróceniu dostępu Google — zaktualizuj manifest i wygeneruj ponownie.
