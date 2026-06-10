import { useEffect, useRef, useState, type ReactNode } from "react";
import type { IconSlug } from "../../lib/icons";
import {
  SOURCE_FILTER_META,
  SOURCE_FILTER_ORDER,
  sourceFilterAccent,
} from "../../lib/historySourceUi";
import {
  HISTORY_TOOLBAR_BTN,
  HISTORY_TOOLBAR_BTN_ACTIVE,
  type HistoryGroupingMode,
} from "../../lib/historyToolbar";
import { useSourceAvatars } from "../../hooks/useAvatars";
import Icon from "../Icon";
import HistoryToolbarButton from "./HistoryToolbarButton";
import type { SourceFilter } from "./HistorySourceFilterBar";

interface Props {
  compactView: boolean;
  onCompactViewChange: (compact: boolean) => void;
  groupingMode: HistoryGroupingMode;
  onGroupingModeChange: (mode: HistoryGroupingMode) => void;
  showGrouping?: boolean;
  selectionMode: boolean;
  onSelectionModeChange: (enabled: boolean) => void;
  sourceFilter: SourceFilter;
  onSourceFilterChange: (value: SourceFilter) => void;
  showSourceFilter?: boolean;
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

const GROUPING_MODES: {
  id: HistoryGroupingMode;
  label: string;
  icon: IconSlug;
  description: string;
}[] = [
  {
    id: "date",
    label: "Data",
    icon: "view-full",
    description: "Grupuj po dacie (Dziś, Wczoraj…)",
  },
  {
    id: "profile",
    label: "Profil",
    icon: "source-manual",
    description: "Grupuj po profilu głosowym",
  },
];

function SegmentGroup({ children }: { children: ReactNode }) {
  return (
    <div className="history-toolbar-segment flex shrink-0 rounded border border-border overflow-hidden">
      {children}
    </div>
  );
}

function SegmentButton({
  active,
  title,
  ariaLabel,
  onClick,
  icon,
  label,
  borderLeft,
}: {
  active: boolean;
  title: string;
  ariaLabel: string;
  onClick: () => void;
  icon: IconSlug;
  label: string;
  borderLeft?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${HISTORY_TOOLBAR_BTN} !min-w-0 !rounded-none h-7 px-1.5 gap-0.5 justify-center text-[9px] font-medium ${
        borderLeft ? "border-l border-border" : ""
      } ${active ? HISTORY_TOOLBAR_BTN_ACTIVE : ""}`}
      aria-pressed={active}
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <Icon name={icon} size={12} className="shrink-0" />
      <span className="truncate max-w-[2.5rem] hidden sm:inline">{label}</span>
    </button>
  );
}

export default function HistoryCompactToolbar({
  compactView,
  onCompactViewChange,
  groupingMode,
  onGroupingModeChange,
  showGrouping = true,
  selectionMode,
  onSelectionModeChange,
  sourceFilter,
  onSourceFilterChange,
  showSourceFilter = true,
}: Props) {
  const sourceAvatars = useSourceAvatars();
  const [sourceOpen, setSourceOpen] = useState(false);
  const sourceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sourceOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (sourceRef.current && !sourceRef.current.contains(e.target as Node)) {
        setSourceOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [sourceOpen]);

  const sourceLabel =
    sourceFilter === "all"
      ? "Źródło"
      : SOURCE_FILTER_META[sourceFilter].label;

  return (
    <div
      className="history-compact-toolbar flex items-center gap-1 px-2 py-1 border-b border-border shrink-0 min-w-0 overflow-visible"
      role="toolbar"
      aria-label="Kontrolki listy historii"
    >
      <SegmentGroup>
        {VIEW_MODES.map((mode, index) => {
          const active = mode.id === "compact" ? compactView : !compactView;
          return (
            <SegmentButton
              key={mode.id}
              active={active}
              title={mode.description}
              ariaLabel={`${mode.label}. ${mode.description}`}
              icon={mode.icon}
              label={mode.label}
              borderLeft={index > 0}
              onClick={() => onCompactViewChange(mode.id === "compact")}
            />
          );
        })}
      </SegmentGroup>

      {showGrouping && (
        <SegmentGroup>
          {GROUPING_MODES.map((mode, index) => (
            <SegmentButton
              key={mode.id}
              active={groupingMode === mode.id}
              title={mode.description}
              ariaLabel={`${mode.label}. ${mode.description}`}
              icon={mode.icon}
              label={mode.label}
              borderLeft={index > 0}
              onClick={() => onGroupingModeChange(mode.id)}
            />
          ))}
        </SegmentGroup>
      )}

      <button
        type="button"
        className={`${HISTORY_TOOLBAR_BTN} shrink-0 h-7 w-7 !min-w-0 !px-0 justify-center ${
          selectionMode ? HISTORY_TOOLBAR_BTN_ACTIVE : ""
        }`}
        aria-pressed={selectionMode}
        title={selectionMode ? "Wyłącz zaznaczanie wielu pozycji" : "Zaznacz wiele pozycji (akcje zbiorcze)"}
        aria-label={selectionMode ? "Wyłącz zaznaczanie" : "Zaznacz wiele"}
        onClick={() => onSelectionModeChange(!selectionMode)}
      >
        <Icon name="copy" size={14} />
      </button>

      {showSourceFilter && (
        <div ref={sourceRef} className="relative shrink-0 ml-auto min-w-0">
          <button
            type="button"
            className={`${HISTORY_TOOLBAR_BTN} h-7 px-1.5 gap-0.5 text-[9px] max-w-[5.5rem] ${
              sourceFilter !== "all" ? HISTORY_TOOLBAR_BTN_ACTIVE : ""
            }`}
            aria-expanded={sourceOpen}
            aria-haspopup="true"
            title="Filtr źródła generacji"
            onClick={() => setSourceOpen((v) => !v)}
          >
            <span className="truncate">{sourceLabel}</span>
            <Icon
              name="chevron-down"
              size={10}
              className={`shrink-0 transition-transform ${sourceOpen ? "rotate-180" : ""}`}
            />
          </button>
          {sourceOpen && (
            <div
              className="absolute right-0 top-full mt-0.5 z-50 w-[9.5rem] p-0.5 rounded border border-border bg-panel shadow-lg grid grid-cols-3 gap-0.5"
              role="menu"
            >
              {SOURCE_FILTER_ORDER.map((id) => {
                const meta = SOURCE_FILTER_META[id];
                const active = sourceFilter === id;
                return (
                  <HistoryToolbarButton
                    key={id}
                    fill
                    label={meta.label}
                    title={meta.description}
                    icon={meta.icon}
                    avatarPath={id === "all" ? null : sourceAvatars[id]}
                    active={active}
                    accentColor={sourceFilterAccent(id)}
                    onClick={() => {
                      onSourceFilterChange(id);
                      setSourceOpen(false);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
