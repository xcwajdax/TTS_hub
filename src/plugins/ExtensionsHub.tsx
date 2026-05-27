import { useState } from "react";
import Icon from "../components/Icon";
import {
  installPlugin,
  setPluginEnabled,
  uninstallPlugin,
} from "../api/tauri";
import { notifyPluginsChanged } from "./events";
import type { PluginManifest } from "./types";

interface Props {
  plugins: PluginManifest[];
  onPluginsChange: (plugins: PluginManifest[]) => void;
  onOpenPlugin: (id: string) => void;
  onError: (message: string) => void;
  onToast?: (message: string) => void;
}

export default function ExtensionsHub({
  plugins,
  onPluginsChange,
  onOpenPlugin,
  onError,
  onToast,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const runAction = async (
    id: string,
    action: () => Promise<PluginManifest[]>,
  ): Promise<boolean> => {
    setBusyId(id);
    try {
      const next = await action();
      onPluginsChange(next);
      notifyPluginsChanged();
      return true;
    } catch (e) {
      onError(String(e));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-panel">
      <header className="shrink-0 px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold text-heading">Rozszerzenia</h1>
        <p className="text-sm text-muted mt-1">
          Zainstaluj moduł, potem włącz lub wyłącz go. Soundboard po instalacji jest też w panelu
          historii (zakładka i panel u dołu). Każdy slot ma własny globalny skrót — ustawisz go na
          karcie slotu.
        </p>
      </header>
      <div className="flex-1 min-h-0 overflow-auto p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl">
          {plugins.map((plugin) => {
            const busy = busyId === plugin.id;
            return (
              <article
                key={plugin.id}
                className="rounded-lg border border-border bg-panel2 p-4 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-panel p-2 text-accent">
                    <Icon name="play" size={24} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-medium text-heading">{plugin.name}</h2>
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-800">
                        Darmowe
                      </span>
                      {plugin.installed && (
                        <span
                          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                            plugin.enabled
                              ? "bg-accent/20 text-accent border-accent/40"
                              : "bg-panel text-muted border-border"
                          }`}
                        >
                          {plugin.enabled ? "Włączone" : "Wyłączone"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-1 line-clamp-4">{plugin.description}</p>
                  </div>
                </div>

                <div className="mt-auto flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted">v{plugin.version}</span>
                    {plugin.installed && (
                      <label className="flex items-center gap-2 text-xs text-heading cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={plugin.enabled}
                          disabled={busy}
                          onChange={(e) =>
                            void runAction(plugin.id, () =>
                              setPluginEnabled(plugin.id, e.target.checked),
                            )
                          }
                        />
                        Włączone
                      </label>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 justify-end">
                    {!plugin.installed ? (
                      <button
                        type="button"
                        className="px-3 py-1.5 text-sm rounded bg-accent text-white hover:opacity-90 disabled:opacity-50"
                        disabled={busy}
                        onClick={() =>
                          void runAction(plugin.id, () => installPlugin(plugin.id)).then(
                            (ok) => {
                              if (ok) {
                                onToast?.(
                                  "Zainstalowano. Włącz rozszerzenie, aby używać skrótów.",
                                );
                              }
                            },
                          )
                        }
                      >
                        Zainstaluj
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="px-3 py-1.5 text-sm rounded border border-border text-muted hover:text-heading disabled:opacity-50"
                          disabled={busy}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Odinstalować „${plugin.name}”? Sloty pozostaną w pliku, ale skróty i panel znikną.`,
                              )
                            ) {
                              return;
                            }
                            void runAction(plugin.id, () => uninstallPlugin(plugin.id));
                          }}
                        >
                          Odinstaluj
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1.5 text-sm rounded bg-accent text-white hover:opacity-90 disabled:opacity-50"
                          disabled={busy || !plugin.enabled}
                          title={
                            plugin.enabled
                              ? "Otwórz konfigurację"
                              : "Włącz rozszerzenie, aby otworzyć"
                          }
                          onClick={() => onOpenPlugin(plugin.id)}
                        >
                          Otwórz
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {plugins.length === 0 && (
          <p className="text-sm text-muted">Brak dostępnych rozszerzeń.</p>
        )}
      </div>
    </div>
  );
}
