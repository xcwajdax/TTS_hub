import { useCallback, useEffect, useMemo, useState } from "react";

import {

  getAppSettings,

  roleplayCreateProject,

  roleplayDeleteProject,

  roleplayListProjects,

  roleplayLoadProject,

  roleplaySaveProject,

  roleplayStartQueue,

} from "../api/tauri";

import type { TtsVoiceProfile } from "../appSettings";

import { useRoleplaySessions } from "../lib/roleplay/useRoleplaySessions";

import { getMockAppSettingsView, getMockRoleplayProject, MOCK_ROLEPLAY_PROJECTS } from "../lib/mockUi";

import { isMockUiMode } from "../lib/mockUi/isMockUiMode";

import BookEditor from "./BookEditor";

import RoleplaySessionTabBar from "./RoleplaySessionTabBar";

import RoleplaySummaryBar from "./RoleplaySummaryBar";

import RoleplayViewTabs from "./RoleplayViewTabs";

import VoicePalette from "./VoicePalette";

import StudioView from "./studio/StudioView";

import { docToSegments } from "./segments";

import { computeGenerationStats } from "./stats";

import type {

  PaletteEntry,

  RoleplayProject,

  RoleplayProjectSummary,

  RoleplayViewTab,

  SaveRoleplayProjectReq,

} from "./types";

import { parsePalette, parseTimeline } from "./types";



interface Props {

  onError: (msg: string) => void;

  onToast: (msg: string) => void;

}



interface SessionData {

  project: RoleplayProject;

  palette: PaletteEntry[];

  activeColor: string | null;

  viewTab: RoleplayViewTab;

}



function defaultViewTab(project: RoleplayProject): RoleplayViewTab {

  return project.status === "studio" || project.status === "generating" ? "timeline" : "script";

}



function ProjectPicker({

  projects,

  onOpen,

  onCreate,

}: {

  projects: RoleplayProjectSummary[];

  onOpen: (id: string) => void;

  onCreate: () => void;

}) {

  return (

    <div className="h-full flex flex-col p-4 gap-4">

      <div className="flex items-center justify-between">

        <div>

          <h1 className="text-xl font-semibold text-heading">Roleplay / Audiobook</h1>

          <p className="text-sm text-muted">

            Wklej rozdział, oznacz dialogi mazakami i wygeneruj wielogłosowy audiobook.

          </p>

        </div>

        <button type="button" className="btn btn-primary" onClick={onCreate}>

          Nowy projekt

        </button>

      </div>

      <div className="grid gap-2 overflow-auto">

        {projects.map((p) => (

          <button

            key={p.id}

            type="button"

            className="text-left border border-border rounded-lg p-3 hover:bg-panel2"

            onClick={() => onOpen(p.id)}

          >

            <div className="font-medium text-heading">{p.name}</div>

            <div className="text-xs text-muted">

              {p.segment_count} segmentów · {p.status} ·{" "}

              {new Date(p.updated_at).toLocaleString("pl-PL")}

            </div>

          </button>

        ))}

        {projects.length === 0 && (

          <p className="text-sm text-muted">Brak projektów — utwórz pierwszy rozdział.</p>

        )}

      </div>

    </div>

  );

}



export default function RoleplayView({ onError, onToast }: Props) {

  const sessionsApi = useRoleplaySessions();

  const [projects, setProjects] = useState<RoleplayProjectSummary[]>([]);

  const [sessionData, setSessionData] = useState<Record<string, SessionData>>({});

  const [profiles, setProfiles] = useState<TtsVoiceProfile[]>([]);

  const [busy, setBusy] = useState(false);

  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [showProjectPicker, setShowProjectPicker] = useState(false);



  const activeId = sessionsApi.activeId;

  const activeData = activeId ? sessionData[activeId] : null;



  const refreshProjects = useCallback(async () => {

    if (isMockUiMode()) {

      setProjects(MOCK_ROLEPLAY_PROJECTS);

      return;

    }

    try {

      setProjects(await roleplayListProjects());

    } catch (e) {

      onError(String(e));

    }

  }, [onError]);



  useEffect(() => {

    void refreshProjects();

    if (isMockUiMode()) {

      setProfiles(getMockAppSettingsView().voice_profiles ?? []);

      return;

    }

    void getAppSettings().then((s) => setProfiles(s.voice_profiles ?? []));

  }, [refreshProjects]);



  const loadProjectIntoSession = useCallback(

    async (id: string) => {

      if (sessionData[id]) {

        sessionsApi.openSession(id, sessionData[id].project.name);

        return;

      }

      setLoadingId(id);

      try {

        let project: RoleplayProject;

        if (isMockUiMode()) {

          const mockProject = getMockRoleplayProject(id);

          if (!mockProject) {

            onError("Tryb mockup — brak przykładowego projektu dla tego wpisu.");

            return;

          }

          project = mockProject;

        } else {

          project = await roleplayLoadProject(id);

        }

        const palette = parsePalette(project.palette_json);

        setSessionData((prev) => ({

          ...prev,

          [id]: {

            project,

            palette,

            activeColor: null,

            viewTab: defaultViewTab(project),

          },

        }));

        sessionsApi.openSession(id, project.name);

        setShowProjectPicker(false);

      } catch (e) {

        onError(String(e));

      } finally {

        setLoadingId(null);

      }

    },

    [sessionData, sessionsApi, onError],

  );



  useEffect(() => {

    if (!activeId || activeData || loadingId === activeId) return;

    void loadProjectIntoSession(activeId);

  }, [activeId, activeData, loadingId, loadProjectIntoSession]);



  const patchActiveSession = useCallback(

    (patch: Partial<SessionData> | ((prev: SessionData) => Partial<SessionData>)) => {

      if (!activeId) return;

      setSessionData((prev) => {

        const current = prev[activeId];

        if (!current) return prev;

        const delta = typeof patch === "function" ? patch(current) : patch;

        return { ...prev, [activeId]: { ...current, ...delta } };

      });

    },

    [activeId],

  );



  const project = activeData?.project ?? null;

  const palette = activeData?.palette ?? [];

  const activeColor = activeData?.activeColor ?? null;

  const viewTab = activeData?.viewTab ?? "script";



  const segments = useMemo(() => {

    if (!project) return [];

    return docToSegments(project.doc_json, palette);

  }, [project, palette]);



  const stats = useMemo(

    () => computeGenerationStats(segments, profiles),

    [segments, profiles],

  );



  const hasTimeline = useMemo(() => {

    if (!project) return false;

    const tl = parseTimeline(project.timeline_json);

    return tl.clips.length > 0 || project.status === "studio" || project.status === "generating";

  }, [project]);



  const createProject = async () => {

    if (isMockUiMode()) {

      onError("Tryb mockup — tworzenie projektu roleplay jest wyłączone.");

      return;

    }

    const name = window.prompt("Nazwa projektu audiobooka:", "Nowy rozdział");

    if (!name?.trim()) return;

    try {

      const p = await roleplayCreateProject(name.trim());

      setSessionData((prev) => ({

        ...prev,

        [p.id]: {

          project: p,

          palette: [],

          activeColor: null,

          viewTab: "script",

        },

      }));

      sessionsApi.openSession(p.id, p.name);

      setShowProjectPicker(false);

      await refreshProjects();

      onToast("Utworzono projekt.");

    } catch (e) {

      onError(String(e));

    }

  };



  const saveProject = async () => {

    if (!project || !activeId) return;

    if (isMockUiMode()) {

      onToast("Tryb mockup — zapis tylko lokalny (bez backendu).");

      return;

    }

    setBusy(true);

    try {

      const req: SaveRoleplayProjectReq = {

        id: project.id,

        name: project.name,

        doc_json: project.doc_json,

        palette_json: JSON.stringify(palette),

        timeline_json: project.timeline_json,

        status: project.status,

        segments: segments.map((s, i) => ({

          id: s.id,

          order_index: i,

          text: s.text,

          voice_profile_id: s.voice_profile_id,

          color: s.color,

        })),

      };

      const saved = await roleplaySaveProject(req);

      patchActiveSession({ project: saved });

      sessionsApi.renameSession(activeId, saved.name);

      await refreshProjects();

      onToast("Zapisano projekt.");

    } catch (e) {

      onError(String(e));

    } finally {

      setBusy(false);

    }

  };



  const startGeneration = async () => {

    if (!project || !activeId) return;

    if (isMockUiMode()) {

      onError("Tryb mockup — generowanie audiobooka jest wyłączone.");

      return;

    }

    setBusy(true);

    try {

      const req: SaveRoleplayProjectReq = {

        id: project.id,

        name: project.name,

        doc_json: project.doc_json,

        palette_json: JSON.stringify(palette),

        timeline_json: project.timeline_json,

        status: project.status,

        segments: segments.map((s, i) => ({

          id: s.id,

          order_index: i,

          text: s.text,

          voice_profile_id: s.voice_profile_id,

          color: s.color,

        })),

      };

      await roleplaySaveProject(req);

      const updated = await roleplayLoadProject(project.id);

      patchActiveSession({

        project: { ...updated, status: "generating" },

        viewTab: "timeline",

      });

      await roleplayStartQueue(project.id);

      onToast("Kolejka generacji uruchomiona.");

    } catch (e) {

      onError(String(e));

    } finally {

      setBusy(false);

    }

  };



  const deleteCurrent = async () => {

    if (!project || !activeId || !window.confirm("Usunąć ten projekt?")) return;

    if (isMockUiMode()) {

      sessionsApi.closeSession(activeId);

      setSessionData((prev) => {

        const next = { ...prev };

        delete next[activeId];

        return next;

      });

      return;

    }

    try {

      await roleplayDeleteProject(project.id);

      sessionsApi.closeSession(activeId);

      setSessionData((prev) => {

        const next = { ...prev };

        delete next[activeId];

        return next;

      });

      await refreshProjects();

    } catch (e) {

      onError(String(e));

    }

  };



  const handleCloseSession = (id: string) => {

    sessionsApi.closeSession(id);

    setSessionData((prev) => {

      const next = { ...prev };

      delete next[id];

      return next;

    });

  };



  if (sessionsApi.sessions.length === 0 && !showProjectPicker) {

    return (

      <ProjectPicker

        projects={projects}

        onOpen={(id) => void loadProjectIntoSession(id)}

        onCreate={() => void createProject()}

      />

    );

  }



  if (showProjectPicker) {

    return (

      <div className="h-full flex flex-col min-h-0">

        <RoleplaySessionTabBar

          sessions={sessionsApi.sessions}

          activeId={sessionsApi.activeId}

          onSelect={sessionsApi.setActiveId}

          onClose={handleCloseSession}

          onRename={sessionsApi.renameSession}

          onAdd={() => void createProject()}

          onOpenProjects={() => setShowProjectPicker(false)}

        />

        <ProjectPicker

          projects={projects.filter((p) => !sessionsApi.sessions.some((s) => s.id === p.id))}

          onOpen={(id) => void loadProjectIntoSession(id)}

          onCreate={() => void createProject()}

        />

      </div>

    );

  }



  if (!project || !activeId) {

    return (

      <div className="h-full flex items-center justify-center text-sm text-muted">

        {loadingId ? "Ładowanie projektu…" : "Wybierz projekt z listy."}

      </div>

    );

  }



  return (

    <div className="h-full flex flex-col min-h-0">

      <RoleplaySessionTabBar

        sessions={sessionsApi.sessions}

        activeId={activeId}

        onSelect={sessionsApi.setActiveId}

        onClose={handleCloseSession}

        onRename={sessionsApi.renameSession}

        onAdd={() => void createProject()}

        onOpenProjects={() => {

          void refreshProjects();

          setShowProjectPicker(true);

        }}

      />



      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0 flex-wrap bg-panel">

        <input

          className="flex-1 min-w-[120px] text-sm bg-panel2 border border-border rounded px-2 py-1"

          value={project.name}

          onChange={(e) => {

            const name = e.target.value;

            patchActiveSession({ project: { ...project, name } });

            sessionsApi.renameSession(activeId, name);

          }}

        />

        <button type="button" className="btn text-xs" onClick={() => void saveProject()} disabled={busy}>

          Zapisz

        </button>

        <button type="button" className="btn text-xs text-red-300" onClick={() => void deleteCurrent()}>

          Usuń

        </button>

      </div>



      <RoleplaySummaryBar stats={stats} busy={busy} onGenerate={() => void startGeneration()} />



      <RoleplayViewTabs

        tab={viewTab}

        hasTimeline={hasTimeline}

        onChange={(tab) => patchActiveSession({ viewTab: tab })}

      />



      {viewTab === "timeline" ? (

        <div className="flex-1 min-h-0">

          <StudioView

            embedded

            project={project}

            profiles={profiles}

            onProjectChange={(p) => patchActiveSession({ project: p })}

            onError={onError}

            onToast={onToast}

          />

        </div>

      ) : (

        <div className="flex flex-1 min-h-0 gap-3 p-3">

          <VoicePalette

            palette={palette}

            profiles={profiles}

            activeColor={activeColor}

            onPaletteChange={(next) => patchActiveSession({ palette: next })}

            onActiveColor={(color) => patchActiveSession({ activeColor: color })}

          />

          <BookEditor

            docJson={project.doc_json}

            activeColor={activeColor}

            disabled={busy}

            onDocChange={(json) => patchActiveSession({ project: { ...project, doc_json: json } })}

          />

        </div>

      )}

    </div>

  );

}

