import VoiceboxProviderSection from "../settings/providers/VoiceboxProviderSection";
import type { VoiceboxServerMode } from "../../appSettings";

interface Props {
  baseUrl: string;
  serverMode: VoiceboxServerMode;
  effectiveUrl?: string;
  onBaseUrlChange: (v: string) => void;
  onServerModeChange: (mode: VoiceboxServerMode) => void;
}

export default function VoiceboxConfigStep({
  baseUrl,
  serverMode,
  effectiveUrl,
  onBaseUrlChange,
  onServerModeChange,
}: Props) {
  return (
    <VoiceboxProviderSection
      baseUrl={baseUrl}
      effectiveUrl={effectiveUrl}
      serverMode={serverMode}
      onBaseUrlChange={onBaseUrlChange}
      onServerModeChange={onServerModeChange}
    />
  );
}
