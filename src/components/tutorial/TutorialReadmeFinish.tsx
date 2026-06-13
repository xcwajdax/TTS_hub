import { useMemo } from "react";
import { markdownToHtml } from "../editor/blockTransform";
import { README_GITHUB_URL, README_ONBOARDING_MARKDOWN } from "./readmeOnboardingContent";

interface Props {
  onOpenAbout: () => void;
  onFinish: () => void;
}

export default function TutorialReadmeFinish({ onOpenAbout, onFinish }: Props) {
  const html = useMemo(() => markdownToHtml(README_ONBOARDING_MARKDOWN), []);

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/55 p-4">
      <div
        className="w-full max-w-lg max-h-[90vh] rounded-lg border border-border bg-bg shadow-xl overflow-hidden flex flex-col"
        role="dialog"
        aria-labelledby="tutorial-readme-title"
        aria-modal="true"
      >
        <header className="shrink-0 px-5 py-4 border-b border-border">
          <h2 id="tutorial-readme-title" className="text-base font-semibold">
            Dokumentacja — szybki start
          </h2>
          <p className="text-xs text-muted mt-1">
            Skrót z README. Pełna dokumentacja jest na GitHubie i w Ustawieniach.
          </p>
        </header>

        <div
          className="flex-1 min-h-0 overflow-y-auto px-5 py-4 text-sm prose-tight tutorial-readme-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <footer className="shrink-0 flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-border">
          <a
            href={README_GITHUB_URL}
            className="btn text-xs"
            target="_blank"
            rel="noreferrer"
          >
            Otwórz README na GitHubie
          </a>
          <button type="button" className="btn text-xs" onClick={onOpenAbout}>
            Ustawienia → O programie
          </button>
          <button type="button" className="btn-primary text-xs" onClick={onFinish}>
            Zakończ
          </button>
        </footer>
      </div>
    </div>
  );
}
