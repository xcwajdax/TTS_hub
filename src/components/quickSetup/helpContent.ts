import type { TtsProviderId } from "../../appSettings";

export type QuickSetupHelpTopic = "intro" | TtsProviderId;

export interface HelpSection {
  title: string;
  body: string;
  links?: { label: string; href: string }[];
}

export const QUICK_SETUP_HELP: Record<QuickSetupHelpTopic, HelpSection> = {
  intro: {
    title: "Szybka konfiguracja",
    body:
      "Wybierz providery TTS, których chcesz używać. W kolejnych krokach wkleisz klucze API lub adres serwera i uruchomisz test połączenia. Ustawienia zapisują się w profilu aplikacji (%APPDATA%\\TTS_hub). Plik studios.env nadal działa jako zapasowe źródło kluczy przy starcie.",
    links: [
      { label: "Pełna dokumentacja", href: "docs/QUICK_SETUP.md" },
    ],
  },
  google: {
    title: "Google Gemini TTS",
    body:
      "Wygeneruj klucz API w Google AI Studio i wklej go poniżej albo ustaw GOOGLE_API_KEY w studios.env w katalogu projektu. Test pobiera listę modeli TTS — przy błędzie zobaczysz komunikat HTTP z API.",
    links: [
      { label: "Google AI Studio — klucze API", href: "https://aistudio.google.com/apikey" },
      {
        label: "Cennik Gemini TTS",
        href: "https://ai.google.dev/gemini-api/docs/pricing?hl=pl",
      },
    ],
  },
  voicebox: {
    title: "Voice Box (lokalny)",
    body:
      "Voice Box to lokalny serwer HTTP z profilami głosu. Uruchom aplikację Voice Box na tym komputerze i podaj adres (domyślnie http://127.0.0.1:17493). Test wywołuje endpoint /health — upewnij się, że firewall nie blokuje portu.",
    links: [],
  },
  minimax: {
    title: "MiniMax Portal",
    body:
      "Klucz API z platform.minimax.io. Test nawiązuje krótkie połączenie WebSocket (bez generowania audio). Klucz możesz też ustawić jako MINIMAX_API_KEY w studios.env.",
    links: [{ label: "MiniMax Platform", href: "https://platform.minimax.io/" }],
  },
};
