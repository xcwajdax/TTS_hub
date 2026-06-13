import { useCallback, useRef } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./tutorial.css";
import { TTS_TOUR_STEPS } from "./ttsTourSteps";

export function useProductTour() {
  const driverRef = useRef<Driver | null>(null);

  const destroyTour = useCallback(() => {
    driverRef.current?.destroy();
    driverRef.current = null;
  }, []);

  const startTour = useCallback(
    (onComplete: () => void) => {
      destroyTour();

      const driverObj = driver({
        showProgress: true,
        progressText: "{{current}} / {{total}}",
        nextBtnText: "Dalej",
        prevBtnText: "Wstecz",
        doneBtnText: "Zakończ tour",
        popoverClass: "tts-hub-tour-popover",
        overlayOpacity: 0.55,
        stagePadding: 8,
        stageRadius: 6,
        allowClose: true,
        steps: TTS_TOUR_STEPS,
        onDestroyed: () => {
          driverRef.current = null;
          onComplete();
        },
      });

      driverRef.current = driverObj;
      driverObj.drive();
    },
    [destroyTour],
  );

  return { startTour, destroyTour };
}
