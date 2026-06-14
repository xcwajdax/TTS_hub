import { useState } from "react";
import type { VoiceBoxProfile } from "../../api/tauri";
import { useVoiceAvatar } from "../../hooks/useAvatars";
import ProviderAvatar from "../ProviderAvatar";
import VoiceboxProfileEditor from "./VoiceboxProfileEditor";

function VoiceboxProfileRowAvatar({ profile }: { profile: VoiceBoxProfile }) {
  const avatar = useVoiceAvatar("voicebox", profile.id);
  return (
    <ProviderAvatar
      provider="voicebox"
      filePath={avatar?.path ?? null}
      fallbackLabel={profile.name}
      size={40}
      className="shrink-0"
    />
  );
}

interface Props {
  profiles: VoiceBoxProfile[];
  onRefresh: () => void;
  onUseInTts: (profile: VoiceBoxProfile) => void;
  onAddToProfileList: (profile: VoiceBoxProfile) => void;
  hubProfileIds: Set<string>;
  onError: (m: string) => void;
  onSuccess?: (m: string) => void;
}

export default function VoiceboxProfilesSection({
  profiles,
  onRefresh,
  onUseInTts,
  onAddToProfileList,
  hubProfileIds,
  onError,
  onSuccess,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const editingProfile =
    editingId && !creating ? profiles.find((p) => p.id === editingId) ?? null : null;

  const closeEditor = () => {
    setEditingId(null);
    setCreating(false);
  };

  const handleSaved = (profile: VoiceBoxProfile) => {
    onRefresh();
    setEditingId(profile.id);
    setCreating(false);
  };

  if (creating || editingProfile) {
    return (
      <VoiceboxProfileEditor
        profile={creating ? null : editingProfile}
        isNew={creating}
        onSaved={handleSaved}
        onDeleted={closeEditor}
        onCancel={closeEditor}
        onError={onError}
        onSuccess={onSuccess}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary text-xs" onClick={() => setCreating(true)}>
          + Nowy profil
        </button>
        <button type="button" className="btn text-xs" onClick={() => onRefresh()}>
          Odśwież listę
        </button>
      </div>
      {profiles.length === 0 ? (
        <p className="text-xs text-muted">
          Brak profili na serwerze Voice Box. Utwórz pierwszy profil i dodaj próbki głosu.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {profiles.map((p) => (
            <li
              key={p.id}
              className="border border-border rounded-md p-3 flex flex-col sm:flex-row sm:items-center gap-3 bg-panel2/20"
            >
              <VoiceboxProfileRowAvatar profile={p} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                {p.description ? (
                  <p className="text-[10px] text-muted truncate">{p.description}</p>
                ) : null}
                <p className="text-[10px] text-muted mt-1">
                  {p.language.toUpperCase()}
                  {p.default_engine ? ` · ${p.default_engine}` : ""}
                  {` · ${p.sample_count} próbek · ${p.generation_count} generacji`}
                </p>
                {p.personality ? (
                  <p className="text-[10px] text-muted/80 line-clamp-2 mt-1" title={p.personality}>
                    Personality: {p.personality}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  className="btn text-xs"
                  onClick={() => onUseInTts(p)}
                >
                  Użyj w TTS
                </button>
                <button
                  type="button"
                  className="btn text-xs"
                  disabled={hubProfileIds.has(p.id)}
                  title={
                    hubProfileIds.has(p.id)
                      ? "Ten profil Voice Box jest już na liście profili TTS Hub"
                      : "Zapisz jako profil głosu w liście po lewej (TTS Hub)"
                  }
                  onClick={() => onAddToProfileList(p)}
                >
                  {hubProfileIds.has(p.id) ? "Na liście profili" : "Dodaj do listy profili"}
                </button>
                <button
                  type="button"
                  className="btn text-xs"
                  onClick={() => {
                    setCreating(false);
                    setEditingId(p.id);
                  }}
                >
                  Edytuj
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
