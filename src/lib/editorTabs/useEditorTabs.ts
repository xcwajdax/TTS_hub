import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { nanoid } from "nanoid";
import { blockDocToSourceText, plainTextToBlockDoc } from "../../components/textFilters/BlockEditorPane";
import { isDocEmpty } from "../../components/editor/types";
import { writeTextFile } from "../../api/tauri";
import { isTauriApp } from "../tauriEnv";
import {
  EDITOR_ACTIVATE_TAB_EVENT,
  takePendingTabActivate,
  type EditorActivateTabDetail,
} from "../editorTextLoad";
import { findGenerationById } from "./findGeneration";
import {
  incrementTabTitle,
  nextDefaultTabTitle,
  sanitizeFileStem,
  titleFromPlainText,
} from "./naming";
import { defaultEditorTabsState, loadEditorTabs, saveEditorTabs } from "./persistence";
import {
  cloneBlockDoc,
  createEmptyTab,
  type EditorTab,
  type EditorTabPatch,
  type EditorTabsState,
  serializeTabsState,
} from "./types";

const PERSIST_DEBOUNCE_MS = 300;

export interface UseEditorTabsOptions {
  defaultFilterPresetId: string;
  onTabActivated?: (tab: EditorTab) => void | Promise<void>;
}

export interface OpenGenerationInTabInput {
  text: string;
  generationId: string;
  voiceProfileId?: string | null;
  title?: string;
}

function touchTab(tab: EditorTab, patch: EditorTabPatch): EditorTab {
  const next: EditorTab = {
    ...tab,
    ...patch,
    updatedAt: Date.now(),
  };
  if (patch.blockDoc && !next.titleManual) {
    const derived = titleFromPlainText(blockDocToSourceText(patch.blockDoc));
    if (derived) next.title = derived;
  }
  return next;
}

function mapTabs(state: EditorTabsState, tabId: string, patch: EditorTabPatch): EditorTabsState {
  return {
    ...state,
    tabs: state.tabs.map((t) => (t.id === tabId ? touchTab(t, patch) : t)),
  };
}

export function useEditorTabs({ defaultFilterPresetId, onTabActivated }: UseEditorTabsOptions) {
  const [state, setState] = useState<EditorTabsState>(() =>
    loadEditorTabs(defaultFilterPresetId),
  );
  const persistTimerRef = useRef<number | null>(null);
  const onTabActivatedRef = useRef(onTabActivated);
  onTabActivatedRef.current = onTabActivated;
  const defaultFilterRef = useRef(defaultFilterPresetId);
  defaultFilterRef.current = defaultFilterPresetId;

  const activeTab = useMemo(
    () => state.tabs.find((t) => t.id === state.activeTabId) ?? state.tabs[0] ?? null,
    [state],
  );

  const schedulePersist = useCallback((next: EditorTabsState) => {
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      saveEditorTabs(serializeTabsState(next));
      persistTimerRef.current = null;
    }, PERSIST_DEBOUNCE_MS);
  }, []);

  const commit = useCallback(
    (updater: (prev: EditorTabsState) => EditorTabsState, persist = true) => {
      setState((prev) => {
        const next = updater(prev);
        if (persist) schedulePersist(next);
        return next;
      });
    },
    [schedulePersist],
  );

  const activateTab = useCallback(async (tab: EditorTab) => {
    await onTabActivatedRef.current?.(tab);
  }, []);

  const switchTab = useCallback(
    (tabId: string) => {
      if (tabId === state.activeTabId) return;
      const target = state.tabs.find((t) => t.id === tabId);
      if (!target) return;
      commit((prev) => ({ ...prev, activeTabId: tabId }), false);
      void activateTab(target);
    },
    [state.activeTabId, state.tabs, commit, activateTab],
  );

  useEffect(() => {
    const activateById = (tabId: string) => {
      switchTab(tabId);
    };

    const pending = takePendingTabActivate();
    if (pending) activateById(pending);

    const onActivate = (ev: Event) => {
      const tabId = (ev as CustomEvent<EditorActivateTabDetail>).detail?.tabId;
      if (tabId) activateById(tabId);
    };

    window.addEventListener(EDITOR_ACTIVATE_TAB_EVENT, onActivate);
    return () => window.removeEventListener(EDITOR_ACTIVATE_TAB_EVENT, onActivate);
  }, [switchTab]);

  const addTab = useCallback((voiceProfileId?: string | null) => {
    const id = nanoid(10);
    const title = nextDefaultTabTitle(state.tabs.map((t) => t.title));
    const tab = createEmptyTab(id, title, defaultFilterRef.current, voiceProfileId ?? null);
    commit((prev) => ({
      ...prev,
      activeTabId: id,
      tabs: [...prev.tabs, tab],
    }));
    void activateTab(tab);
  }, [state.tabs, commit, activateTab]);

  const closeTab = useCallback(
    (tabId: string) => {
      let tabToActivate: EditorTab | null = null;
      commit((prev) => {
        if (prev.tabs.length <= 1) {
          const id = nanoid(10);
          const tab = createEmptyTab(id, "Szkic 1", defaultFilterRef.current);
          tabToActivate = tab;
          return { ...defaultEditorTabsState(defaultFilterRef.current), tabs: [tab], activeTabId: id };
        }
        const idx = prev.tabs.findIndex((t) => t.id === tabId);
        if (idx < 0) return prev;
        const nextTabs = prev.tabs.filter((t) => t.id !== tabId);
        let nextActive = prev.activeTabId;
        if (prev.activeTabId === tabId) {
          const neighbor = nextTabs[Math.min(idx, nextTabs.length - 1)]!;
          nextActive = neighbor.id;
          tabToActivate = neighbor;
        }
        return { ...prev, tabs: nextTabs, activeTabId: nextActive };
      });
      if (tabToActivate) void activateTab(tabToActivate);
    },
    [commit, activateTab],
  );

  const duplicateTab = useCallback(
    (tabId: string, incrementTitle = false) => {
      const source = state.tabs.find((t) => t.id === tabId);
      if (!source) return;
      const id = nanoid(10);
      const title = incrementTitle
        ? incrementTabTitle(source.title)
        : `${source.title} (kopia)`;
      const now = Date.now();
      const tab: EditorTab = {
        ...source,
        id,
        title,
        titleManual: true,
        blockDoc: cloneBlockDoc(source.blockDoc),
        generationId: null,
        createdAt: now,
        updatedAt: now,
      };
      commit((prev) => ({
        ...prev,
        activeTabId: id,
        tabs: [...prev.tabs, tab],
      }));
      void activateTab(tab);
    },
    [state.tabs, commit, activateTab],
  );

  const incrementTab = useCallback(
    (tabId: string) => duplicateTab(tabId, true),
    [duplicateTab],
  );

  const renameTab = useCallback(
    (tabId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      commit((prev) => mapTabs(prev, tabId, { title: trimmed, titleManual: true }));
    },
    [commit],
  );

  const updateActiveTab = useCallback(
    (patch: EditorTabPatch) => {
      commit((prev) => mapTabs(prev, prev.activeTabId, patch));
    },
    [commit],
  );

  const updateTab = useCallback(
    (tabId: string, patch: EditorTabPatch) => {
      commit((prev) => mapTabs(prev, tabId, patch));
    },
    [commit],
  );

  const copyTabText = useCallback(async (tabId: string) => {
    const tab = state.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const text = blockDocToSourceText(tab.blockDoc);
    await navigator.clipboard.writeText(text).catch(() => undefined);
  }, [state.tabs]);

  const saveTabToFile = useCallback(async (tabId: string) => {
    const tab = state.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const json = JSON.stringify(
      serializeTabsState({ version: 1, tabs: [tab], activeTabId: tab.id }),
      null,
      2,
    );
    const defaultName = `${sanitizeFileStem(tab.title)}.json`;

    if (isTauriApp()) {
      const dest = await save({
        defaultPath: defaultName,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!dest) return;
      await writeTextFile(dest, json);
      return;
    }

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.tabs]);

  const clearVoiceProfileFromTabs = useCallback(
    (profileId: string) => {
      commit((prev) => ({
        ...prev,
        tabs: prev.tabs.map((t) =>
          t.voiceProfileId === profileId
            ? { ...t, voiceProfileId: null, updatedAt: Date.now() }
            : t,
        ),
      }));
    },
    [commit],
  );

  const linkGenerationToActiveTab = useCallback(
    (generationId: string) => {
      updateActiveTab({ generationId });
    },
    [updateActiveTab],
  );

  const loadTextIntoActiveTab = useCallback(
    (text: string, generationId?: string | null) => {
      updateActiveTab({
        blockDoc: plainTextToBlockDoc(text),
        generationId: generationId ?? null,
      });
    },
    [updateActiveTab],
  );

  const openGenerationInTab = useCallback(
    (input: OpenGenerationInTabInput) => {
      let tabToActivate: EditorTab | null = null;

      commit((prev) => {
        const existing = prev.tabs.find((t) => t.generationId === input.generationId);
        if (existing) {
          const profilePatch =
            input.voiceProfileId && input.voiceProfileId !== existing.voiceProfileId
              ? { voiceProfileId: input.voiceProfileId }
              : null;

          if (profilePatch) {
            tabToActivate = touchTab(existing, profilePatch);
            const next = mapTabs(prev, existing.id, profilePatch);
            if (existing.id !== prev.activeTabId) {
              return { ...next, activeTabId: existing.id };
            }
            return next;
          }

          tabToActivate = existing;
          if (existing.id !== prev.activeTabId) {
            return { ...prev, activeTabId: existing.id };
          }
          return prev;
        }

        const blockDoc = plainTextToBlockDoc(input.text);
        const autoTitle = titleFromPlainText(input.text);
        const title =
          input.title?.trim() || autoTitle || nextDefaultTabTitle(prev.tabs.map((t) => t.title));
        const titleManual = Boolean(input.title?.trim());
        const voiceProfileId = input.voiceProfileId ?? null;

        const active = prev.tabs.find((t) => t.id === prev.activeTabId);
        if (active && isDocEmpty(active.blockDoc) && !active.generationId) {
          tabToActivate = touchTab(active, {
            blockDoc,
            generationId: input.generationId,
            voiceProfileId,
            title,
            titleManual,
          });
          return mapTabs(prev, active.id, {
            blockDoc,
            generationId: input.generationId,
            voiceProfileId,
            title,
            titleManual,
          });
        }

        const id = nanoid(10);
        const now = Date.now();
        const tab: EditorTab = {
          id,
          title,
          titleManual,
          blockDoc,
          voiceProfileId,
          filterPresetId: defaultFilterRef.current,
          generationId: input.generationId,
          createdAt: now,
          updatedAt: now,
        };
        tabToActivate = tab;
        return {
          ...prev,
          activeTabId: id,
          tabs: [...prev.tabs, tab],
        };
      });

      if (tabToActivate) void activateTab(tabToActivate);
    },
    [commit, activateTab],
  );

  useEffect(() => {
    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
    };
  }, []);

  return {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    activeTab,
    switchTab,
    addTab,
    closeTab,
    duplicateTab,
    incrementTab,
    renameTab,
    updateActiveTab,
    updateTab,
    copyTabText,
    saveTabToFile,
    clearVoiceProfileFromTabs,
    linkGenerationToActiveTab,
    loadTextIntoActiveTab,
    openGenerationInTab,
    findGenerationById,
  };
}

export type UseEditorTabsReturn = ReturnType<typeof useEditorTabs>;
