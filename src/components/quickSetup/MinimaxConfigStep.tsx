import MinimaxProviderSection from "../settings/providers/MinimaxProviderSection";

interface Props {
  apiKey: string;
  envKeyAvailable: boolean;
  onApiKeyChange: (v: string) => void;
}

export default function MinimaxConfigStep(props: Props) {
  return <MinimaxProviderSection {...props} />;
}
