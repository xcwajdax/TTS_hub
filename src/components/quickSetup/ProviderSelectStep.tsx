import ProviderEnableSection from "../settings/providers/ProviderEnableSection";
import QuickSetupHelp from "./QuickSetupHelp";
import type { TtsProviderId } from "../../appSettings";

interface Props {
  selected: TtsProviderId[];
  onChange: (next: TtsProviderId[]) => void;
}

export default function ProviderSelectStep({ selected, onChange }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <ProviderEnableSection selected={selected} onChange={onChange} />
      <QuickSetupHelp topic="intro" />
    </div>
  );
}
