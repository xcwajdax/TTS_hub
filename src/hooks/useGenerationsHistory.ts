import { useCallback, useState } from "react";
import {
  getSessionId,
  listFolders,
  listHistory,
  listJobs,
  listTags,
} from "../api/tauri";
import type { ArchiveFolder, ArchiveTag, Generation } from "../types";
import { getMockHistoryState } from "../lib/mockUi";
import { isMockUiMode } from "../lib/mockUi/isMockUiMode";
import { isTauriApp } from "../lib/tauriEnv";

export interface GenerationsHistoryState {
  session: Generation[];
  archive: Generation[];
  cursorFeed: Generation[];
  botsFeed: Generation[];
  folders: ArchiveFolder[];
  tags: ArchiveTag[];
  interrupted: Generation[];
  currentSessionId: string;
}

export function useGenerationsHistory(onError: (e: string) => void) {
  const [session, setSession] = useState<Generation[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState("");
  const [archive, setArchive] = useState<Generation[]>([]);
  const [cursorFeed, setCursorFeed] = useState<Generation[]>([]);
  const [botsFeed, setBotsFeed] = useState<Generation[]>([]);
  const [folders, setFolders] = useState<ArchiveFolder[]>([]);
  const [tags, setTags] = useState<ArchiveTag[]>([]);
  const [interrupted, setInterrupted] = useState<Generation[]>([]);

  const refresh = useCallback(async () => {
    if (isMockUiMode()) {
      const mock = getMockHistoryState();
      setSession(mock.session);
      setCurrentSessionId(mock.currentSessionId);
      setArchive(mock.archive);
      setFolders(mock.folders);
      setTags(mock.tags);
      setCursorFeed(mock.cursorFeed);
      setBotsFeed(mock.botsFeed);
      return;
    }
    if (!isTauriApp()) return;
    try {
      const [s, a, f, t, cursor, bots, sid] = await Promise.all([
        listHistory("session"),
        listHistory("archive"),
        listFolders(),
        listTags(),
        listHistory("cursor"),
        listHistory("bots"),
        getSessionId(),
      ]);
      setSession(s);
      setCurrentSessionId(sid);
      setArchive(a);
      setFolders(f);
      setTags(t);
      setCursorFeed(cursor);
      setBotsFeed(bots);
    } catch (e) {
      onError(String(e));
    }
  }, [onError]);

  const refreshInterrupted = useCallback(async () => {
    if (isMockUiMode()) {
      setInterrupted([]);
      return [];
    }
    if (!isTauriApp()) return [];
    try {
      const list = await listJobs("interrupted");
      setInterrupted(list);
      return list;
    } catch (e) {
      onError(String(e));
      return [];
    }
  }, [onError]);

  return {
    session,
    archive,
    cursorFeed,
    botsFeed,
    folders,
    tags,
    interrupted,
    currentSessionId,
    refresh,
    refreshInterrupted,
  };
}
