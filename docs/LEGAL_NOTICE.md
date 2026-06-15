# Legal notice — voice cloning and third-party likeness

**Effective:** 2026-06-16  
**Applies to:** [TTS Hub](https://github.com/xcwajdax/TTS_hub) repository and releases from this commit forward on `main`.

## Current policy

This project **does not ship, promote, or distribute commercial or public voice clones of identifiable third parties** (including likenesses of public figures, broadcasters, or politicians).

Supported demo and documentation voices are **public provider presets** (e.g. MiniMax `Polish_female_1_sample1`, `Polish_male_1_sample4`) and **Google Gemini TTS** system voices (e.g. `Kore`, `Charon`), or voices the user creates on their own account under applicable provider terms.

The application supports voice cloning as a **local, BYOK feature** (MiniMax API, Voicebox). Users are solely responsible for rights, consent, and compliance when cloning any voice.

## Historical context (archived in Git)

Earlier branches and commits in this repository contained **private, experimental voice clones** used only for internal testing (including references to Wojciech Mann and Grzegorz Braun). Those assets and active references were **removed from the current `main` branch on 2026-06-16** due to legal exposure and likeness concerns.

**Git history was intentionally not rewritten.** Older commits and feature branches may still mention those experiments or include removed files. That record is kept as **evidence of good-faith correction**, not as an endorsement or license to use those voices.

If you need a **clean public distribution** without historical clone artifacts, **fork to a new repository** or export from a current `main` snapshot — do not rely on rewriting this repository's history.

## What to do if you cloned this repo earlier

1. Do **not** use third-party likeness clones in public demos, marketing, or releases.
2. Remove any local clone audio or `voice_id` entries for non-consented third parties from your `%APPDATA%\TTS_hub\settings.json` (or app Settings → MiniMax voices).
3. Regenerate samples with public presets — see [docs/samples/README.md](samples/README.md).

## Contact

For rights or takedown concerns regarding this repository, open a GitHub issue or contact the maintainers listed in [LICENSE](../LICENSE) / repository metadata.
