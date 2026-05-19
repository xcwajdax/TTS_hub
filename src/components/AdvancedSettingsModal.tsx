import { useCallback, useEffect, useState } from "react";
import { AUDIO_FORMATS } from "../audioFormats";
import {
  getAppSettings,
  listVoices,
  pickArchiveFolderSettings,
  pickTempFolder,
  setAppSettings,
} from "../api/tauri";
import type {
  ApiProfile,
  AppSettings,
  AppSettingsView,
  CursorIntegration,
  SaveMode,
} from "../appSettings";
import { defaultCursorIntegration, newApiProfile } from "../appSettings";
import { loadHistoryClickToPlay, saveHistoryClickToPlay } from "../lib/historyPlaybackPrefs";
import type { AudioFormat } from "../types";
import CursorIntegrationPanel from "./CursorIntegrationPanel";

type Tab = "general" | "cursor";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}

type Draft = AppSettingsView & { history_click_to_play: boolean };

export default function AdvancedSettingsModal({ open, onClose, onSaved, onError }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("general");
  const [voices, setVoices] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const view = await getAppSettings();
      const cursor = view.cursor_integration ?? defaultCursorIntegration();
      setDraft({
        ...view,
        cursor_integration: cursor,
        history_click_to_play: loadHistoryClickToPlay(),
      });
    } catch (e) {
      onError(String(e));
    }
  }, [onError]);

  useEffect(() => {
    if (open) {
      void load();
      setEditingProfileId(null);
      setTab("general");
      listVoices()
        .then(setVoices)
        .catch(() => setVoices([]));
    }
  }, [open, load]);

  if (!open || !draft) return null;

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const payload: AppSettings = {
        save_mode: draft.save_mode,
        save_format: draft.save_format,
        temp_path: draft.temp_path,
        archive_path: draft.archive_path,
        api_profiles: draft.api_profiles,
        active_api_id: draft.active_api_id,
        cursor_integration: draft.cursor_integration,
      };
      const view = await setAppSettings(payload);
      saveHistoryClickToPlay(draft.history_click_to_play);
      setDraft({ ...view, history_click_to_play: draft.history_click_to_play });
      onSaved();
      onClose();
    } catch (e) {
      onError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const browseTemp = async () => {
    try {
      const picked = await pickTempFolder();
      if (picked) {
        update("temp_path", picked);
        update("effective_temp_path", picked);
      }
    } catch (e) {
      onError(String(e));
    }
  };

  const browseArchive = async () => {
    try {
      const picked = await pickArchiveFolderSettings();
      if (picked) {
        update("archive_path", picked);
        update("effective_archive_path", picked);
      }
    } catch (e) {
      onError(String(e));
    }
  };

  const addProfile = () => {
    const profile = newApiProfile(`Profil ${draft.api_profiles.length + 1}`);
    update("api_profiles", [...draft.api_profiles, profile]);
    update("active_api_id", profile.id);
    setEditingProfileId(profile.id);
  };

  const removeProfile = (id: string) => {
    const next = draft.api_profiles.filter((p) => p.id !== id);
    update("api_profiles", next);
    if (draft.active_api_id === id) {
      update("active_api_id", next[0]?.id ?? null);
    }
    if (editingProfileId === id) setEditingProfileId(null);
  };

  const updateProfile = (id: string, patch: Partial<ApiProfile>) => {
    update(
      "api_profiles",
      draft.api_profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-panel border border-border rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="advanced-settings-title"
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <div>
            <h2 id="advanced-settings-title" className="text-base font-semibold">
              Ustawienia zaawansowane
            </h2>
            <p className="text-xs text-muted">API, ścieżki i tryb zapisu generacji</p>
          </div>
          <button type="button" className="btn text-xs" onClick={onClose}>
            Zamknij
          </button>
        </header>

        <nav className="flex border-b border-border text-sm">
          <button
            type="button"
            className={`flex-1 py-2 ${tab === "general" ? "bg-panel2 text-white border-b-2 border-accent" : "text-muted hover:text-white"}`}
            onClick={() => setTab("general")}
          >
            Ogólne
          </button>
          <button
            type="button"
            className={`flex-1 py-2 ${tab === "cursor" ? "bg-panel2 text-white border-b-2 border-accent" : "text-muted hover:text-white"}`}
            onClick={() => setTab("cursor")}
          >
            Cursor
          </button>
        </nav>

        {tab === "cursor" && (
          <div className="flex-1 overflow-y-auto p-4 text-sm">
            <CursorIntegrationPanel
              value={draft.cursor_integration}
              onChange={(next: CursorIntegration) => update("cursor_integration", next)}
              voices={voices}
              onError={onError}
            />
          </div>
        )}

        {tab === "general" && (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 text-sm">
          <section className="flex flex-col gap-3">
            <h3 className="text-xs uppercase tracking-wide text-muted">Historia</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.history_click_to_play}
                onChange={(e) => update("history_click_to_play", e.target.checked)}
              />
              <span>Kliknięcie w wpis historii odtwarza generację</span>
            </label>
            <p className="text-[11px] text-muted">
              Dotyczy obszaru karty poza przyciskami i polami tekstowymi (tytuł, [więcej], zapis, usuń).
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs uppercase tracking-wide text-muted">Tryb zapisu</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="save_mode"
                checked={draft.save_mode === "manual"}
                onChange={() => update("save_mode", "manual" as SaveMode)}
              />
              <span>Ręczny — zapisujesz generacje przyciskiem dyskietki</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="save_mode"
                checked={draft.save_mode === "auto"}
                onChange={() => update("save_mode", "auto" as SaveMode)}
              />
              <span>Automatyczny — każda generacja trafia od razu do archiwum</span>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted max-w-xs">
              Format zapisu do archiwum
              <select
                className="field"
                value={draft.save_format}
                onChange={(e) => update("save_format", e.target.value as AudioFormat)}
              >
                {AUDIO_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs uppercase tracking-wide text-muted">Ścieżki</h3>
            <PathRow
              label="Folder tymczasowy (sesja)"
              value={draft.effective_temp_path}
              onBrowse={() => void browseTemp()}
              onReset={() => {
                update("temp_path", null);
                void load();
              }}
            />
            <PathRow
              label="Folder archiwum"
              value={draft.effective_archive_path}
              onBrowse={() => void browseArchive()}
              onReset={() => {
                update("archive_path", null);
                void load();
              }}
            />
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs uppercase tracking-wide text-muted">Profile API (Google)</h3>
              <button type="button" className="btn text-xs" onClick={addProfile}>
                Dodaj profil
              </button>
            </div>
            <p className="text-[11px] text-muted">
              {draft.env_api_key_available
                ? "Wykryto GOOGLE_API_KEY w pliku env."
                : "Brak GOOGLE_API_KEY w env — dodaj profil z kluczem."}
              {draft.active_api_id ? " Wybrany jest profil z listy." : " Używany jest klucz z env."}
            </p>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Aktywny klucz API
              <select
                className="field"
                value={draft.active_api_id ?? ""}
                onChange={(e) => update("active_api_id", e.target.value || null)}
              >
                <option value="">Domyślny z studios.env / .env</option>
                {draft.api_profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-2">
              {draft.api_profiles.length === 0 ? (
                <p className="text-xs text-muted">Brak dodatkowych profili — używany jest klucz z pliku env.</p>
              ) : (
                draft.api_profiles.map((profile) => (
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
          </section>
        </div>
        )}

        <footer className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Anuluj
          </button>
          <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Zapisywanie…" : "Zapisz ustawienia"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function PathRow({
  label,
  value,
  onBrowse,
  onReset,
}: {
  label: string;
  value: string;
  onBrowse: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <code className="text-[11px] bg-panel2 border border-border rounded px-2 py-1 break-all">
        {value}
      </code>
      <div className="flex gap-2">
        <button type="button" className="btn text-xs" onClick={onBrowse}>
          Wybierz folder…
        </button>
        <button type="button" className="btn text-xs" onClick={onReset}>
          Przywróć domyślną
        </button>
      </div>
    </div>
  );
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
        <button type="button" className="flex-1 text-left text-sm hover:text-accent2" onClick={onToggle}>
          {profile.name}
          <span className="text-muted text-xs ml-2">{expanded ? "▾" : "▸"}</span>
        </button>
        <button type="button" className="btn text-xs hover:!bg-red-900/40" onClick={onRemove}>
          Usuń
        </button>
      </div>
      {expanded && (
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
      )}
    </div>
  );
}
