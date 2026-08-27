import { useState } from "react";
import type { MinimaxSoundEffect, MinimaxSynthesisOptions, MinimaxVoiceModify } from "../lib/minimaxOptions";
import { defaultMinimaxSynthesisOptions } from "../lib/minimaxOptions";
import { emotionOptionsForModel, supportsContinuousSound, voiceModifySupported } from "../lib/minimaxCapabilities";
import { MINIMAX_LANGUAGE_CATALOG } from "../lib/minimaxLanguages";
import {
  MINIMAX_SOUND_EFFECTS,
  compactVoiceModify,
  patchVoiceModify,
  resolveVoiceModify,
} from "../lib/minimaxVoiceModify";
import VoiceModifyXyPad from "./voiceProfiles/fields/VoiceModifyXyPad";
import MinimaxSoundEffectsStudio from "./voiceProfiles/fields/MinimaxSoundEffectsStudio";
import ProfileFieldShell from "./voiceProfiles/fields/ProfileFieldShell";
import ProfileSliderField from "./voiceProfiles/fields/ProfileSliderField";
import "./voiceProfiles/voiceProfileForm.css";

interface Props {
  model: string;
  options: MinimaxSynthesisOptions;
  onChange: (next: MinimaxSynthesisOptions) => void;
  compact?: boolean;
  voiceProfileUi?: boolean;
}

const SAMPLE_RATES = [8000, 16000, 22050, 24000, 32000, 44100];
const BITRATES = [32000, 64000, 128000, 256000];
const API_FORMATS = ["mp3", "pcm", "flac", "wav", "opus", "pcmu_raw", "pcmu_wav"];

const VOICE_MODIFY_SLIDERS: {
  key: keyof Pick<MinimaxVoiceModify, "pitch" | "intensity" | "timbre">;
  label: string;
  tooltip: string;
}[] = [
  {
    key: "pitch",
    label: "Jasność (pitch)",
    tooltip: "MiniMax voice_modify.pitch: −100 głębiej, +100 jaśniej. To nie jest pitch w półtonach z voice_setting.",
  },
  {
    key: "intensity",
    label: "Siła (intensity)",
    tooltip: "MiniMax voice_modify.intensity: −100 mocniej, +100 miękcej.",
  },
  {
    key: "timbre",
    label: "Barwa (timbre)",
    tooltip: "MiniMax voice_modify.timbre: −100 pełniej / nosowo, +100 ostrzej / jaśniej.",
  },
];

export default function MinimaxAdvancedOptions({ model, options, onChange, compact, voiceProfileUi }: Props) {
  const [open, setOpen] = useState(!!voiceProfileUi);
  const o = options ?? defaultMinimaxSynthesisOptions();
  const fc = voiceProfileUi ? "vp-field" : "field";
  const lc = voiceProfileUi ? "vp-form__label" : "flex flex-col gap-1 text-muted";
  const voiceModify = resolveVoiceModify(o.voice_modify);
  const voiceModifyDisabled = !voiceModifySupported(o.audio.format);

  const patch = (partial: Partial<MinimaxSynthesisOptions>) => onChange({ ...o, ...partial });
  const patchVoice = (partial: Partial<MinimaxSynthesisOptions["voice"]>) =>
    onChange({ ...o, voice: { ...o.voice, ...partial } });
  const patchAudio = (partial: Partial<MinimaxSynthesisOptions["audio"]>) =>
    onChange({ ...o, audio: { ...o.audio, ...partial } });
  const patchVm = (partial: Partial<MinimaxVoiceModify>) =>
    patch({ voice_modify: patchVoiceModify(o.voice_modify, partial) });
  const setVoiceModify = (next: MinimaxVoiceModify) =>
    patch({ voice_modify: compactVoiceModify(next) });

  const emotions = emotionOptionsForModel(model);
  const grid = voiceProfileUi
    ? "grid grid-cols-1 sm:grid-cols-2 gap-2"
    : compact
      ? "grid grid-cols-1 sm:grid-cols-2 gap-2"
      : "grid grid-cols-2 md:grid-cols-3 gap-3";

  return (
    <div className={voiceProfileUi ? "vp-advanced-block col-span-full" : "col-span-full border border-border/60 rounded-md p-2 mt-1"}>
      <button
        type="button"
        className="w-full text-left text-xs text-muted hover:text-foreground flex justify-between items-center"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Zaawansowane MiniMax</span>
        <span>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className={`${grid} mt-3 text-xs`}>
          <label className={lc}>
            Emotion (auto = brak)
            <select
              className={fc}
              value={o.voice.emotion ?? ""}
              onChange={(e) =>
                patchVoice({ emotion: (e.target.value || null) as MinimaxSynthesisOptions["voice"]["emotion"] })
              }
            >
              <option value="">Auto</option>
              {emotions.map((em) => (
                <option key={em} value={em}>
                  {em}
                </option>
              ))}
            </select>
          </label>

          <label className={lc}>
            Język (language_boost)
            <select
              className={fc}
              value={o.language ?? "pl"}
              onChange={(e) => patch({ language: e.target.value })}
            >
              {MINIMAX_LANGUAGE_CATALOG.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.display_name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-muted col-span-full sm:col-span-1">
            <input
              type="checkbox"
              checked={o.voice.english_normalization}
              onChange={(e) => patchVoice({ english_normalization: e.target.checked })}
            />
            English normalization
          </label>

          <label className="flex items-center gap-2 text-muted">
            <input
              type="checkbox"
              checked={o.voice.text_normalization}
              onChange={(e) => patchVoice({ text_normalization: e.target.checked })}
            />
            Text normalization
          </label>

          <label className="flex items-center gap-2 text-muted">
            <input
              type="checkbox"
              checked={o.voice.latex_read}
              onChange={(e) => patchVoice({ latex_read: e.target.checked })}
            />
            LaTeX read (CN)
          </label>

          <label className={lc}>
            Format API
            <select
              className={fc}
              value={o.audio.format}
              onChange={(e) => patchAudio({ format: e.target.value })}
            >
              {API_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <label className={lc}>
            Sample rate
            <select
              className={fc}
              value={o.audio.sample_rate}
              onChange={(e) => patchAudio({ sample_rate: Number(e.target.value) })}
            >
              {SAMPLE_RATES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label className={lc}>
            Bitrate (mp3)
            <select
              className={fc}
              value={o.audio.bitrate}
              onChange={(e) => patchAudio({ bitrate: Number(e.target.value) })}
            >
              {BITRATES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>

          <label className={lc}>
            Kanały
            <select
              className={fc}
              value={o.audio.channel}
              onChange={(e) => patchAudio({ channel: Number(e.target.value) })}
            >
              <option value={1}>Mono</option>
              <option value={2}>Stereo</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-muted">
            <input
              type="checkbox"
              checked={o.audio.force_cbr}
              onChange={(e) => patchAudio({ force_cbr: e.target.checked })}
            />
            Force CBR (stream MP3)
          </label>

          <fieldset className="col-span-full border border-border/40 rounded p-2">
            <legend className="px-1 text-muted">Voice modify</legend>
            {voiceModifyDisabled ? (
              <p className="text-[10px] text-muted mb-2">
                voice_modify działa tylko dla formatów mp3 / wav / flac. Zmień format API, żeby
                odblokować pad i efekty.
              </p>
            ) : null}
            {voiceProfileUi ? (
              <div className="flex flex-col gap-3">
                <p className="vp-hint max-w-none">
                  Pad XY: oś X to jasność (`pitch`, głębiej ↔ jaśniej), oś Y to siła (`intensity`,
                  mocniej u góry). Barwa (`timbre`) zostaje suwakiem. Wartości idą do tego samego
                  obiektu `voice_modify`, który backend wysyła do MiniMax.
                </p>
                <VoiceModifyXyPad
                  value={voiceModify}
                  disabled={voiceModifyDisabled}
                  onChange={setVoiceModify}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {VOICE_MODIFY_SLIDERS.map((field) => (
                    <ProfileFieldShell
                      key={field.key}
                      label={`${field.label} (−100…100)`}
                      tooltip={field.tooltip}
                      defaultHint="0"
                      voiceProfileUi
                      onContextMenuReset={() => patchVm({ [field.key]: 0 })}
                    >
                      <ProfileSliderField
                        value={voiceModify[field.key]}
                        min={-100}
                        max={100}
                        step={1}
                        disabled={voiceModifyDisabled}
                        onChange={(n) => patchVm({ [field.key]: n })}
                      />
                    </ProfileFieldShell>
                  ))}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="vp-form__label">Studio efektów dźwiękowych</span>
                  <MinimaxSoundEffectsStudio
                    value={voiceModify.sound_effects}
                    disabled={voiceModifyDisabled}
                    onChange={(sound_effects) => patchVm({ sound_effects })}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {VOICE_MODIFY_SLIDERS.map((field) => (
                  <label key={field.key} className="flex flex-col gap-1 text-muted" title={field.tooltip}>
                    {field.label} (−100…100)
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      value={voiceModify[field.key]}
                      disabled={voiceModifyDisabled}
                      onChange={(e) => patchVm({ [field.key]: Number(e.target.value) })}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        patchVm({ [field.key]: 0 });
                      }}
                    />
                  </label>
                ))}
                <label className={lc}>
                  Sound effect
                  <select
                    className={fc}
                    value={voiceModify.sound_effects ?? ""}
                    disabled={voiceModifyDisabled}
                    onChange={(e) =>
                      patchVm({
                        sound_effects: (e.target.value || null) as MinimaxSoundEffect | null,
                      })
                    }
                  >
                    <option value="">— brak —</option>
                    {MINIMAX_SOUND_EFFECTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </fieldset>


          <fieldset className="col-span-full border border-border/40 rounded p-2">
            <legend className="px-1 text-muted">Wymowa (pronunciation_dict)</legend>
            <div className="flex flex-col gap-2">
              {(o.pronunciation_dict?.tone ?? []).map((rule, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    className="field flex-1"
                    value={rule}
                    placeholder="słowo/(wymowa)"
                    onChange={(e) => {
                      const tone = [...(o.pronunciation_dict?.tone ?? [])];
                      tone[idx] = e.target.value;
                      patch({ pronunciation_dict: { tone } });
                    }}
                  />
                  <button
                    type="button"
                    className="btn-ghost text-[10px]"
                    onClick={() => {
                      const tone = (o.pronunciation_dict?.tone ?? []).filter((_, i) => i !== idx);
                      patch({ pronunciation_dict: tone.length ? { tone } : null });
                    }}
                  >
                    Usuń
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-ghost text-[10px] self-start"
                onClick={() => {
                  const tone = [...(o.pronunciation_dict?.tone ?? []), ""];
                  patch({ pronunciation_dict: { tone } });
                }}
              >
                + reguła
              </button>
            </div>
          </fieldset>

          <fieldset className="col-span-full border border-border/40 rounded p-2">
            <legend className="px-1 text-muted">Mix głosów (timbre_weights, max 4)</legend>
            {o.timbre_weights.map((tw, idx) => (
              <div key={idx} className="flex gap-2 mb-1">
                <input
                  className="field flex-1"
                  value={tw.voice_id}
                  placeholder="voice_id"
                  onChange={(e) => {
                    const timbre_weights = [...o.timbre_weights];
                    timbre_weights[idx] = { ...tw, voice_id: e.target.value };
                    patch({ timbre_weights });
                  }}
                />
                <input
                  className="field w-20"
                  type="number"
                  min={1}
                  max={100}
                  value={tw.weight}
                  onChange={(e) => {
                    const timbre_weights = [...o.timbre_weights];
                    timbre_weights[idx] = { ...tw, weight: Number(e.target.value) };
                    patch({ timbre_weights });
                  }}
                />
                <button
                  type="button"
                  className="btn-ghost text-[10px]"
                  onClick={() => patch({ timbre_weights: o.timbre_weights.filter((_, i) => i !== idx) })}
                >
                  ×
                </button>
              </div>
            ))}
            {o.timbre_weights.length < 4 && (
              <button
                type="button"
                className="btn-ghost text-[10px]"
                onClick={() =>
                  patch({ timbre_weights: [...o.timbre_weights, { voice_id: "", weight: 50 }] })
                }
              >
                + głos
              </button>
            )}
            {o.timbre_weights.length > 0 && (
              <p className="text-[10px] text-muted mt-1">Przy mixie voice_id w API zostaje puste.</p>
            )}
          </fieldset>

          <label className="flex items-center gap-2 text-muted">
            <input
              type="checkbox"
              checked={o.subtitle_enable}
              onChange={(e) => patch({ subtitle_enable: e.target.checked })}
            />
            Napisy (subtitle)
          </label>

          <label className={lc}>
            Subtitle type
            <select
              className={fc}
              value={o.subtitle_type}
              disabled={!o.subtitle_enable}
              onChange={(e) =>
                patch({ subtitle_type: e.target.value as MinimaxSynthesisOptions["subtitle_type"] })
              }
            >
              <option value="sentence">sentence</option>
              <option value="word">word</option>
              <option value="word_streaming">word_streaming</option>
            </select>
          </label>

          {supportsContinuousSound(model) && (
            <label className="flex items-center gap-2 text-muted">
              <input
                type="checkbox"
                checked={o.continuous_sound}
                onChange={(e) => patch({ continuous_sound: e.target.checked })}
              />
              Continuous sound (2.8)
            </label>
          )}

          <label className={lc}>
            Transport
            <select
              className={fc}
              value={o.transport}
              onChange={(e) =>
                patch({ transport: e.target.value as MinimaxSynthesisOptions["transport"] })
              }
            >
              <option value="websocket">WebSocket (domyślny)</option>
              <option value="http">HTTP</option>
            </select>
          </label>

          <label className={lc}>
            Region HTTP
            <select
              className={fc}
              value={o.http_region}
              disabled={o.transport !== "http"}
              onChange={(e) =>
                patch({ http_region: e.target.value as MinimaxSynthesisOptions["http_region"] })
              }
            >
              <option value="default">api.minimax.io</option>
              <option value="uw">api-uw (niższy TTFA)</option>
            </select>
          </label>

          <label className={lc}>
            Output format (HTTP)
            <select
              className={fc}
              value={o.output_format}
              onChange={(e) =>
                patch({ output_format: e.target.value as MinimaxSynthesisOptions["output_format"] })
              }
            >
              <option value="hex">hex</option>
              <option value="url">url</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-muted">
            <input type="checkbox" checked={o.stream} onChange={(e) => patch({ stream: e.target.checked })} />
            HTTP stream
          </label>

          <p className="col-span-full text-[10px] text-muted leading-snug">
            Tekst: pauzy <code>&lt;#1.5#&gt;</code>, interjekcje <code>(sighs)</code> (speech-2.8), IPA/pinyin w
            nawiasach. Powyżej 10 000 znaków — automatycznie async T2A.
          </p>
        </div>
      )}
    </div>
  );
}
