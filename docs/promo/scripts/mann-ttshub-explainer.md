# TTS Hub — wypowiedź w stylu Wojciecha Manna

Głos: `wojciech_mann` · model: `minimax:speech-2.8-hd` · provider: MiniMax

Wygenerowane audio:

| Wersja | Plik | ID generacji |
|--------|------|----------------|
| Skrócona (~60 s) | [../audio/mann-ttshub-explainer-short.mp3](../audio/mann-ttshub-explainer-short.mp3) | `52859ed0-aaea-4cef-a5e7-2aaa58ccb278` |
| Pełna (~2,5 min) | [../audio/mann-ttshub-explainer-full.mp3](../audio/mann-ttshub-explainer-full.mp3) | `3b76948c-a6d1-4f6a-be0e-9d1c36e79390` |

Payloady API: `.tmp/mann-ttshub-explainer-short.json`, `.tmp/mann-ttshub-explainer.json`

MP4 (okładka WhatsApp): Historia → generacja → **Kopiuj MP4 do schowka** lub **Zapisz MP4 (WhatsApp)…**

Gotowe MP4 (ffmpeg, 720×720): [../video/mann-ttshub-explainer-short.mp4](../video/mann-ttshub-explainer-short.mp4), [../video/mann-ttshub-explainer-full.mp4](../video/mann-ttshub-explainer-full.mp4) — `pwsh docs/promo/scripts/render-mann-mp4.ps1`

---

## Wersja skrócona

Otóż, słuchaczu: TTS Hub zamienia tekst na mowę — na twoim komputerze. Google, MiniMax, lokalny Voice Box, API na localhost, integracja z Cursorem. Eksportuje też MP4 z okładką na WhatsAppa — bo samo audio to dziś za mało. Roadmapa: zero jeden zero już jest, w toku sidecar Voicebox, dalej MCP, routing audio, rozszerzenie do Cursora. Reklamę pchamy z legalnymi głosami polskich aktorów — nie ukradzionymi, nie bez licencji. Wielogłosowy spot promocyjny poczeka chwilę — najpierw porządek prawny, potem czterech narratorów na raz. Open source, twoje klucze API. Tekst przestaje być cichy.

---

## Wersja pełna

Otóż, słuchaczu: jest taki program — TTS Hub — i robi rzecz, którą ludzkość od wieków próbowała bez komputera: zamienia tekst na mowę. Nie w głowie czytelnika — na dźwięk, który można odsłuchać, zapisać albo wysłać skryptem z terminala, jeśli masz skłonności do automatyzacji.

To aplikacja na Windows, Mac i Linux — Rust z tyłu, React z przodu, Tauri, żeby okno nie ważyło jak mały samochód. W środku trzy providery: Google Gemini, MiniMax i lokalny Voice Box. Interfejs po polsku, profile głosu, historia, waveform, roleplay, czat głosowy, integracja z Cursorem i API na localhost, port 8765 — żeby skrypty i agenci mogli mówić za ciebie bez kopiowania i przełączania okien.

A teraz rzecz, którą docenią ci, którzy wysyłają nagrania na WhatsAppa zamiast czytać regulamin: TTS Hub eksportuje nie tylko WAV, MP3 i OGG, ale też MP4 — wideo z okładką, dźwiękiem i napisami, czasem nawet karaoke, gotowe do schowka albo na dysk. Bo w XXI wieku sam plik audio to za mało — trzeba jeszcze kwadratowy podgląd, żeby odbiorca wiedział, że to nie spam, tylko cywilizacja.

Roadmapa — bo każdy szanujący się produkt musi mieć plan, nawet jeśli życie go potem zmieni — wygląda tak: wersja zero jeden zero już jest — instalator na Windows, MIT, trzy skórki, Cursor, API. W toku fork backendu Voicebox, żeby lokalny TTS nie wymagał osobnej instalacji jak drugiego małżonka. Dalej: sidecar bez dodatkowych kroków, CI, testy API, rozszerzenie do VS Code i Cursora, routing audio, podpis kodu instalatora, serwer MCP. Ambitnie, ale bez obietnic, że jutro będzie teleport.

Co do reklamy — tu muszę być precyzyjny, bo w tej branży precyzja bywa rzadka jak uczciwość w polityce. Aplikację będziemy pchać z głosami polskich aktorów — legalnie, z licencją, nie ukradzionymi, nie sklonowanymi w piwnicy bez zgody. Bo TTS Hub to hub, nie pralnia głosów. Publiczny katalog, voice packi, promocja — tylko to, co ma autora, licencję i sensowny opis. Reszta zostaje u ciebie, na twoim komputerze, na twoją odpowiedzialność — jak powinno być.

Natomiast reklama multigłosowa — ta z czterema personami przekazującymi sobie pałeczkę jak w radiowym reportażu — poczeka chwilę. Scenariusz jest, roleplay jest, pliki audio czekają w folderze promo, ale montaż pełnego filmu z wieloma głosami to osobna operacja. Nie dlatego, że nie umiemy — dlatego, że najpierw chcemy mieć głosy, które nie budzą wątpliwości prawnych, a dopiero potem wielogłosowy spot, który brzmi jak zespół, a nie jak zebranie imitatorów.

Rdzeń open source, klucze API twoje. W skrócie: masz tekst, chcesz mowę, czasem chcesz MP4 na WhatsAppa — i tekst przestaje być cichy. A głos w reklamie będzie taki, żeby aktor nie musiał dzwonić do prawnika. To już coś.
