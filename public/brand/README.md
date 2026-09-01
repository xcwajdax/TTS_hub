# Brand logo (web)

Zoptymalizowane assety z renderu C4D do UI i strony landing.

| Plik | Opis |
|------|------|
| `logo-spin.webm` | VP9 + alpha, 512×512, ~4 s pętla, ~256 KB |
| `logo-spin-poster.png` | Klatka 0 — fallback i `prefers-reduced-motion` |

Źródło (lokalnie, gitignored): `public/c4d/render/icon_simple 3.mov` (720×720 ARGB, 30 fps).

Regeneracja (z katalogu repo):

```powershell
$src = "public/c4d/render/icon_simple 3.mov"
$out = "public/brand"
ffmpeg -y -i $src -vf "scale=512:512:flags=lanczos" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 32 -row-mt 1 -an -loop 0 "$out/logo-spin.webm"
ffmpeg -y -i $src -vf "scale=512:512:flags=lanczos" -frames:v 1 -update 1 "$out/logo-spin-poster.png"
```

Kopia na stronę: `TTS_hub_site/assets/brand/`.
