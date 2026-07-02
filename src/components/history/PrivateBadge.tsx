export default function PrivateBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`history-private-badge ${className}`.trim()} title="Generacja prywatna">
      PRYWATNE
    </span>
  );
}
