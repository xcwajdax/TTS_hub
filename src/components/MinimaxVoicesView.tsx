import { useEffect, useState } from "react";
import {
  getAppSettings,
  listMinimaxClonedVoices,
  listMinimaxPresetVoices,
  setAppSettings,
  syncMinimaxVoices,
  type MinimaxClonedVoice,
  type MinimaxPresetVoice,
  type VoiceBoxHealth,
  type VoiceBoxProfile,
} from "../api/tauri";
import {
  DEFAULT_MINIMAX_LANGUAGE,
  type AppSettings,
  type TtsProviderId,
} from "../appSettings";
import { MINIMAX_LANGUAGE_CATALOG } from "../lib/minimaxLanguages";
import type { MinimaxVoicesSection } from "./minimaxVoicesSections";
import MinimaxVoiceClone from "./MinimaxVoiceClone";
import MinimaxVoiceDesign from "./MinimaxVoiceDesign";
import { minimaxDeleteVoice } from "../api/tauri";
import MinimaxCloneVolumeControl from "./MinimaxCloneVolumeControl";
import SaveVoiceProfileFooter from "./SaveVoiceProfileFooter";
import Settings, { type SettingsState } from "./Settings";
import { useAppView } from "../context/AppViewContext";
import type { TtsModelInfo } from "../ttsModels";

type Section = MinimaxVoicesSection;

interface Props {
  initialSection?: Section;
  settings: SettingsState;
  voices: string[];
  voiceboxProfiles: VoiceBoxProfile[];
  voiceboxModels: TtsModelInfo[];
  voiceboxHealth: VoiceBoxHealth | null;
  onSettingsChange: (s: SettingsState) => void;
  onError: (m: string) => void;
  onSuccess?: (m: string) => void;
  onProfileSaved?: (m: string) => void;
  onSettingsChanged?: () => void;
  enabledProviders?: TtsProviderId[];
}

export default function MinimaxVoicesView({
  initialSection = "cloning",
  settings,
  voices,
  voiceboxProfiles,
  voiceboxModels,
  voiceboxHealth,
  onSettingsChange,
  onError,
  onSuccess,
  onProfileSaved,
  onSettingsChanged,
  enabledProviders,
}: Props) {
  const { onBackToTts } = useAppView();
  const [section, setSection] = useState<Section>(initialSection);
  const [cloned, setCloned] = useState<MinimaxClonedVoice[]>([]);
  const [presets, setPresets] = useState<MinimaxPresetVoice[]>([]);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [enabledLanguages, setEnabledLanguages] = useState<string[]>([DEFAULT_MINIMAX_LANGUAGE]);
  const [syncing, setSyncing] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  const isEnabled = !enabledProviders || enabledProviders.includes("minimax");

  const loadAll = async () => {
    if (!isEnabled) return;
    try {
      const [clonedList, presetsList, view] = await Promise.all([
        listMinimaxClonedVoices(),
        listMinimaxPresetVoices(),
        getAppSettings(),
      ]);
      setCloned(clonedList);
      setPresets(presetsList);
      setSyncedAt(view.minimax_voices_synced_at ?? null);
      setEnabledLanguages(view.minimax_enabled_languages ?? [DEFAULT_MINIMAX_LANGUAGE]);
      setHasApiKey(!!view.effective_minimax_configured);
    } catch (e) {
      onError(String(e));
    }
  };

  useEffect(() => {
    void loadAll();
  }, [isEnabled]);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  if (!isEnabled) {
    return (
      <div className="h-full w-full flex flex-col min-h-0">
        <Header onBack={onBackToTts} />
        <div className="flex-1 flex items-center justify-center p-8 text-center text-sm text-muted">
          Provider Minimax jest wyłączony. Włącz go w Ustawienia → Ogólne → Providery TTS.
        </div>
      </div>
    );
  }

  const persistEnabledLanguages = async (next: string[]) => {
    setEnabledLanguages(next);
    try {
      const view = await getAppSettings();
      const payload: AppSettings = {
        ...view,
        minimax_enabled_languages: next,
      };
      await setAppSettings(payload);
      onSettingsChanged?.();
      onSuccess?.("Zapisano języki Minimax");
    } catch (e) {
      onError(String(e));
    }
  };

  const runSync = async () => {
    setSyncing(true);
    try {
      const result = await syncMinimaxVoices();
      const view = await getAppSettings();
      setSyncedAt(view.minimax_voices_synced_at ?? null);
      setCloned(await listMinimaxClonedVoices());
      setPresets(await listMinimaxPresetVoices());
      onSuccess?.(
        `Zsynchronizowano: ${result.system_count} systemowych, ${result.cloning_count} klonów, ${result.generation_count} wygenerowanych.`,
      );
    } catch (e) {
      onError(String(e));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0 bg-panel">
      <Header onBack={onBackToTts} />

      <nav className="shrink-0 flex border-b border-border bg-panel2/40">
        <SubTab
          active={section === "profile"}
          onClick={() => setSection("profile")}
          label="Profil TTS"
        />
        <SubTab active={section === "cloning"} onClick={() => setSection("cloning")} label="Klonowanie" />
        <SubTab active={section === "design"} onClick={() => setSection("design")} label="Voice Design" />
        <SubTab
          active={section === "presets"}
          onClick={() => setSection("presets")}
          label={`Presety API (${presets.length})`}
        />
        <SubTab
          active={section === "languages"}
          onClick={() => setSection("languages")}
          label="Języki"
        />
      </nav>

      <main className="flex-1 min-h-0 min-w-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-5 flex flex-col gap-6 text-sm">
          {section === "profile" && (
            <>
              <header className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">Nowy profil głosu</h2>
                <p className="text-xs text-muted">
                  Wybierz providera, model i głos, a na dole zapisz profil ze skrótem klawiszowym.
                  Po zapisaniu wróć do widoku TTS i wybierz profil z listy po lewej.
                </p>
              </header>
              <div className="border border-border rounded-md overflow-hidden bg-panel2/20">
                <Settings
                  state={settings}
                  voices={voices}
                  voiceboxProfiles={voiceboxProfiles}
                  voiceboxModels={voiceboxModels}
                  voiceboxHealth={voiceboxHealth}
                  enabledProviders={enabledProviders}
                  onChange={onSettingsChange}
                  onError={onError}
                />
                <SaveVoiceProfileFooter
                  settings={settings}
                  onError={onError}
                  onSuccess={onProfileSaved ?? onSuccess}
                />
              </div>
            </>
          )}

          {section === "cloning" && (
            <>
              <header className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">Klonowanie głosu</h2>
                <p className="text-xs text-muted">
                  Utwórz klon z nagrania 10 s–5 min (mp3/m4a/wav), opcjonalnie z krótkim promptem
                  tonu. Wymaga MINIMAX_API_KEY.
                </p>
              </header>

              {hasApiKey === false && (
                <p className="text-[11px] text-amber-200/90">
                  Brak MINIMAX_API_KEY — klonowanie nie zadziała. Skonfiguruj klucz w
                  Ustawienia → Szybka konfiguracja.
                </p>
              )}

              <MinimaxVoiceClone
                model="speech-2.8-hd"
                onCloned={(v) => {
                  setCloned((prev) => [...prev.filter((c) => c.voice_id !== v.voice_id), v]);
                  onSuccess?.(`Dodano głos „${v.name || v.voice_id}".`);
                }}
                onError={onError}
              />

              <section className="flex flex-col gap-3 border-t border-border pt-5">
                <h3 className="text-xs uppercase tracking-wide text-muted">
                  Sklonowane głosy ({cloned.length})
                </h3>
                {cloned.length === 0 ? (
                  <p className="text-xs text-muted">
                    Brak sklonowanych głosów. Użyj formularza powyżej.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {cloned.map((c) => (
                      <li
                        key={c.voice_id}
                        className="border border-border rounded-md bg-panel2/40 p-3 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{c.name}</div>
                            <div className="text-[10px] text-muted truncate">
                              {c.voice_id} · {new Date(c.created_at * 1000).toLocaleString("pl-PL")}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn-ghost text-[10px] text-red-300/90 shrink-0"
                            onClick={() => {
                              void (async () => {
                                try {
                                  await minimaxDeleteVoice(c.voice_id);
                                  setCloned((prev) => prev.filter((x) => x.voice_id !== c.voice_id));
                                  onSuccess?.(`Usunięto głos „${c.voice_id}" z konta MiniMax.`);
                                } catch (e) {
                                  onError(String(e));
                                }
                              })();
                            }}
                          >
                            Usuń z API
                          </button>
                        </div>
                        <MinimaxCloneVolumeControl
                          voiceId={c.voice_id}
                          presetVol={1}
                          cloned={cloned}
                          onClonedUpdated={(v) =>
                            setCloned((prev) =>
                              prev.map((x) => (x.voice_id === v.voice_id ? v : x)),
                            )
                          }
                          onError={onError}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {section === "design" && (
            <>
              <header className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">Voice Design</h2>
                <p className="text-xs text-muted">
                  Zaprojektuj głos z opisu tekstowego (API voice_design). Wynikowy voice_id możesz
                  użyć w syntezie jak klon.
                </p>
              </header>
              <MinimaxVoiceDesign
                onDesigned={(v) => {
                  setCloned((prev) => [...prev.filter((c) => c.voice_id !== v.voice_id), v]);
                  onSuccess?.(`Utworzono głos „${v.voice_id}".`);
                }}
                onError={onError}
              />
            </>
          )}

          {section === "presets" && (
            <>
              <header className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">Presety API</h2>
                <p className="text-xs text-muted">
                  Synchronizacja głosów systemowych, sklonowanych i wygenerowanych z konta
                  MiniMax (endpoint get_voice). Po synchronizacji lista jest widoczna w edytorze
                  TTS.
                </p>
              </header>

              <p className="text-[11px] text-muted/90">
                {syncedAt
                  ? `Ostatnia synchronizacja: ${new Date(syncedAt * 1000).toLocaleString("pl-PL")} · ${presets.length} systemowych`
                  : "Używany jest wbudowany katalog (kilka głosów PL/EN). Synchronizacja pobiera pełną listę z API."}
              </p>

              <button
                type="button"
                className="btn text-xs self-start"
                disabled={syncing || hasApiKey === false}
                onClick={() => void runSync()}
              >
                {syncing ? "Synchronizuję…" : "Synchronizuj głosy z API"}
              </button>

              {presets.length > 0 && (
                <ul className="flex flex-col gap-1.5 max-h-96 overflow-y-auto border border-border rounded-md p-2 bg-panel2/30">
                  {presets.map((p) => (
                    <li
                      key={p.voice_id}
                      className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-panel"
                    >
                      <span className="truncate text-xs">{p.display_name}</span>
                      <code className="text-[10px] text-muted truncate">{p.voice_id}</code>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {section === "languages" && (
            <>
              <header className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">Języki</h2>
                <p className="text-xs text-muted">
                  Ogranicza katalog głosów systemowych Minimax widocznych w edytorze TTS. Pusta
                  lista = wszystkie języki z katalogu. Domyślnie tylko polski.
                </p>
              </header>

              <LanguagesEditor
                enabled={enabledLanguages}
                onChange={(next) => void persistEnabledLanguages(next)}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-panel2/40">
      <div className="flex flex-col">
        <h1 className="text-base font-semibold">Głosy Minimax</h1>
        <p className="text-[11px] text-muted">
          Klonowanie, presety z API, języki katalogu i tworzenie profili TTS
        </p>
      </div>
      <button type="button" className="btn text-xs" onClick={onBack}>
        ← Wróć do TTS
      </button>
    </header>
  );
}

function SubTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 py-2 text-sm ${
        active
          ? "bg-panel2 text-heading border-b-2 border-accent"
          : "text-muted hover:text-heading"
      }`}
    >
      {label}
    </button>
  );
}

function LanguagesEditor({
  enabled,
  onChange,
}: {
  enabled: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {MINIMAX_LANGUAGE_CATALOG.map((lang) => {
          const checked = enabled.length === 0 || enabled.includes(lang.code);
          return (
            <label key={lang.code} className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  let next: string[];
                  if (e.target.checked) {
                    next = [...new Set([...enabled, lang.code])];
                  } else {
                    next = enabled.filter((c) => c !== lang.code);
                  }
                  onChange(next);
                }}
              />
              <span>{lang.display_name}</span>
            </label>
          );
        })}
      </div>
      <button
        type="button"
        className="btn text-xs self-start"
        onClick={() => onChange([])}
      >
        Wszystkie języki (bez filtra)
      </button>
    </div>
  );
}
