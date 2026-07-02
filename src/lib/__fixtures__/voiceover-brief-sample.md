# 🎙️ Brief audio — Lyric Visualizer × NEWSKIN × TOPKEK

**Cel:** voiceover do portfolio / social / pod premierę ALIVE 18.06
**Styl:** Kuba prywatnie, z przymrużeniem oka. Mniej korporacji, więcej życia.
**Tempo:** 90-100 wpm
**Długość:** ~2:30

---

## OTWARCIE (0:00 - 0:20)

Krótki brief o narzędziu które zrobiłem dla kumpla muzyka i trochę też dla siebie.

Nazywa się **Lyric Visualizer**. Bierze piosenkę, plik mp3, plus tekst, i robi zsynchronizowane słowa. Te które widzisz na Spotify jak leci karaoke — takie właśnie.

W przeglądarce, bez konta, bez instalacji. Ale to nie jest historia o apce. To jest historia o tym jak ją użyłem do realnej roboty.

---

## KONTEKST (0:20 - 1:00)

Utwór **ALIVE** zespołu **NEWSKIN**. Bartek to mój kumpel, muzyk, robi taki indie electronic. Premiera 18 czerwca, jak nagrywam to — za dwa dni.

Mam mastera mp3. Mam tekst od Bartka, bo w końcu go złapałem. Deadline'ów brak, deadline'y się same robią.

Odpaliłem **Whispera** — to taki AI co transkrybuje audio. Lokalnie, na moim kompie, nic nigdzie nie wysyła. I tu zaczyna się moja ulubiona część: Whisper wypluł „**Take brings me so down**" zamiast „**The ache brings me so down**". Klasyk. AI jest przekonane że wie lepiej i w połowie przypadków ma rację. W drugiej połowie zmyśla. Takie życie.

Dla porównania — drugi przebieg powiedział „**Cause I'm feeling light**" zamiast „**Cause I feel Alive**". Light. Light. Jakby piosenka o odczuwaniu żarówki. Brawo, modelu.

Ale dobra — Whisper zgadł timestamps, fuzzy align dopasował słowa do oficjalnego tekstu Bartka. To tyle roboty. **Dziesięć minut** od mastera do gotowego pliku.

---

## PO CO (1:00 - 1:40)

Tu jest sedno. Bo Bartek, jak każdy artysta indie, żeby dostać synced lyrics na Spotify musi przejść przez **Musixmatch**. Korporacja. Weryfikacja że jesteś artystą. Podpisanie umowy. Review tekstu. Tygodnie. Czasem w ogóle cię odrzucają bo jesteś za mały.

To znaczy: premierujesz singiel, a karaoke na TikToku, na Twitchu, na YouTube — odpada. Ludzie słuchają raz, zapominają, nie wracają.

Lyric Visualizer to obchodzi. Dziesięć minut, eksport do formatu który Spotify i Apple czytają, dystrybuujesz sam. Bez czekania, bez gatekeepera, bez podpisywania czegokolwiek z kimkolwiek kto ci mówi co robić z twoją własną muzyką.

Ktoś mógłby powiedzieć — **a po co w ogóle AI, skoro i tak trzeba ręcznie poprawiać halucynacje?** No właśnie. AI daje ci 80% roboty za darmo. Ty robisz 20% które wymaga człowieka. Kiedyś może to się odwróci. Na razie jest uczciwie.

---

## LUDZIE (1:40 - 2:10)

Trzy osoby, trzy różne rzeczy.

**Bartek** dał muzykę i tekst. Dał też feedback — pierwszą wersję z Whispera zobaczył, poprawił, odesłał. Bo to **jego** słowa. Whisper nie wie że „Alive" z capsem to celowy zabieg, a „light" to pomyłka.

**Grafik zespołu** jeszcze nie wchodzi w pipeline bezpośrednio, ale jak masz zsynchronizowane słowa, to otwiera się nowy level — **lyric video**. Trójwymiarowe, animowane, tła z koncertowych splatów, fonty, brand. To jest następny krok.

**Ja** — zrobiłem pipeline. Ale szczerze, najfajniejsze jest to że **nie jestem tu bohaterem**. Jestem narzędziem. Trochę jak Whisper — niby ja, a trochę halucynuję. Ale różnica jest taka że ja wiem kiedy, a on jeszcze nie.

---

## ZAMKNIĘCIE (2:10 - 2:35)

Więc. Jeśli jesteś artystą, muzykiem, ktoś kto wypuszcza muzykę — narzędzie jest open source, GitHub, w przeglądarce, za darmo. Whisper lokalnie, audio nigdzie nie wysyłasz.

Jeśli jesteś VJ albo motion designer — zsynchronizowane JSONy możesz brać i robić z nich live wizualizacje albo lyric video do YT. Też się da, też jest eksport.

A jeśli jesteś ciekawy jak to wygląda od środka — kod TypeScript, fuzzy align bez zależności, Three.js, IndexedDB. Wszystko co najmniej interesujące jest tam.

ALIVE wychodzi 18 czerwca. Lyric video wrzucam tego samego dnia. Linki w opisie.

Dzięki za uwagę. Do usłyszenia.

---

## TIMING

| Sekcja | Czas | Total |
|---|---|---|
| Otwarcie | 0:20 | 0:20 |
| Kontekst | 0:40 | 1:00 |
| Po co | 0:40 | 1:40 |
| Ludzie | 0:30 | 2:10 |
| Zamknięcie | 0:25 | 2:35 |

## MIEJSCA NA PAUZĘ

- 0:55 — po „**Take brings me so down**" vs „**The ache brings me so down**" → sekunda, daj słuchaczowi to zrozumieć
- 1:00 — przed „**Brawo, modelu**" → pauza na setup
- 1:35 — po „**uczciwie**" → zostaw to
- 2:08 — po „**a on jeszcze nie**" → uśmiech, sekunda

## CO NAGRYWAĆ PRZED

- Kawa, woda, spokój
- Tempo 90-100 wpm — wolniej niż myślisz
- **Mów do Bartka**, nie do publiczności
- Pierwszy take zawsze najgorszy — nagraj 3
- Wyjdź z pythona: „feeling light" powiedz z **przymrużeniem**, jakbyś cytował głupotę
