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
import BookEditor from "./BookEditor";
import SummaryView from "./SummaryView";
import VoicePalette from "./VoicePalette";
import StudioView from "./studio/StudioView";
import { docToSegments } from "./segments";
import { computeGenerationStats } from "./stats";
import type {
  PaletteEntry,
  RoleplayPhase,
  RoleplayProject,
  RoleplayProjectSummary,
  SaveRoleplayProjectReq,
} from "./types";
import { parsePalette } from "./types";

interface Props {
  onError: (msg: string) => void;
  onToast: (msg: string) => void;
}

export default function RoleplayView({ onError, onToast }: Props) {
  const [projects, setProjects] = useState<RoleplayProjectSummary[]>([]);
  const [project, setProject] = useState<RoleplayProject | null>(null);
  const [phase, setPhase] = useState<RoleplayPhase>("script");
  const [profiles, setProfiles] = useState<TtsVoiceProfile[]>([]);
  const [palette, setPalette] = useState<PaletteEntry[]>([]);
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshProjects = useCallback(async () => {
    try {
      setProjects(await roleplayListProjects());
    } catch (e) {
      onError(String(e));
    }
  }, [onError]);

  useEffect(() => {
    void refreshProjects();
    void getAppSettings().then((s) => setProfiles(s.voice_profiles ?? []));
  }, [refreshProjects]);

  const segments = useMemo(() => {
    if (!project) return [];
    return docToSegments(project.doc_json, palette);
  }, [project, palette]);

  const stats = useMemo(
    () => computeGenerationStats(segments, profiles),
    [segments, profiles],
  );

  const openProject = async (id: string) => {
    try {
      const p = await roleplayLoadProject(id);
      setProject(p);
      setPalette(parsePalette(p.palette_json));
      setPhase(p.status === "studio" || p.status === "generating" ? "studio" : "script");
    } catch (e) {
      onError(String(e));
    }
  };

  const createProject = async () => {
    const name = window.prompt("Nazwa projektu audiobooka:", "Nowy rozdział");
    if (!name?.trim()) return;
    try {
      const p = await roleplayCreateProject(name.trim());
      setProject(p);
      setPalette([]);
      setPhase("script");
      await refreshProjects();
      onToast("Utworzono projekt.");
    } catch (e) {
      onError(String(e));
    }
  };

  const saveProject = async (nextPhase?: RoleplayPhase) => {
    if (!project) return;
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
      setProject(saved);
      if (nextPhase) setPhase(nextPhase);
      await refreshProjects();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const goToSummary = async () => {
    await saveProject("summary");
  };

  const startGeneration = async () => {
    if (!project) return;
    setBusy(true);
    try {
      await saveProject();
      const updated = await roleplayLoadProject(project.id);
      setProject({ ...updated, status: "generating" });
      await roleplayStartQueue(project.id);
      setPhase("studio");
      onToast("Kolejka generacji uruchomiona.");
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteCurrent = async () => {
    if (!project || !window.confirm("Usunąć ten projekt?")) return;
    try {
      await roleplayDeleteProject(project.id);
      setProject(null);
      await refreshProjects();
    } catch (e) {
      onError(String(e));
    }
  };

  if (!project) {
    return (
      <div className="h-full flex flex-col p-4 gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-heading">Roleplay / Audiobook</h1>
            <p className="text-sm text-muted">
              Wklej rozdział, oznacz dialogi mazakami i wygeneruj wielogłosowy audiobook.
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => void createProject()}>
            Nowy projekt
          </button>
        </div>
        <div className="grid gap-2 overflow-auto">
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              className="text-left border border-border rounded-lg p-3 hover:bg-panel2"
              onClick={() => void openProject(p.id)}
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

  if (phase === "studio") {
    return (
      <StudioView
        project={project}
        profiles={profiles}
        onProjectChange={setProject}
        onBackToSummary={() => setPhase("summary")}
        onError={onError}
        onToast={onToast}
      />
    );
  }

  if (phase === "summary") {
    return (
      <SummaryView
        stats={stats}
        busy={busy}
        onBack={() => setPhase("script")}
        onConfirm={() => void startGeneration()}
      />
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center gap-2 p-2 border-b border-border shrink-0 flex-wrap">
        <button type="button" className="btn text-xs" onClick={() => setProject(null)}>
          ← Projekty
        </button>
        <input
          className="flex-1 min-w-[120px] text-sm bg-panel border border-border rounded px-2 py-1"
          value={project.name}
          onChange={(e) => setProject({ ...project, name: e.target.value })}
        />
        <button type="button" className="btn text-xs" onClick={() => void saveProject()} disabled={busy}>
          Zapisz
        </button>
        <button type="button" className="btn btn-primary text-xs" onClick={() => void goToSummary()} disabled={busy}>
          Podsumowanie →
        </button>
        <button type="button" className="btn text-xs text-red-300" onClick={() => void deleteCurrent()}>
          Usuń
        </button>
        <span className="text-xs text-muted ml-auto">{segments.length} segmentów</span>
      </div>
      <div className="flex flex-1 min-h-0 gap-3 p-3">
        <VoicePalette
          palette={palette}
          profiles={profiles}
          activeColor={activeColor}
          onPaletteChange={setPalette}
          onActiveColor={setActiveColor}
        />
        <BookEditor
          docJson={project.doc_json}
          activeColor={activeColor}
          disabled={busy}
          onDocChange={(json) => setProject({ ...project, doc_json: json })}
        />
      </div>
    </div>
  );
}
