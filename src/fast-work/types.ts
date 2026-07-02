export interface FastWorkGeneration {
  id: string;
  createdAt: number;
  title: string;
  text: string;
  filePath: string;
  format: string;
  durationMs?: number | null;
  status: string;
  error?: string | null;
}

export interface FastWorkSettingsView {
  profileName: string;
  sourceProfileName: string;
  saveFormat: string;
  shortcut?: string | null;
  outputDir: string;
  exportedAt: number;
}

export interface FastWorkExportResult {
  destDir: string;
  configPath: string;
  launcherPath?: string | null;
}
