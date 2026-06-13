import { useCallback, useEffect, useRef, useState } from "react";
import { getAppSettings, setAppSettings } from "../../api/tauri";
import { appSettingsViewToPayload } from "../../appSettings";
import type { AppView } from "../AppViewTabs";
import type { SettingsTabId } from "../settings/settingsTabs";
import QuickSetupWizard from "../quickSetup/QuickSetupWizard";
import OnboardingWelcome from "./OnboardingWelcome";
import TutorialReadmeFinish from "./TutorialReadmeFinish";
import { useProductTour } from "./useProductTour";

type OnboardingPhase = "hidden" | "welcome" | "quick_setup" | "tts_tour" | "readme_finish";

interface Props {
  onError: (message: string) => void;
  goToView: (view: AppView) => void;
  openSettingsTab: (tab: SettingsTabId) => void;
  /** Increment to restart from menu (Pomoc → Samouczek). */
  restartToken?: number;
}

export default function OnboardingOrchestrator({
  onError,
  goToView,
  openSettingsTab,
  restartToken = 0,
}: Props) {
  const [phase, setPhase] = useState<OnboardingPhase>("hidden");
  const { startTour, destroyTour } = useProductTour();
  const initialCheckDone = useRef(false);
  const lastRestartToken = useRef(restartToken);

  const markTutorialComplete = useCallback(async () => {
    try {
      const view = await getAppSettings();
      await setAppSettings({ ...appSettingsViewToPayload(view), ui_tutorial_completed: true });
    } catch (e) {
      onError(String(e));
    }
  }, [onError]);

  const dismissWelcome = useCallback(async () => {
    await markTutorialComplete();
    setPhase("hidden");
  }, [markTutorialComplete]);

  const advanceToTtsTour = useCallback(() => {
    goToView("tts");
    setPhase("tts_tour");
  }, [goToView]);

  const finishOnboarding = useCallback(async () => {
    await markTutorialComplete();
    destroyTour();
    setPhase("hidden");
  }, [destroyTour, markTutorialComplete]);

  const handleOpenAbout = useCallback(() => {
    openSettingsTab("about");
    void finishOnboarding();
  }, [finishOnboarding, openSettingsTab]);

  useEffect(() => {
    if (initialCheckDone.current) return;
    initialCheckDone.current = true;
    void getAppSettings().then((view) => {
      if (!view.ui_tutorial_completed) {
        setPhase("welcome");
      }
    });
  }, []);

  useEffect(() => {
    if (restartToken === 0 || restartToken === lastRestartToken.current) return;
    lastRestartToken.current = restartToken;

    void getAppSettings().then((view) => {
      if (view.quick_setup_completed) {
        goToView("tts");
        setPhase("tts_tour");
      } else {
        setPhase("welcome");
      }
    });
  }, [goToView, restartToken]);

  useEffect(() => {
    if (phase !== "tts_tour") return;

    const timer = window.setTimeout(() => {
      startTour(() => setPhase("readme_finish"));
    }, 350);

    return () => {
      window.clearTimeout(timer);
      destroyTour();
    };
  }, [destroyTour, phase, startTour]);

  if (phase === "hidden") return null;

  return (
    <>
      {phase === "welcome" && (
        <OnboardingWelcome onStart={() => setPhase("quick_setup")} onDismiss={() => void dismissWelcome()} />
      )}

      {phase === "quick_setup" && (
        <QuickSetupWizard
          mode="overlay"
          onClose={advanceToTtsTour}
          onSaved={advanceToTtsTour}
          onError={onError}
        />
      )}

      {phase === "readme_finish" && (
        <TutorialReadmeFinish
          onOpenAbout={handleOpenAbout}
          onFinish={() => void finishOnboarding()}
        />
      )}
    </>
  );
}
