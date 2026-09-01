import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  voiceboxAddProfileSample,
  voiceboxCreateProfile,
  voiceboxDeleteProfile,
  voiceboxGetProfile,
  voiceboxUpdateProfile,
  type VoiceBoxProfile,
  type VoiceBoxProfileCreate,
} from "../../api/tauri";
import {
  VOICEBOX_ENGINES,
  VOICEBOX_LANGUAGES,
  VOICEBOX_TADA_SIZES,
  type CloneProfilePrefill,
} from "./voiceboxSections";
import VoiceboxSamplesPanel from "./VoiceboxSamplesPanel";

interface Props {
  profile: VoiceBoxProfile | null;
  isNew: boolean;
  createPrefill?: CloneProfilePrefill | null;
  onSaved: (profile: VoiceBoxProfile) => void;
  onDeleted?: () => void;
  onCancel: () => void;
  onError: (m: string) => void;
  onSuccess?: (m: string) => void;
  onRefresh?: () => void;
}

function emptyForm(prefill?: CloneProfilePrefill | null): VoiceBoxProfileCreate {
  return {
    name: "",
    description: null,
    language: "pl",
    voice_type: "cloned",
    default_engine: prefill?.default_engine ?? "chatterbox",
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

function sampleFileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export default function VoiceboxProfileEditor({
  profile,
  isNew,
  createPrefill,
  onSaved,
  onDeleted,
  onCancel,
  onError,
  onSuccess,
  onRefresh,
}: Props) {
  const [form, setForm] = useState<VoiceBoxProfileCreate>(() => emptyForm(createPrefill));
  const [tadaSize, setTadaSize] = useState<"1B" | "3B">(createPrefill?.tada_size ?? "1B");
  const [busy, setBusy] = useState(false);
  const [samplePath, setSamplePath] = useState<string | null>(null);
  const [referenceText, setReferenceText] = useState("");

  useEffect(() => {
    if (isNew) {
      setForm(emptyForm(createPrefill));
      setTadaSize(createPrefill?.tada_size ?? "1B");
      setSamplePath(null);
      setReferenceText("");
    } else if (profile) {
      setForm(formFromProfile(profile));
    }
  }, [profile, isNew, createPrefill]);

  const update = <K extends keyof VoiceBoxProfileCreate>(key: K, value: VoiceBoxProfileCreate[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const pickSampleFile = async () => {
    const picked = await open({
      multiple: false,
      filters: [{ name: "Audio", extensions: ["wav", "mp3", "m4a", "ogg"] }],
    });
    if (!picked || Array.isArray(picked)) return;
    setSamplePath(picked);
  };

  const save = async () => {
    if (!form.name.trim()) {
      onError("Nazwa profilu jest wymagana.");
      return;
    }
    if (isNew && samplePath && !referenceText.trim()) {
      onError("Podaj tekst referencyjny próbki (dokładną transkrypcję nagrania).");
      return;
    }
    if (isNew && !samplePath && referenceText.trim()) {
      onError("Wybierz plik audio próbki albo wyczyść tekst referencyjny.");
      return;
    }

    setBusy(true);
    try {
      const body: VoiceBoxProfileCreate = {
        ...form,
        name: form.name.trim(),
        description: form.description?.trim() || null,
        personality: form.personality?.trim() || null,
        voice_type: "cloned",
        default_engine: form.default_engine || "chatterbox",
      };

      if (!isNew) {
        const saved = await voiceboxUpdateProfile(profile!.id, body);
        onSaved(saved);
        onRefresh?.();
        onSuccess?.("Zapisano profil Voice Box.");
        return;
      }

      const created = await voiceboxCreateProfile(body);
      let finalProfile = created;

      if (samplePath) {
        try {
          await voiceboxAddProfileSample(created.id, samplePath, referenceText.trim());
          try {
            finalProfile = await voiceboxGetProfile(created.id);
          } catch {
            finalProfile = { ...created, sample_count: (created.sample_count ?? 0) + 1 };
          }
          onSaved(finalProfile);
          onRefresh?.();
          onSuccess?.("Utworzono profil Voice Box i dodano próbkę.");
        } catch (e) {
          onSaved(created);
          onRefresh?.();
          onError(
            `Profil utworzono, ale nie udało się dodać próbki: ${String(e)}. Dodaj próbkę poniżej.`,
          );
        }
        return;
      }

      onSaved(created);
      onRefresh?.();
      onSuccess?.(
        "Utworzono profil Voice Box. Dodaj próbkę referencyjną poniżej, zanim użyjesz go w TTS.",
      );
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

  const createButtonLabel = (() => {
    if (busy) return "Zapisuję…";
    if (!isNew) return "Zapisz zmiany";
    if (samplePath) return "Utwórz profil i dodaj próbkę";
    return "Utwórz profil";
  })();

  return (
    <div className="flex flex-col gap-4 border border-border rounded-md p-4 bg-panel2/20">
      <h3 className="text-sm font-semibold">
        {isNew ? "Nowy profil Voice Box" : `Edycja: ${profile?.name ?? ""}`}
      </h3>
      <p className="text-[10px] text-muted leading-snug">
        Klon wymaga nagrania i dokładnego transkryptu; potem „Użyj w TTS”.
      </p>
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
            value={form.default_engine ?? "chatterbox"}
            onChange={(e) => update("default_engine", e.target.value || "chatterbox")}
          >
            {VOICEBOX_ENGINES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-muted">
          Typ głosu
          <p className="field bg-panel2/40 text-muted cursor-default select-none">Sklonowany</p>
        </div>
        {form.default_engine === "tada" ? (
          <label className="flex flex-col gap-1 text-muted sm:col-span-2">
            Rozmiar TADA (przy syntezie)
            <select
              className="field"
              value={tadaSize}
              onChange={(e) => setTadaSize(e.target.value as "1B" | "3B")}
            >
              {VOICEBOX_TADA_SIZES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-muted/80">
              W panelu TTS wybierz model {tadaSize === "3B" ? "voicebox:tada-3b-ml" : "voicebox:tada-1b"}{" "}
              (musi być pobrany w zakładce Modele).
            </span>
          </label>
        ) : null}
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

      {isNew ? (
        <div className="border-t border-border pt-4 flex flex-col gap-3">
          <h4 className="text-xs font-semibold">Pierwsza próbka (opcjonalnie)</h4>
          <p className="text-[10px] text-muted leading-snug">
            Bez próbki profil powstanie, ale „Użyj w TTS” będzie niedostępne, dopóki nie dodasz
            nagrania referencyjnego.
          </p>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Tekst referencyjny
            <textarea
              className="field min-h-[4rem] text-sm"
              value={referenceText}
              onChange={(e) => setReferenceText(e.target.value)}
              placeholder="Dokładna transkrypcja nagrania…"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn text-xs"
              disabled={busy}
              onClick={() => void pickSampleFile()}
            >
              {samplePath ? "Zmień plik audio…" : "Wybierz plik audio…"}
            </button>
            {samplePath ? (
              <>
                <span className="text-[10px] text-muted truncate max-w-[16rem]" title={samplePath}>
                  {sampleFileName(samplePath)}
                </span>
                <button
                  type="button"
                  className="btn text-xs text-muted"
                  disabled={busy}
                  onClick={() => setSamplePath(null)}
                >
                  Wyczyść
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void save()}>
          {createButtonLabel}
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
