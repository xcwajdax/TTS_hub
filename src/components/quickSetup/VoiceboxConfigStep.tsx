import VoiceboxProviderSection from "../settings/providers/VoiceboxProviderSection";

interface Props {
  baseUrl: string;
  onBaseUrlChange: (v: string) => void;
}

export default function VoiceboxConfigStep({ baseUrl, onBaseUrlChange }: Props) {
  return <VoiceboxProviderSection baseUrl={baseUrl} onBaseUrlChange={onBaseUrlChange} />;
}
