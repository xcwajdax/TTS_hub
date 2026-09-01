import { useState } from "react";
import type { RoleplayGenerationStats } from "./stats";

interface Props {
  stats: RoleplayGenerationStats;
  busy?: boolean;
  onGenerate: () => void;
}

function formatDur(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

export default function RoleplaySummaryBar({ stats, busy, onGenerate }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="roleplay-summary-bar shrink-0 border-b border-border bg-panel2/40">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-xs">
        <span className="text-muted">
          <strong className="text-heading font-medium">{stats.totalSegments}</strong> segmentów
        </span>
        <span className="text-muted">
          <strong className="text-heading font-medium">{stats.totalChars.toLocaleString("pl-PL")}</strong>{" "}
          znaków
        </span>
        <span className="text-muted">
          audio ~<strong className="text-heading font-medium">{formatDur(stats.estimatedAudioSec)}</strong>
        </span>
        <span className="text-muted">
          gen. ~<strong className="text-heading font-medium">{formatDur(stats.estimatedGenSec)}</strong>
        </span>

        {stats.warnings.length > 0 ? (
          <button
            type="button"
            className="text-amber-300 hover:text-amber-200"
            title={stats.warnings.join("\n")}
            onClick={() => setExpanded((v) => !v)}
          >
            ⚠ {stats.warnings.length} {stats.warnings.length === 1 ? "uwaga" : "uwagi"}
          </button>
        ) : null}

        {stats.byVoice.length > 0 ? (
          <button
            type="button"
            className="text-muted hover:text-heading ml-auto sm:ml-0"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Ukryj głosy" : "Głosy ▾"}
          </button>
        ) : (
          <span className="flex-1 min-w-[1rem]" />
        )}

        <button
          type="button"
          className="btn btn-primary text-xs ml-auto sm:ml-0"
          onClick={onGenerate}
          disabled={busy || stats.totalSegments === 0}
          title={stats.totalSegments === 0 ? "Zaznacz tekst mazakami głosów" : undefined}
        >
          {busy ? "Uruchamianie…" : "Generuj wszystko"}
        </button>
      </div>

      {expanded && (stats.byVoice.length > 0 || stats.warnings.length > 0) ? (
        <div className="px-3 pb-2 space-y-2">
          {stats.warnings.length > 0 ? (
            <div className="rounded border border-amber-700/40 bg-amber-900/15 px-2 py-1.5 text-xs text-amber-100 space-y-0.5">
              {stats.warnings.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
          ) : null}
          {stats.byVoice.length > 0 ? (
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="bg-panel text-muted text-left">
                  <tr>
                    <th className="px-2 py-1">Głos</th>
                    <th className="px-2 py-1">Provider</th>
                    <th className="px-2 py-1">Seg.</th>
                    <th className="px-2 py-1">Znaki</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byVoice.map((row) => (
                    <tr key={row.voice_profile_id} className="border-t border-border">
                      <td className="px-2 py-1 text-heading">{row.label}</td>
                      <td className="px-2 py-1">{row.provider}</td>
                      <td className="px-2 py-1">{row.segments}</td>
                      <td className="px-2 py-1">{row.chars.toLocaleString("pl-PL")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
