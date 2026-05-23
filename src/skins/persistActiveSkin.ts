import { getAppSettings, setAppSettings } from "../api/tauri";

import { appSettingsViewToPayload } from "../appSettings";

import { isTauriApp } from "../lib/tauriEnv";



/** Persist skin choice immediately (Ustawienia → Wygląd). */

export async function persistActiveSkinId(skinId: string): Promise<void> {

  if (!isTauriApp()) return;

  const view = await getAppSettings();

  await setAppSettings({

    ...appSettingsViewToPayload(view),

    active_skin_id: skinId.trim() || view.active_skin_id,

  });

}

