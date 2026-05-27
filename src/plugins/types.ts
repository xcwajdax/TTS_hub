export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  icon: string;
  price: "free" | string;
  builtin: boolean;
  installed: boolean;
  enabled: boolean;
}

export interface SoundboardSlotPublic {
  index: number;
  label: string;
  enabled: boolean;
  shortcut: string;
  shortcutConflict: boolean;
  hasAudio: boolean;
  generationId: string | null;
}

export interface SoundboardPublicView {
  enabled: boolean;
  slots: SoundboardSlotPublic[];
}

export interface SoundboardPlayPayload {
  slotIndex: number;
  path: string;
  label: string;
  generationId: string | null;
}
