import { useState } from "react";
import { newApiProfile, type ApiProfile } from "../../../appSettings";

interface Props {
  profiles: ApiProfile[];
  activeId: string | null;
  envKeyAvailable: boolean;
  onActiveIdChange: (id: string | null) => void;
  onProfilesChange: (profiles: ApiProfile[]) => void;
}

function ApiProfileCard({
  profile,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  profile: ApiProfile;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ApiProfile>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-border rounded-md bg-panel2/50 overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          className="flex-1 text-left text-sm hover:text-accent2"
          onClick={onToggle}
        >
          {profile.name}
          <span className="text-muted text-xs ml-2">{expanded ? "▾" : "▸"}</span>
        </button>
        <button
          type="button"
          className="btn text-xs hover:!bg-red-900/40"
          onClick={onRemove}
        >
          Usuń
        </button>
      </div>
      {expanded ? (
        <div className="px-2 pb-2 flex flex-col gap-2 border-t border-border">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Nazwa
            <input
              className="field"
              value={profile.name}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Klucz API
            <input
              className="field font-mono text-[11px]"
              type="password"
              value={profile.api_key}
              onChange={(e) => onChange({ api_key: e.target.value })}
              placeholder="AIza…"
              autoComplete="off"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

export default function ApiProfilesSection({
  profiles,
  activeId,
  envKeyAvailable,
  onActiveIdChange,
  onProfilesChange,
}: Props) {
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  const addProfile = () => {
    const profile = newApiProfile(`Profil ${profiles.length + 1}`);
    onProfilesChange([...profiles, profile]);
    onActiveIdChange(profile.id);
    setEditingProfileId(profile.id);
  };

  const removeProfile = (id: string) => {
    const next = profiles.filter((p) => p.id !== id);
    onProfilesChange(next);
    if (activeId === id) {
      onActiveIdChange(next[0]?.id ?? null);
    }
    if (editingProfileId === id) setEditingProfileId(null);
  };

  const updateProfile = (id: string, patch: Partial<ApiProfile>) => {
    onProfilesChange(profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-muted leading-relaxed">
        {envKeyAvailable
          ? "Wykryto GOOGLE_API_KEY w pliku env. Możesz użyć domyślnego klucza lub dodać własne profile."
          : "Brak GOOGLE_API_KEY w env — dodaj profil z kluczem API."}
        {activeId ? " Wybrany jest profil z listy." : " Używany jest klucz z env."}
      </p>
      <div className="flex items-center justify-between gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted flex-1">
          Aktywny klucz API
          <select
            className="field"
            value={activeId ?? ""}
            onChange={(e) => onActiveIdChange(e.target.value || null)}
          >
            <option value="">Domyślny z studios.env / .env</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn text-xs self-end shrink-0" onClick={addProfile}>
          Dodaj profil
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {profiles.length === 0 ? (
          <p className="text-xs text-muted">
            Brak dodatkowych profili — używany jest klucz z pliku env.
          </p>
        ) : (
          profiles.map((profile) => (
            <ApiProfileCard
              key={profile.id}
              profile={profile}
              expanded={editingProfileId === profile.id}
              onToggle={() =>
                setEditingProfileId((id) => (id === profile.id ? null : profile.id))
              }
              onChange={(patch) => updateProfile(profile.id, patch)}
              onRemove={() => removeProfile(profile.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
