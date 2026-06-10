import { useEffect, useState } from "react";
import { getTokenUsage } from "../../../api/tauri";
import type { UsageSummary, UsageTotals } from "../../../types";

function formatInt(n: number): string {
  return n.toLocaleString("pl-PL");
}

function UsageTotalsBlock({ title, totals }: { title: string; totals: UsageTotals }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs uppercase tracking-wide text-muted">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted">Ukończone generacje</dt>
        <dd className="text-right tabular-nums">{formatInt(totals.generations_done)}</dd>
        <dt className="text-muted">Tokeny wejścia</dt>
        <dd className="text-right tabular-nums">{formatInt(totals.prompt_tokens)}</dd>
        <dt className="text-muted">Tokeny wyjścia</dt>
        <dd className="text-right tabular-nums">{formatInt(totals.output_tokens)}</dd>
        <dt className="text-muted">Tokeny łącznie</dt>
        <dd className="text-right tabular-nums font-medium">{formatInt(totals.total_tokens)}</dd>
        <dt className="text-muted">Znaki wejściowe</dt>
        <dd className="text-right tabular-nums">{formatInt(totals.input_chars)}</dd>
      </dl>
    </section>
  );
}

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  useEffect(() => {
    getTokenUsage()
      .then(setUsage)
      .catch(() => setUsage(null));
  }, []);

  return (
    <div className="flex flex-col gap-6 text-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Zużycie</h2>
        <p className="text-xs text-muted">
          Statystyki tokenów i generacji. Tylko do odczytu — aktualizowane po zakończeniu generacji.
        </p>
      </header>

      <p className="text-[11px] text-muted">
        Tokeny są zapisywane po zakończeniu generacji Google Gemini (pole usageMetadata z API).
        Voice Box zapisuje tylko liczbę znaków wejściowych — lokalny silnik nie zwraca tokenów.
        Szacunkowe koszty (płatny tier) przy generacji i w historii — na podstawie{" "}
        <a
          href="https://ai.google.dev/gemini-api/docs/pricing?hl=pl"
          className="underline hover:text-accent2"
          target="_blank"
          rel="noreferrer"
        >
          cennika Gemini TTS
        </a>
        .
      </p>

      {!usage ? (
        <p className="text-muted text-xs">Ładowanie statystyk…</p>
      ) : (
        <div className="flex flex-col gap-6">
          <UsageTotalsBlock title="Bieżąca sesja" totals={usage.current_session} />
          <UsageTotalsBlock title="Łącznie (wszystkie sesje)" totals={usage.all_time} />
        </div>
      )}
    </div>
  );
}
