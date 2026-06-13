import { useState } from "react";
import { probeMinimax } from "../../../api/tauri";
import type { ProbeResult } from "../../../api/tauri";
import ProbeStatus from "../../quickSetup/ProbeStatus";
import QuickSetupHelp from "../../quickSetup/QuickSetupHelp";

interface Props {
  apiKey: string;
  envKeyAvailable: boolean;
  effectiveConfigured?: boolean;
  onApiKeyChange: (v: string) => void;
  onOpenMinimaxVoices?: () => void;
}

export default function MinimaxProviderSection({
  apiKey,
  envKeyAvailable,
  effectiveConfigured,
  onApiKeyChange,
  onOpenMinimaxVoices,
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
          message: "Używasz klucza z env — test pominięty (brak klucza w formularzu).",
        });
        return;
      }
      const r = await probeMinimax(key);
      setResult(r);
    } catch (e) {
      setResult({ ok: false, message: String(e) });
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {envKeyAvailable ? (
        <p className="text-xs text-green-400/90">
          Wykryto MINIMAX_API_KEY w pliku env. Możesz zostawić pole puste lub nadpisać kluczem z
          formularza.
        </p>
      ) : effectiveConfigured ? (
        <p className="text-xs text-green-400/90">MiniMax jest skonfigurowany.</p>
      ) : null}
      <label className="flex flex-col gap-1 text-xs text-muted">
        Klucz API MiniMax
        <input
          className="field font-mono text-sm"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder={envKeyAvailable ? "Puste = klucz z env" : "Klucz z platform.minimax.io"}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn text-xs"
          onClick={() => void runTest()}
          disabled={probing}
        >
          {probing ? "Testuję…" : "Testuj połączenie"}
        </button>
        <ProbeStatus probing={probing} result={result} />
      </div>
      {onOpenMinimaxVoices ? (
        <button type="button" className="btn text-xs self-start" onClick={onOpenMinimaxVoices}>
          Zarządzaj głosami Minimax →
        </button>
      ) : null}
      <QuickSetupHelp topic="minimax" />
    </div>
  );
}
