import { useEffect, useRef } from "react";
import { nanoid } from "nanoid";
import { usePlayback } from "../context/PlaybackContext";
import { FACTORY_PRESET_IDS } from "../lib/filterPresetCatalog";
import { loadEditorTabs, saveEditorTabs } from "../lib/editorTabs/persistence";
import { isMockUiMode, MOCK_EDITOR_TEXT } from "../lib/mockUi";

/** Seeds editor text and a draft tab once when mock UI mode is active. */
export default function MockUiBootstrap() {
  const { setEditorText, editorText } = usePlayback();
  const seededRef = useRef(false);

  useEffect(() => {
    if (!isMockUiMode() || seededRef.current) return;
    seededRef.current = true;

    const presetId = FACTORY_PRESET_IDS[0] ?? "default";
    const state = loadEditorTabs(presetId);
    const active = state.tabs.find((tab) => tab.id === state.activeTabId) ?? state.tabs[0];
    const needsDraftSeed =
      !active ||
      active.blockDoc.blocks.every((block) => block.text.trim().length === 0);

    if (needsDraftSeed && active) {
      const tabId = active.id;
      const now = Date.now();
      const nextTabs = state.tabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              title: "Szkic mockup",
              titleManual: true,
              updatedAt: now,
              blockDoc: {
                blocks: [
                  {
                    id: nanoid(8),
                    kind: "paragraph" as const,
                    text: MOCK_EDITOR_TEXT,
                    included: true,
                  },
                ],
              },
            }
          : tab,
      );
      saveEditorTabs({ ...state, tabs: nextTabs });
    }

    if (!editorText.trim()) {
      setEditorText(MOCK_EDITOR_TEXT);
    }
  }, [editorText, setEditorText]);

  return null;
}
