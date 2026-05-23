import type { QuickSetupHelpTopic } from "./helpContent";
import { QUICK_SETUP_HELP } from "./helpContent";

interface Props {
  topic: QuickSetupHelpTopic;
}

export default function QuickSetupHelp({ topic }: Props) {
  const section = QUICK_SETUP_HELP[topic];
  return (
    <aside className="rounded border border-border bg-panel/80 p-3 text-xs leading-relaxed">
      <h4 className="font-semibold text-accent2 mb-1.5">{section.title}</h4>
      <p className="text-muted whitespace-pre-wrap">{section.body}</p>
      {section.links && section.links.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {section.links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-accent2 underline hover:opacity-90"
                target="_blank"
                rel="noreferrer"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
