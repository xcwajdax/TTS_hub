/** Copy for Voicebox as a separate server TTS Hub talks to — not in-app weights. */

export function voiceboxInstanceKindLabel(mode: string | null | undefined): string {
  switch ((mode ?? "").trim().toLowerCase()) {
    case "bundled":
      return "silnik wbudowany (TTS Hub uruchamia proces)";
    case "disabled":
      return "Voicebox wyłączony";
    default:
      return "zewnętrzna instancja Voicebox";
  }
}

export function voiceboxStorageHint(): string {
  return "Modele Chatterbox i TADA leżą na tym serwerze, nie w aplikacji TTS Hub. Hub tylko zleca pobieranie i syntezę.";
}

export function voiceboxHeaderStatusLine(opts: {
  reachable: boolean | null;
  baseUrl: string | null | undefined;
  healthStatus?: string | null;
  gpuLabel?: string | null;
  modelLoaded?: boolean | null;
}): string {
  const url = opts.baseUrl?.trim() || null;
  const parts: string[] = [];
  if (opts.reachable === true) {
    parts.push("Połączenie sprawne");
  } else if (opts.reachable === false) {
    parts.push("Brak połączenia");
  } else {
    parts.push("Voice Box niedostępny");
  }
  if (url) parts.push(url);
  if (opts.reachable === true) {
    if (opts.healthStatus) parts.push(opts.healthStatus);
    if (opts.gpuLabel) parts.push(opts.gpuLabel);
    if (opts.modelLoaded === true) parts.push("model załadowany");
    else if (opts.modelLoaded === false) parts.push("model niezaładowany");
  }
  return parts.join(" · ");
}
