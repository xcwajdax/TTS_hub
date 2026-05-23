import { useCallback, useEffect, useState } from "react";
import {
  createFolder,
  createTag,
  deleteFolder,
  deleteFolderRule,
  deleteTag,
  listFolderRules,
  listFolders,
  listTags,
  renameFolder,
  renameTag,
  upsertFolderRule,
} from "../api/tauri";
import type {
  ArchiveFolder,
  ArchiveTag,
  FolderRule,
  FolderRuleInput,
  GenerationSource,
} from "../types";

const SOURCE_OPTIONS: { id: GenerationSource | "*"; label: string }[] = [
  { id: "*", label: "Dowolne (*)" },
  { id: "manual", label: "Ręczne" },
  { id: "http", label: "HTTP" },
  { id: "cursor", label: "Cursor" },
  { id: "cursor-skill", label: "Cursor skill" },
  { id: "quick_hotkey", label: "Skrót klawiszowy" },
];

interface Props {
  onError: (message: string) => void;
  onChanged?: () => void;
}

export default function OrganizationSettingsPanel({ onError, onChanged }: Props) {
  const [folders, setFolders] = useState<ArchiveFolder[]>([]);
  const [tags, setTags] = useState<ArchiveTag[]>([]);
  const [rules, setRules] = useState<FolderRule[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, t, r] = await Promise.all([listFolders(), listTags(), listFolderRules()]);
      setFolders(f);
      setTags(t);
      setRules(r);
    } catch (e) {
      onError(String(e));
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const notify = () => {
    void load();
    onChanged?.();
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setLoading(true);
    try {
      await createFolder(name);
      setNewFolderName("");
      notify();
    } catch (e) {
      onError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setLoading(true);
    try {
      await createTag(name);
      setNewTagName("");
      notify();
    } catch (e) {
      onError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRenameTag = async (id: string) => {
    const name = editingTagName.trim();
    if (!name) return;
    setLoading(true);
    try {
      await renameTag(id, name);
      setEditingTagId(null);
      notify();
    } catch (e) {
      onError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTag = async (id: string) => {
    setLoading(true);
    try {
      await deleteTag(id);
      notify();
    } catch (e) {
      onError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRenameFolder = async (id: string) => {
    const name = editingFolderName.trim();
    if (!name) return;
    setLoading(true);
    try {
      await renameFolder(id, name);
      setEditingFolderId(null);
      notify();
    } catch (e) {
      onError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFolder = async (id: string, mode: "unassign" | "delete_items") => {
    setLoading(true);
    try {
      await deleteFolder(id, mode);
      notify();
    } catch (e) {
      onError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = async () => {
    if (folders.length === 0) {
      onError("Utwórz najpierw folder.");
      return;
    }
    const input: FolderRuleInput = {
      folder_id: folders[0].id,
      match_source: "manual",
      priority: 100,
      enabled: true,
    };
    setLoading(true);
    try {
      await upsertFolderRule(input);
      notify();
    } catch (e) {
      onError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRule = async (rule: FolderRule, patch: Partial<FolderRuleInput>) => {
    setLoading(true);
    try {
      await upsertFolderRule({
        id: rule.id,
        folder_id: patch.folder_id ?? rule.folder_id,
        match_source: patch.match_source ?? rule.match_source,
        priority: patch.priority ?? rule.priority,
        enabled: patch.enabled ?? rule.enabled,
      });
      notify();
    } catch (e) {
      onError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const folderName = (id: string) => folders.find((f) => f.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="flex flex-col gap-6 text-sm">
      <section>
        <h3 className="text-heading font-medium mb-2">Tagi archiwum</h3>
        <p className="text-xs text-muted mb-3">
          Tagi przypisujesz do zapisanych generacji. Filtruj archiwum po tagach na pasku nad listą.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            className="input flex-1"
            placeholder="Nazwa nowego tagu"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreateTag()}
            disabled={loading}
          />
          <button type="button" className="btn" onClick={() => void handleCreateTag()} disabled={loading}>
            Dodaj
          </button>
        </div>
        {tags.length === 0 ? (
          <p className="text-xs text-muted">Brak tagów.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tags.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-2 p-2 rounded border border-border bg-panel2"
              >
                {editingTagId === t.id ? (
                  <>
                    <input
                      type="text"
                      className="input flex-1 min-w-[120px]"
                      value={editingTagName}
                      onChange={(e) => setEditingTagName(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="btn text-xs"
                      onClick={() => void handleRenameTag(t.id)}
                      disabled={loading}
                    >
                      Zapisz
                    </button>
                    <button
                      type="button"
                      className="btn text-xs"
                      onClick={() => setEditingTagId(null)}
                    >
                      Anuluj
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: t.color ?? "#94a3b8" }}
                    />
                    <span className="flex-1 font-medium">{t.name}</span>
                    <span className="text-[10px] text-muted">{t.slug}</span>
                    <button
                      type="button"
                      className="btn text-xs"
                      onClick={() => {
                        setEditingTagId(t.id);
                        setEditingTagName(t.name);
                      }}
                    >
                      Zmień nazwę
                    </button>
                    <button
                      type="button"
                      className="btn text-xs text-red-300"
                      onClick={() => void handleDeleteTag(t.id)}
                      disabled={loading}
                    >
                      Usuń
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-heading font-medium mb-2">Foldery archiwum</h3>
        <p className="text-xs text-muted mb-3">
          Każdy folder to podkatalog w katalogu archiwum. Przypisanie generacji automatycznie zapisuje plik w tym folderze.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            className="input flex-1"
            placeholder="Nazwa nowego folderu"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreateFolder()}
            disabled={loading}
          />
          <button type="button" className="btn" onClick={() => void handleCreateFolder()} disabled={loading}>
            Dodaj
          </button>
        </div>
        {folders.length === 0 ? (
          <p className="text-xs text-muted">Brak folderów.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {folders.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center gap-2 p-2 rounded border border-border bg-panel2"
              >
                {editingFolderId === f.id ? (
                  <>
                    <input
                      type="text"
                      className="input flex-1 min-w-[120px]"
                      value={editingFolderName}
                      onChange={(e) => setEditingFolderName(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="btn text-xs"
                      onClick={() => void handleRenameFolder(f.id)}
                      disabled={loading}
                    >
                      Zapisz
                    </button>
                    <button
                      type="button"
                      className="btn text-xs"
                      onClick={() => setEditingFolderId(null)}
                    >
                      Anuluj
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: f.color ?? "#6366f1" }}
                    />
                    <span className="flex-1 font-medium">{f.name}</span>
                    <span className="text-[10px] text-muted">{f.slug}</span>
                    <button
                      type="button"
                      className="btn text-xs"
                      onClick={() => {
                        setEditingFolderId(f.id);
                        setEditingFolderName(f.name);
                      }}
                    >
                      Zmień nazwę
                    </button>
                    <button
                      type="button"
                      className="btn text-xs"
                      title="Przenieś pliki do głównego archiwum"
                      onClick={() => void handleDeleteFolder(f.id, "unassign")}
                      disabled={loading}
                    >
                      Usuń (zachowaj)
                    </button>
                    <button
                      type="button"
                      className="btn text-xs text-red-300"
                      onClick={() => void handleDeleteFolder(f.id, "delete_items")}
                      disabled={loading}
                    >
                      Usuń z plikami
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-heading font-medium mb-2">Reguły auto-segregacji</h3>
        <p className="text-xs text-muted mb-3">
          Nowe generacje są przypisywane do folderu według źródła. Niższy priorytet = wcześniejsze dopasowanie.
        </p>
        <button type="button" className="btn mb-3" onClick={() => void handleAddRule()} disabled={loading}>
          Dodaj regułę
        </button>
        {rules.length === 0 ? (
          <p className="text-xs text-muted">Brak reguł.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-muted text-left border-b border-border">
                  <th className="py-1 pr-2">Źródło</th>
                  <th className="py-1 pr-2">Folder</th>
                  <th className="py-1 pr-2">Priorytet</th>
                  <th className="py-1 pr-2">Wł.</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-border/60">
                    <td className="py-1.5 pr-2">
                      <select
                        className="input text-xs w-full"
                        value={rule.match_source}
                        onChange={(e) =>
                          void handleUpdateRule(rule, {
                            match_source: e.target.value as GenerationSource | "*",
                          })
                        }
                        disabled={loading}
                      >
                        {SOURCE_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        className="input text-xs w-full"
                        value={rule.folder_id}
                        onChange={(e) => void handleUpdateRule(rule, { folder_id: e.target.value })}
                        disabled={loading}
                      >
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="number"
                        className="input text-xs w-16"
                        value={rule.priority}
                        onChange={(e) =>
                          void handleUpdateRule(rule, { priority: Number(e.target.value) || 100 })
                        }
                        disabled={loading}
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) => void handleUpdateRule(rule, { enabled: e.target.checked })}
                        disabled={loading}
                      />
                    </td>
                    <td className="py-1.5">
                      <button
                        type="button"
                        className="text-red-300 hover:text-red-200"
                        onClick={() => void deleteFolderRule(rule.id).then(notify).catch((e) => onError(String(e)))}
                        disabled={loading}
                        title={`Usuń regułę ${folderName(rule.folder_id)}`}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
