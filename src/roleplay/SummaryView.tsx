import type { RoleplayGenerationStats } from "./stats";

interface Props {
  stats: RoleplayGenerationStats;
  onBack: () => void;
  onConfirm: () => void;
  busy?: boolean;
}

export default function SummaryView({ stats, onBack, onConfirm, busy }: Props) {
  const formatDur = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m} min ${s} s` : `${s} s`;
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-4 p-4">
      <div>
        <h2 className="text-lg font-semibold text-heading">Podsumowanie przed generacją</h2>
        <p className="text-sm text-muted">Sprawdź statystyki i potwierdź kolejkowanie segmentów.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Segmenty" value={String(stats.totalSegments)} />
        <StatCard label="Znaki" value={stats.totalChars.toLocaleString("pl-PL")} />
        <StatCard label="Szac. audio" value={formatDur(stats.estimatedAudioSec)} />
        <StatCard label="Szac. generacja" value={formatDur(stats.estimatedGenSec)} />
      </div>

      {stats.byVoice.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-panel2 text-muted text-left">
              <tr>
                <th className="px-3 py-2">Głos</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Segmenty</th>
                <th className="px-3 py-2">Znaki</th>
              </tr>
            </thead>
            <tbody>
              {stats.byVoice.map((row) => (
                <tr key={row.voice_profile_id} className="border-t border-border">
                  <td className="px-3 py-2 text-heading">{row.label}</td>
                  <td className="px-3 py-2">{row.provider}</td>
                  <td className="px-3 py-2">{row.segments}</td>
                  <td className="px-3 py-2">{row.chars.toLocaleString("pl-PL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stats.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-900/20 p-3 text-sm text-amber-100 space-y-1">
          {stats.warnings.map((w) => (
            <div key={w}>⚠ {w}</div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        <button type="button" className="btn" onClick={onBack} disabled={busy}>
          Wróć do skryptu
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onConfirm}
          disabled={busy || stats.totalSegments === 0}
        >
          {busy ? "Uruchamianie…" : "Generuj wszystko"}
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-panel2 px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold text-heading">{value}</div>
    </div>
  );
}
