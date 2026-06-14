import { createContext, useContext } from "react";
import type { AppView } from "../components/AppViewTabs";
import type { MinimaxVoicesSection } from "../components/minimaxVoicesSections";
import type { VoiceboxSection } from "../components/voicebox/voiceboxSections";
import type { SettingsTabId } from "../components/settings/settingsTabs";

export interface AppViewNav {
  /** Switch the top-level view in AppViewTabs. */
  goToView: (view: AppView) => void;
  /** Open the settings view on a specific tab. */
  openSettingsTab: (tab: SettingsTabId) => void;
  /** Open the Minimax voices view (optional sub-section, e.g. profile editor). */
  openMinimaxVoices: (section?: MinimaxVoicesSection) => void;
  /** Open the Voice Box management view. */
  openVoiceboxView: (section?: VoiceboxSection) => void;
  /** Convenience: jump back to TTS view. */
  onBackToTts: () => void;
}

export const AppViewContext = createContext<AppViewNav | null>(null);

export function useAppView(): AppViewNav {
  const ctx = useContext(AppViewContext);
  if (!ctx) {
    return {
      goToView: () => undefined,
      openSettingsTab: () => undefined,
      openMinimaxVoices: () => undefined,
      openVoiceboxView: () => undefined,
      onBackToTts: () => undefined,
    };
  }
  return ctx;
}
