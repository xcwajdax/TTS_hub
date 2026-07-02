import type { ReactNode } from "react";
import type { EditorTab } from "../../lib/editorTabs/types";
import type { UseEditorTabsReturn } from "../../lib/editorTabs/useEditorTabs";
import EditorTabAddButton from "./EditorTabAddButton";
import EditorTabItem from "./EditorTabItem";

interface Props {
  tabsApi: Pick<
    UseEditorTabsReturn,
    | "tabs"
    | "activeTabId"
    | "switchTab"
    | "addTab"
    | "closeTab"
    | "duplicateTab"
    | "incrementTab"
    | "renameTab"
    | "copyTabText"
    | "saveTabToFile"
  >;
  trailing?: ReactNode;
}

export default function EditorTabBar({ tabsApi, trailing }: Props) {
  const {
    tabs,
    activeTabId,
    switchTab,
    addTab,
    closeTab,
    duplicateTab,
    incrementTab,
    renameTab,
    copyTabText,
    saveTabToFile,
  } = tabsApi;

  return (
    <div className="editor-tab-bar flex shrink-0 items-stretch border-b border-border bg-panel min-h-[2rem]">
      <div className="flex flex-1 min-w-0 items-stretch overflow-x-auto scrollbar-thin">
        <EditorTabAddButton onAddTab={addTab} />
        {tabs.map((tab: EditorTab) => (
          <EditorTabItem
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            onSelect={() => switchTab(tab.id)}
            onClose={() => closeTab(tab.id)}
            onRename={(title) => renameTab(tab.id, title)}
            onDuplicate={() => duplicateTab(tab.id)}
            onIncrement={() => incrementTab(tab.id)}
            onCopyText={() => void copyTabText(tab.id)}
            onSaveFile={() => void saveTabToFile(tab.id)}
          />
        ))}
      </div>
      {trailing ? (
        <div className="editor-tab-bar__trailing shrink-0 flex items-center gap-2 px-3 border-l border-border/60">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
