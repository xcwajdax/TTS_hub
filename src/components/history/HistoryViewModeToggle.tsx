import type { IconSlug } from "../../lib/icons";
import { HISTORY_TOOLBAR_BTN, HISTORY_TOOLBAR_BTN_ACTIVE } from "../../lib/historyToolbar";
import Icon from "../Icon";
import HistoryToolbarRow from "./HistoryToolbarRow";

interface Props {
  compactView: boolean;
  onChange: (compact: boolean) => void;
}

const VIEW_MODES: {
  id: "full" | "compact";
  label: string;
  icon: IconSlug;
  description: string;
}[] = [
  {
    id: "full",
    label: "Pełny",
    icon: "view-full",
    description: "Karta z podglądem tekstu, metadanymi i akcjami",
  },
  {
    id: "compact",
    label: "Kompakt",
    icon: "view-compact",
    description: "Jeden wiersz: tytuł i data; kliknięcie odtwarza",
  },
];

export default function HistoryViewModeToggle({ compactView, onChange }: Props) {
  return (
    <HistoryToolbarRow
      label="Widok"
      hint="Układ listy"
      role="group"
      ariaLabel="Widok listy historii"
    >
      <div className="history-toolbar-segment grid grid-cols-2 w-full min-w-0 rounded border border-border overflow-hidden">
        {VIEW_MODES.map((mode, index) => {
          const active = mode.id === "compact" ? compactView : !compactView;
          return (
            <button
              key={mode.id}
              type="button"
              className={`${HISTORY_TOOLBAR_BTN} !min-w-0 w-full !rounded-none h-7 px-1 gap-1 justify-center text-[10px] font-medium ${
                index > 0 ? "border-l border-border" : ""
              } ${active ? HISTORY_TOOLBAR_BTN_ACTIVE : ""}`}
              aria-pressed={active}
              title={mode.description}
              aria-label={`${mode.label}. ${mode.description}`}
              onClick={() => onChange(mode.id === "compact")}
            >
              <Icon name={mode.icon} size={14} className="shrink-0" />
              <span className="truncate min-w-0">{mode.label}</span>
            </button>
          );
        })}
      </div>
    </HistoryToolbarRow>
  );
}
