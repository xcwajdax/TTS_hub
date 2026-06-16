import VideoTemplateCreator from "../../video/VideoTemplateCreator";
import type { SettingsView, SettingsUpdater } from "../useSettingsView";
import { BUILTIN_WHATSAPP_TEMPLATE_ID } from "../../../types/videoTemplate";

interface Props {
  view: SettingsView;
  update: SettingsUpdater;
  onError: (m: string) => void;
  onSuccess?: (m: string) => void;
}

export default function VideoPage({ view, update, onError, onSuccess }: Props) {
  return (
    <div className="flex flex-col gap-6 text-sm max-w-5xl">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Wideo / MP4</h2>
        <p className="text-xs text-muted">
          Kreator szablonów wideo WYSIWYG — układ okładki, karaoke, stopki i watermarku. Szablony
          sterują eksportem MP4 do schowka i biblioteki Wideo.
        </p>
      </header>

      <VideoTemplateCreator
        defaultTemplateId={view.default_video_template_id ?? BUILTIN_WHATSAPP_TEMPLATE_ID}
        autoArchive={view.auto_archive_mp4_on_clipboard ?? true}
        onDefaultTemplateChange={(id) => update("default_video_template_id", id)}
        onAutoArchiveChange={(v) => update("auto_archive_mp4_on_clipboard", v)}
        onError={onError}
        onSuccess={onSuccess}
      />
    </div>
  );
}
