import { useState } from "react";
import QuickSetupWizard from "./QuickSetupWizard";

export default function QuickSetupApp() {
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <QuickSetupWizard mode="window" onError={setError} />
      {error && (
        <div className="fixed bottom-2 left-2 right-2 text-xs text-red-300 bg-red-950/90 border border-red-800 rounded px-2 py-1">
          {error}
        </div>
      )}
    </>
  );
}
