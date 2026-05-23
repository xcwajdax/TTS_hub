import type { ProbeResult } from "../../api/tauri";

interface Props {
  probing: boolean;
  result: ProbeResult | null;
}

export default function ProbeStatus({ probing, result }: Props) {
  if (probing) {
    return <p className="text-xs text-muted">Testowanie połączenia…</p>;
  }
  if (!result) return null;
  return (
    <p
      className={`text-xs ${result.ok ? "text-green-400" : "text-red-400"}`}
      role="status"
    >
      {result.message}
    </p>
  );
}
