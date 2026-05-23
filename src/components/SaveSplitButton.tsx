import { useState } from "react";
import { AUDIO_FORMATS, loadSaveFormat, storeSaveFormat } from "../audioFormats";
import type { AudioFormat } from "../types";
import type { IconSlug } from "../lib/icons";
import Icon from "./Icon";

const ICON_SIZE = 16;

interface Props {
  onSave: (format: AudioFormat) => void;
  disabled?: boolean;
  saveIcon?: IconSlug;
  groupLabel?: string;
  saveTitle?: string;
}

export default function SaveSplitButton({
  onSave,
  disabled,
  saveIcon = "save",
  groupLabel = "Zapis do archiwum",
  saveTitle,
}: Props) {
  const [format, setFormat] = useState<AudioFormat>(loadSaveFormat);

  const pickFormat = (next: AudioFormat) => {
    setFormat(next);
    storeSaveFormat(next);
  };

  return (
    <div className="history-action-group" role="group" aria-label={groupLabel}>
      <button
        type="button"
        className="history-action-btn"
        onClick={() => onSave(format)}
        disabled={disabled}
        title={saveTitle ?? `${groupLabel} (${format.toUpperCase()})`}
        aria-label={saveTitle ?? `${groupLabel} (${format.toUpperCase()})`}
      >
        <Icon name={saveIcon} size={ICON_SIZE} />
      </button>
      <div className="history-format-picker" title={`Format zapisu: ${format.toUpperCase()}`}>
        <Icon name="chevron-down" size={ICON_SIZE} className="pointer-events-none opacity-70" />
        <select
          value={format}
          onChange={(e) => pickFormat(e.target.value as AudioFormat)}
          disabled={disabled}
          aria-label="Format zapisu"
        >
          {AUDIO_FORMATS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
