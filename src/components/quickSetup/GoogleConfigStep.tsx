import GoogleProviderSection from "../settings/providers/GoogleProviderSection";

interface Props {
  apiKey: string;
  profileName: string;
  envKeyAvailable: boolean;
  onApiKeyChange: (v: string) => void;
  onProfileNameChange: (v: string) => void;
}

export default function GoogleConfigStep(props: Props) {
  return <GoogleProviderSection mode="wizard" {...props} />;
}
