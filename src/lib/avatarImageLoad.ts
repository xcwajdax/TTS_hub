import { readImageFileBase64 } from "../api/tauri";

function mimeFromPath(filePath: string): string {
  const ext = filePath.split(/[/\\]/).pop()?.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}

/** Load a local image into a same-origin blob URL safe for canvas export. */
export async function loadImageBlobUrl(filePath: string): Promise<string> {
  const b64 = await readImageFileBase64(filePath);
  const mime = mimeFromPath(filePath);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
}
