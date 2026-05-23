import { useState } from "react";
import { probeGoogle } from "../../api/tauri";
import type { ProbeResult } from "../../api/tauri";
import QuickSetupHelp from "./QuickSetupHelp";
import ProbeStatus from "./ProbeStatus";

interface Props {
  apiKey: string;
  profileName: string;
  envKeyAvailable: boolean;
  onApiKeyChange: (v: string) => void;
  onProfileNameChange: (v: string) => void;
}

export default function GoogleConfigStep({
  apiKey,
  profileName,
  envKeyAvailable,
  onApiKeyChange,
  onProfileNameChange,
}: Props) {
  const [probing, setProbing] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);

  const runTest = async () => {
    setProbing(true);
    setResult(null);
    try {
      const key = apiKey.trim();
      if (!key && envKeyAvailable) {
        setResult({
          ok: true,
          message: "Używasz klucza z studios.env — test pominięty (brak klucza w formularzu).",
        });
        return;
      }
      const r = await probeGoogle(key);
      setResult(r);
    } catch (e) {
      setResult({ ok: false, message: String(e) });
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {envKeyAvailable && (
        <p className="text-xs text-green-400/90">
          Wykryto GOOGLE_API_KEY w pliku env. Możesz zostawić pole puste lub dodać profil z innym
          kluczem.
        </p>
      )}
      <label className="flex flex-col gap-1 text-xs text-muted">
        Nazwa profilu (opcjonalnie)
        <input
          className="field"
          value={profileName}
          onChange={(e) => onProfileNameChange(e.target.value)}
          placeholder="Profil Google"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Klucz API Google
        <input
          className="field font-mono text-sm"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder={envKeyAvailable ? "Puste = klucz z env" : "AIza…"}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn text-xs" onClick={() => void runTest()} disabled={probing}>
          {probing ? "Testuję…" : "Testuj połączenie"}
        </button>
        <ProbeStatus probing={probing} result={result} />
      </div>
      <QuickSetupHelp topic="google" />
    </div>
  );
}
