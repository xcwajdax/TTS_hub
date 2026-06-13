import type { DriveStep } from "driver.js";

export const TTS_TOUR_STEPS: DriveStep[] = [
  {
    element: '[data-tour="app-tabs"]',
    popover: {
      title: "Zakładki aplikacji",
      description:
        "TTS to główny widok do syntezy mowy. Pozostałe zakładki — Historia, Roleplay, Czat, Rozszerzenia i Ustawienia — rozszerzają workflow w miarę rozwoju aplikacji.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="voice-sidebar"]',
    popover: {
      title: "Profile głosu",
      description:
        "Po lewej wybierasz zapisany profil do syntezy. Nowy profil dodajesz przyciskiem na dole listy — otworzy się edytor w zakładce Głosy Minimax.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="editor"]',
    popover: {
      title: "Edytor tekstu",
      description:
        "Wklej lub wpisz tekst do syntezy. Naciśnij Ctrl+Enter albo przycisk Generuj, aby dodać zadanie do kolejki.",
      side: "left",
      align: "start",
    },
  },
  {
    element: '[data-tour="queue"]',
    popover: {
      title: "Kolejka generacji",
      description:
        "Tutaj widać oczekujące i trwające zadania. W trybie bezpiecznym możesz zatwierdzać generacje przed syntezą.",
      side: "left",
      align: "start",
    },
  },
  {
    element: '[data-tour="playback"]',
    popover: {
      title: "Odtwarzacz",
      description:
        "Po wygenerowaniu audio odtwarzasz je tutaj — oś czasu z seekiem, metadane generacji, kontrola głośności i przycisk Tekst do podglądu pełnej treści.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="history-panel"]',
    popover: {
      title: "Ostatnie generacje",
      description:
        "Szybki dostęp do niedawnych wyników z bieżącej sesji. Pełne archiwum i foldery znajdziesz w zakładce Historia.",
      side: "left",
      align: "start",
    },
  },
];
