interface Props {
  title: string;
  description?: string;
}

export default function SettingsPageHeader({ title, description }: Props) {
  return (
    <header className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? <p className="text-xs text-muted leading-relaxed">{description}</p> : null}
    </header>
  );
}
