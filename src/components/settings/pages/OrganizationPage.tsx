import OrganizationSettingsPanel from "../../OrganizationSettingsPanel";

interface Props {
  onError: (m: string) => void;
  onChanged?: () => void;
}

export default function OrganizationPage({ onError, onChanged }: Props) {
  return (
    <div className="flex flex-col gap-6 text-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Archiwum / Foldery</h2>
        <p className="text-xs text-muted">
          Foldery, tagi i reguły automatycznego przypisywania generacji do folderów.
        </p>
      </header>

      <OrganizationSettingsPanel onError={onError} onChanged={onChanged} />
    </div>
  );
}
