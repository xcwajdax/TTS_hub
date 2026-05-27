/** Chromium / WebView2: route AudioContext output to a specific device. */
interface AudioContext {
  setSinkId(sinkId: string): Promise<void>;
}

interface AudioContextConstructor {
  prototype: AudioContext;
}

/** System picker for audio output (Chromium 109+). */
interface MediaDevices {
  selectAudioOutput(): Promise<MediaDeviceInfo>;
}
