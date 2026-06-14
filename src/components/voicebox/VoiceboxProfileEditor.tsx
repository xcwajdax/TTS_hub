import { useEffect, useState } from "react";
import {
  voiceboxCreateProfile,
  voiceboxDeleteProfile,
  voiceboxUpdateProfile,
  type VoiceBoxProfile,
  type VoiceBoxProfileCreate,
} from "../../api/tauri";
import { VOICEBOX_ENGINES, VOICEBOX_LANGUAGES } from "./voiceboxSections";
import VoiceboxSamplesPanel from "./VoiceboxSamplesPanel";

interface Props {
  profile: VoiceBoxProfile | null;
  isNew: boolean;
  onSaved: (profile: VoiceBoxProfile) => void;
  onDeleted?: () => void;
  onCancel: () => void;
  onError: (m: string) => void;
  onSuccess?: (m: string) => void;
  onRefresh?: () => void;
}

function emptyForm(): VoiceBoxProfileCreate {
  return {
    name: "",
    description: null,
    language: "pl",
    voice_type: "cloned",
    default_engine: "chatterbox",
    personality: null,
  };
}

function formFromProfile(p: VoiceBoxProfile): VoiceBoxProfileCreate {
  return {
    name: p.name,
    description: p.description,
    language: p.language,
    voice_type: p.voice_type ?? "cloned",
    preset_engine: p.preset_engine,
    preset_voice_id: p.preset_voice_id,
    design_prompt: p.design_prompt,
    default_engine: p.default_engine,
    personality: p.personality,
  };
}

export default function VoiceboxProfileEditor({
  profile,
  isNew,
  onSaved,
  onDeleted,
  onCancel,
  onError,
  onSuccess,
  onRefresh,
}: Props) {
  const [form, setForm] = useState<VoiceBoxProfileCreate>(emptyForm());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) {
      setForm(emptyForm());
    } else if (profile) {
      setForm(formFromProfile(profile));
    }
  }, [profile, isNew]);

  const update = <K extends keyof VoiceBoxProfileCreate>(key: K, value: VoiceBoxProfileCreate[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = async () => {
    if (!form.name.trim()) {
      onError("Nazwa profilu jest wymagana.");
      return;
    }
    setBusy(true);
    try {
      const body: VoiceBoxProfileCreate = {
        ...form,
        name: form.name.trim(),
        description: form.description?.trim() || null,
        personality: form.personality?.trim() || null,
      };
      const saved = isNew
        ? await voiceboxCreateProfile(body)
        : await voiceboxUpdateProfile(profile!.id, body);
      onSaved(saved);
      onRefresh?.();
      onSuccess?.(isNew ? "Utworzono profil Voice Box." : "Zapisano profil Voice Box.");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!profile || !window.confirm(`Usunąć profil „${profile.name}" z serwera Voice Box?`)) return;
    setBusy(true);
    try {
      await voiceboxDeleteProfile(profile.id);
      onDeleted?.();
      onRefresh?.();
      onSuccess?.("Usunięto profil Voice Box.");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 border border-border rounded-md p-4 bg-panel2/20">
      <h3 className="text-sm font-semibold">
        {isNew ? "Nowy profil Voice Box" : `Edycja: ${profile?.name ?? ""}`}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <label className="flex flex-col gap-1 text-muted">
          Nazwa
          <input
            className="field"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="np. Mój głos"
          />
        </label>
        <label className="flex flex-col gap-1 text-muted">
          Język
          <select
            className="field"
            value={form.language ?? "pl"}
            onChange={(e) => update("language", e.target.value)}
          >
            {VOICEBOX_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-muted">
          Domyślny silnik
          <select
            className="field"
            value={form.default_engine ?? ""}
            onChange={(e) => update("default_engine", e.target.value || null)}
          >
            <option value="">— automatycznie —</option>
            {VOICEBOX_ENGINES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-muted">
          Typ głosu
          <select
            className="field"
            value={form.voice_type ?? "cloned"}
            onChange={(e) => update("voice_type", e.target.value)}
          >
            <option value="cloned">Sklonowany</option>
            <option value="preset">Preset</option>
            <option value="designed">Designed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-muted sm:col-span-2">
          Opis
          <input
            className="field"
            value={form.description ?? ""}
            onChange={(e) => update("description", e.target.value || null)}
          />
        </label>
        <label className="flex flex-col gap-1 text-muted sm:col-span-2">
          Personality (prompt postaci)
          <textarea
            className="field min-h-[5rem]"
            value={form.personality ?? ""}
            onChange={(e) => update("personality", e.target.value || null)}
            placeholder="Opis charakteru — używany gdy włączysz „przepisz w charakterze” przy generacji."
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void save()}>
          {busy ? "Zapisuję…" : isNew ? "Utwórz profil" : "Zapisz zmiany"}
        </button>
        <button type="button" className="btn text-xs" onClick={onCancel}>
          Anuluj
        </button>
        {!isNew && profile ? (
          <button
            type="button"
            className="btn text-xs text-red-300 ml-auto"
            disabled={busy}
            onClick={() => void remove()}
          >
            Usuń profil
          </button>
        ) : null}
      </div>
      {!isNew && profile ? (
        <div className="border-t border-border pt-4">
          <h4 className="text-xs font-semibold mb-2">Próbki głosu ({profile.sample_count})</h4>
          <VoiceboxSamplesPanel
            profileId={profile.id}
            onError={onError}
            onSuccess={onSuccess}
            onChanged={onRefresh}
          />
        </div>
      ) : null}
    </div>
  );
}
