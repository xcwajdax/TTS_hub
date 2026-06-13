import { useState } from "react";
import { probeVoicebox } from "../../../api/tauri";
import type { ProbeResult } from "../../../api/tauri";
import ProbeStatus from "../../quickSetup/ProbeStatus";
import QuickSetupHelp from "../../quickSetup/QuickSetupHelp";

interface Props {
  baseUrl: string;
  effectiveUrl?: string;
  onBaseUrlChange: (v: string) => void;
}

export default function VoiceboxProviderSection({
  baseUrl,
  effectiveUrl,
  onBaseUrlChange,
}: Props) {
  const [probing, setProbing] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);

  const runTest = async () => {
    setProbing(true);
    setResult(null);
    try {
      const url = baseUrl.trim() || effectiveUrl || "http://127.0.0.1:17493";
      const r = await probeVoicebox(url);
      setResult(r);
    } catch (e) {
      setResult({ ok: false, message: String(e) });
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {effectiveUrl && !baseUrl.trim() ? (
        <p className="text-[11px] text-muted">
          Aktywny adres: <code className="text-[10px]">{effectiveUrl}</code>
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-xs text-muted">
        Adres serwera Voice Box
        <input
          className="field font-mono text-sm"
          value={baseUrl}
          onChange={(e) => onBaseUrlChange(e.target.value)}
          placeholder={effectiveUrl || "http://127.0.0.1:17493"}
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
      <QuickSetupHelp topic="voicebox" />
    </div>
  );
}
