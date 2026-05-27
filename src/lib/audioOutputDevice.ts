import { isTauriApp } from "./tauriEnv";

export const OUTPUT_DEVICE_STORAGE_KEY = "tts-hub.playback.outputDeviceId";
export const NATIVE_DEVICE_ID_PREFIX = "native:";

export interface NativeAudioOutputDevice {
  id: string;
  label: string;
}

export type PrepareAudioOutputEnumerationResult = {
  unlocked: boolean;
  reason?: string;
};

let preparePromise: Promise<PrepareAudioOutputEnumerationResult> | null = null;

export interface AudioOutputDeviceInfo {
  deviceId: string;
  label: string;
  groupId: string;
}

export function supportsAudioOutputSelection(): boolean {
  return (
    typeof HTMLMediaElement !== "undefined" &&
    typeof HTMLMediaElement.prototype.setSinkId === "function"
  );
}

export function supportsAudioContextSinkSelection(): boolean {
  return (
    typeof AudioContext !== "undefined" &&
    typeof AudioContext.prototype.setSinkId === "function"
  );
}

export function supportsSelectAudioOutput(): boolean {
  return typeof navigator.mediaDevices?.selectAudioOutput === "function";
}

export function readStoredOutputDeviceId(): string {
  try {
    return window.localStorage.getItem(OUTPUT_DEVICE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveOutputDeviceId(deviceId: string): void {
  try {
    if (!deviceId) {
      window.localStorage.removeItem(OUTPUT_DEVICE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(OUTPUT_DEVICE_STORAGE_KEY, deviceId);
    }
  } catch {
    /* ignore */
  }
}

export function formatDeviceLabel(device: AudioOutputDeviceInfo): string {
  if (device.label.trim()) return device.label;
  if (device.deviceId === "default") return "Domyślne (systemowe)";
  if (device.deviceId === "communications") return "Komunikacja (systemowe)";
  const short = device.deviceId.slice(0, 12);
  return short ? `Wyjście ${short}…` : "Nieznane wyjście";
}

export function formatDeviceOptionLabel(device: AudioOutputDeviceInfo): string {
  return formatDeviceLabel(device);
}

export function deviceOptionKey(device: AudioOutputDeviceInfo, index: number): string {
  if (device.deviceId) return device.deviceId;
  return `output-${device.groupId}-${index}`;
}

function toOutputDeviceInfo(device: MediaDeviceInfo): AudioOutputDeviceInfo | null {
  if (device.kind !== "audiooutput") return null;
  return {
    deviceId: device.deviceId,
    label: device.label,
    groupId: device.groupId,
  };
}

/** Merge lists; later entries override labels for the same deviceId. */
export function mergeOutputDeviceLists(
  ...lists: AudioOutputDeviceInfo[][]
): AudioOutputDeviceInfo[] {
  const byId = new Map<string, AudioOutputDeviceInfo>();
  for (const list of lists) {
    for (const device of list) {
      const key = device.deviceId || `__empty__:${device.groupId}:${device.label}`;
      const existing = byId.get(key);
      if (!existing || (!existing.label && device.label)) {
        byId.set(key, device);
      }
    }
  }
  return [...byId.values()];
}

function sortOutputDevices(devices: AudioOutputDeviceInfo[]): AudioOutputDeviceInfo[] {
  const rank = (id: string) => {
    if (id === "default") return 0;
    if (id === "communications") return 1;
    return 2;
  };

  return [...devices].sort((a, b) => {
    const rankDiff = rank(a.deviceId) - rank(b.deviceId);
    if (rankDiff !== 0) return rankDiff;
    return formatDeviceLabel(a).localeCompare(formatDeviceLabel(b), "pl");
  });
}

export function isNativeOutputDeviceId(deviceId: string): boolean {
  return deviceId.startsWith(NATIVE_DEVICE_ID_PREFIX);
}

export function nativeLabelFromDeviceId(deviceId: string): string | null {
  if (!isNativeOutputDeviceId(deviceId)) return null;
  try {
    return decodeURIComponent(deviceId.slice(NATIVE_DEVICE_ID_PREFIX.length));
  } catch {
    return deviceId.slice(NATIVE_DEVICE_ID_PREFIX.length);
  }
}

function normalizeDeviceLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

function labelsMatch(a: string, b: string): boolean {
  const na = normalizeDeviceLabel(a);
  const nb = normalizeDeviceLabel(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function isUsableOutputDeviceId(deviceId: string): boolean {
  return (
    deviceId === "default" ||
    deviceId === "communications" ||
    deviceId.length > 0
  );
}

async function requestSpeakerSelectionPermission(): Promise<void> {
  if (!("permissions" in navigator)) return;
  try {
    await navigator.permissions.query({
      name: "speaker-selection" as PermissionName,
    });
  } catch {
    /* optional API */
  }
}

/** WebView2/Chromium hide output device IDs until mic/speaker permissions are granted. */
async function unlockAudioOutputEnumeration(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  await requestSpeakerSelectionPermission();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    for (const track of stream.getTracks()) track.stop();
    return true;
  } catch (err) {
    console.warn("[audio] getUserMedia unlock failed:", err);
    return false;
  }
}

async function enumerateWebAudioOutputs(): Promise<AudioOutputDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const raw = await navigator.mediaDevices.enumerateDevices();
  return raw
    .filter((d) => d.kind === "audiooutput")
    .map((d) => ({
      deviceId: d.deviceId,
      label: d.label,
      groupId: d.groupId,
    }))
    .filter((d) => isUsableOutputDeviceId(d.deviceId));
}

async function fetchNativeAudioOutputs(): Promise<AudioOutputDeviceInfo[]> {
  if (!isTauriApp()) return [];
  try {
    const { listNativeAudioOutputDevices } = await import("../api/tauri");
    const native = await listNativeAudioOutputDevices();
    return native.map((d) => ({
      deviceId: d.id,
      label: d.label,
      groupId: "native",
    }));
  } catch (err) {
    console.warn("[audio] list_native_audio_output_devices failed:", err);
    return [];
  }
}

function mergeNativeOutputs(
  web: AudioOutputDeviceInfo[],
  native: AudioOutputDeviceInfo[],
): AudioOutputDeviceInfo[] {
  const merged = [...web];
  for (const device of native) {
    if (merged.some((d) => d.deviceId === device.deviceId)) continue;
    if (merged.some((d) => labelsMatch(d.label, device.label))) continue;
    merged.push(device);
  }
  return merged;
}

/** Map native/cpal selection to Chromium sink id for setSinkId (by device label). */
export async function resolvePlaybackSinkId(storedDeviceId: string): Promise<string> {
  if (!storedDeviceId || !isNativeOutputDeviceId(storedDeviceId)) {
    return storedDeviceId;
  }

  const nativeLabel = nativeLabelFromDeviceId(storedDeviceId);
  if (!nativeLabel) return "";

  await prepareAudioOutputEnumeration(true);
  const web = await enumerateWebAudioOutputs();
  const match = web.find((d) => labelsMatch(d.label, nativeLabel));
  return match?.deviceId ?? "";
}

/** Reset cached prepare step (e.g. user clicked refresh). */
export function resetAudioOutputEnumerationPrepare(): void {
  preparePromise = null;
}

/**
 * Grants WebView2 mic permission (Tauri) and runs a short getUserMedia unlock
 * so enumerateDevices() returns real speaker IDs.
 */
export async function prepareAudioOutputEnumeration(
  force = false,
): Promise<PrepareAudioOutputEnumerationResult> {
  if (force) resetAudioOutputEnumerationPrepare();
  if (preparePromise) return preparePromise;

  preparePromise = (async (): Promise<PrepareAudioOutputEnumerationResult> => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return { unlocked: false, reason: "Przeglądarka nie udostępnia listy urządzeń audio." };
    }

    if (isTauriApp()) {
      try {
        const { prepareAudioDeviceEnumeration } = await import("../api/tauri");
        await prepareAudioDeviceEnumeration();
      } catch (err) {
        console.warn("[audio] prepare_audio_device_enumeration failed:", err);
      }
    }

    const micOk = await unlockAudioOutputEnumeration();
    if (!micOk) {
      return {
        unlocked: false,
        reason:
          "Brak dostępu do mikrofonu — WebView2 ukrywa listę głośników. Zezwól w Windows (Ustawienia → Prywatność → Mikrofon) lub użyj przycisku „Wybierz…”.",
      };
    }

    return { unlocked: true };
  })();

  return preparePromise;
}

export type ListAudioOutputDevicesResult = {
  devices: AudioOutputDeviceInfo[];
  prepare: PrepareAudioOutputEnumerationResult;
};

export async function listAudioOutputDevices(
  options?: { forcePrepare?: boolean },
): Promise<ListAudioOutputDevicesResult> {
  const empty = { devices: [] as AudioOutputDeviceInfo[], prepare: { unlocked: false } };

  if (!navigator.mediaDevices?.enumerateDevices) {
    return {
      ...empty,
      prepare: {
        unlocked: false,
        reason: "Przeglądarka nie udostępnia listy urządzeń audio.",
      },
    };
  }

  const prepare = await prepareAudioOutputEnumeration(options?.forcePrepare ?? false);

  let outputs = await enumerateWebAudioOutputs();
  const nonBuiltinCount = outputs.filter(
    (d) => d.deviceId !== "default" && d.deviceId !== "communications",
  ).length;

  if (nonBuiltinCount === 0) {
    const native = await fetchNativeAudioOutputs();
    outputs = mergeNativeOutputs(outputs, native);
  }

  return { devices: sortOutputDevices(outputs), prepare };
}

/** Opens the system audio-output picker and returns the chosen device. */
export async function pickSystemAudioOutput(): Promise<AudioOutputDeviceInfo | null> {
  if (!supportsSelectAudioOutput()) return null;
  try {
    const picked = await navigator.mediaDevices.selectAudioOutput();
    return toOutputDeviceInfo(picked);
  } catch {
    return null;
  }
}

export type ApplyAudioSinkResult = { ok: true } | { ok: false; message: string };

/**
 * Routes playback to the given output device (empty = system default).
 * When using Web Audio analyser graph, both element and AudioContext need setSinkId.
 */
export async function applyAudioSink(
  audio: HTMLMediaElement,
  audioContext: AudioContext | null | undefined,
  deviceId: string,
): Promise<ApplyAudioSinkResult> {
  if (!supportsAudioOutputSelection()) {
    return { ok: false, message: "Wybór wyjścia wymaga nowszego WebView2 Runtime." };
  }

  const sinkId = await resolvePlaybackSinkId(deviceId);
  if (isNativeOutputDeviceId(deviceId) && !sinkId) {
    return {
      ok: false,
      message:
        "Nie udało się powiązać urządzenia z odtwarzaczem. Kliknij „Wybierz” przy wyjściu lub odśwież listę po zezwoleniu na mikrofon.",
    };
  }

  try {
    await audio.setSinkId(sinkId);
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotFoundError") {
      return {
        ok: false,
        message: "Urządzenie wyjściowe nie jest dostępne. Odśwież listę lub wybierz domyślne.",
      };
    }
    return { ok: false, message: String(err) };
  }

  if (audioContext && supportsAudioContextSinkSelection()) {
    try {
      await audioContext.setSinkId(sinkId);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotFoundError") {
        return {
          ok: false,
          message: "Urządzenie wyjściowe nie jest dostępne. Odśwież listę lub wybierz domyślne.",
        };
      }
      return { ok: false, message: String(err) };
    }
  }

  return { ok: true };
}
