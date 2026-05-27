import { useCallback, useEffect, useState } from "react";
import {
  listAudioOutputDevices,
  mergeOutputDeviceLists,
  pickSystemAudioOutput,
  readStoredOutputDeviceId,
  saveOutputDeviceId,
  supportsAudioOutputSelection,
  supportsSelectAudioOutput,
  type AudioOutputDeviceInfo,
} from "../lib/audioOutputDevice";

export function useAudioOutputDevices() {
  const [devices, setDevices] = useState<AudioOutputDeviceInfo[]>([]);
  const [outputDeviceId, setOutputDeviceIdState] = useState(readStoredOutputDeviceId);
  const [loading, setLoading] = useState(false);
  const [enumerationNotice, setEnumerationNotice] = useState<string | null>(null);
  const supported = supportsAudioOutputSelection();
  const canPickSystemOutput = supportsSelectAudioOutput();

  const refresh = useCallback(async (forcePrepare = false, silent = false) => {
    if (!supported) {
      setDevices([]);
      setEnumerationNotice(null);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const { devices: list, prepare: prep } = await listAudioOutputDevices({
        forcePrepare,
      });
      setDevices((prev) => mergeOutputDeviceLists(prev, list));
      if (list.length === 0 && prep.reason) {
        setEnumerationNotice(prep.reason);
      } else if (!prep.unlocked && prep.reason && list.every((d) => d.groupId === "native")) {
        setEnumerationNotice(
          `${prep.reason} Lista poniżej pochodzi z systemu Windows — po wyborze urządzenia odtwarzanie spróbuje je dopasować.`,
        );
      } else {
        setEnumerationNotice(null);
      }
    } finally {
      setLoading(false);
    }
  }, [supported]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!supported || typeof navigator.mediaDevices?.addEventListener !== "function") return;

    const onChange = () => void refresh(true);
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", onChange);
  }, [refresh, supported]);

  useEffect(() => {
    const onUnlock = () => void refresh(true);
    window.addEventListener("tts-hub-audio-unlock", onUnlock);
    return () => window.removeEventListener("tts-hub-audio-unlock", onUnlock);
  }, [refresh]);

  const setOutputDeviceId = useCallback((deviceId: string) => {
    setOutputDeviceIdState(deviceId);
    saveOutputDeviceId(deviceId);
  }, []);

  const pickSystemOutput = useCallback(async () => {
    const picked = await pickSystemAudioOutput();
    if (!picked) return null;
    setDevices((prev) => mergeOutputDeviceLists(prev, [picked]));
    setOutputDeviceId(picked.deviceId);
    await refresh();
    return picked;
  }, [refresh, setOutputDeviceId]);

  return {
    devices,
    outputDeviceId,
    setOutputDeviceId,
    loading,
    supported,
    canPickSystemOutput,
    refresh,
    pickSystemOutput,
    enumerationNotice,
  };
}
