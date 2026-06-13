import { useState } from "react";
import { probeGoogle } from "../../../api/tauri";
import type { ProbeResult } from "../../../api/tauri";
import type { ApiProfile } from "../../../appSettings";
import ApiProfilesSection from "../components/ApiProfilesSection";
import ProbeStatus from "../../quickSetup/ProbeStatus";
import QuickSetupHelp from "../../quickSetup/QuickSetupHelp";

interface WizardProps {
  mode: "wizard";
  apiKey: string;
  profileName: string;
  envKeyAvailable: boolean;
  onApiKeyChange: (v: string) => void;
  onProfileNameChange: (v: string) => void;
}

interface SettingsProps {
  mode: "settings";
  profiles: ApiProfile[];
  activeId: string | null;
  envKeyAvailable: boolean;
  onActiveIdChange: (id: string | null) => void;
  onProfilesChange: (profiles: ApiProfile[]) => void;
}

type Props = WizardProps | SettingsProps;

export default function GoogleProviderSection(props: Props) {
  const [probing, setProbing] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);

  const envKeyAvailable =
    props.mode === "wizard" ? props.envKeyAvailable : props.envKeyAvailable;

  const runTest = async () => {
    setProbing(true);
    setResult(null);
    try {
      let key = "";
      if (props.mode === "wizard") {
        key = props.apiKey.trim();
      } else {
        const active = props.profiles.find((p) => p.id === props.activeId);
        key = active?.api_key.trim() ?? "";
      }
      if (!key && envKeyAvailable) {
        setResult({
          ok: true,
          message: "Używasz klucza z env — test pominięty (brak klucza w formularzu).",
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
      {props.mode === "wizard" ? (
        <>
          {props.envKeyAvailable ? (
            <p className="text-xs text-green-400/90">
              Wykryto GOOGLE_API_KEY w pliku env. Możesz zostawić pole puste lub dodać profil z
              innym kluczem.
            </p>
          ) : null}
          <label className="flex flex-col gap-1 text-xs text-muted">
            Nazwa profilu (opcjonalnie)
            <input
              className="field"
              value={props.profileName}
              onChange={(e) => props.onProfileNameChange(e.target.value)}
              placeholder="Profil Google"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Klucz API Google
            <input
              className="field font-mono text-sm"
              type="password"
              autoComplete="off"
              value={props.apiKey}
              onChange={(e) => props.onApiKeyChange(e.target.value)}
              placeholder={props.envKeyAvailable ? "Puste = klucz z env" : "AIza…"}
            />
          </label>
        </>
      ) : (
        <ApiProfilesSection
          profiles={props.profiles}
          activeId={props.activeId}
          envKeyAvailable={props.envKeyAvailable}
          onActiveIdChange={props.onActiveIdChange}
          onProfilesChange={props.onProfilesChange}
        />
      )}
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
      <QuickSetupHelp topic="google" />
    </div>
  );
}
