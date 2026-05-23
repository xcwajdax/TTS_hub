import { useCallback, useEffect, useRef, useState } from "react";
import { AVATAR_SIZE } from "../../lib/avatars";
import { loadImageBlobUrl } from "../../lib/avatarImageLoad";

const VIEWPORT = 280;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

interface Props {
  open: boolean;
  imagePath: string;
  title: string;
  onClose: () => void;
  onSave: (jpegBase64: string) => Promise<void>;
}

export default function AvatarCropModal({ open, imagePath, title, onClose, onSave }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetTransform = useCallback((w: number, h: number) => {
    const cover = Math.max(VIEWPORT / w, VIEWPORT / h);
    setNatural({ w, h });
    setBaseScale(cover);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!open || !imagePath) return;
    let revoked: string | null = null;
    let cancelled = false;
    setError(null);
    setSaving(false);
    setNatural({ w: 0, h: 0 });
    setLoading(true);
    setPreviewUrl(null);

    void loadImageBlobUrl(imagePath)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        revoked = url;
        setPreviewUrl(url);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [open, imagePath]);

  const effectiveScale = baseScale * zoom;

  const exportJpeg = useCallback((): string | null => {
    const img = imgRef.current;
    if (!img || natural.w === 0) return null;
    const s = effectiveScale;
    const cropW = VIEWPORT / s;
    const cropH = VIEWPORT / s;
    let sx = natural.w / 2 - cropW / 2 - offset.x / s;
    let sy = natural.h / 2 - cropH / 2 - offset.y / s;
    sx = Math.max(0, Math.min(natural.w - cropW, sx));
    sy = Math.max(0, Math.min(natural.h - cropH, sy));
    const sw = Math.min(cropW, natural.w - sx);
    const sh = Math.min(cropH, natural.h - sy);

    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#0f1115";
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    try {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
      return canvas.toDataURL("image/jpeg", 0.92);
    } catch {
      return null;
    }
  }, [effectiveScale, natural, offset]);

  const handleSave = async () => {
    const dataUrl = exportJpeg();
    if (!dataUrl) {
      setError("Nie udało się wyeksportować kadru. Spróbuj ponownie.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(dataUrl);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (natural.w === 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset({
      x: d.ox + (e.clientX - d.x),
      y: d.oy + (e.clientY - d.y),
    });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md flex flex-col rounded-lg border border-border bg-panel shadow-xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="px-4 py-3 border-b border-border">
          <h2 id="avatar-crop-title" className="text-sm font-semibold">
            {title}
          </h2>
          <p className="text-[11px] text-muted mt-0.5">
            Przeciągnij zdjęcie, ustaw zoom. Zapisany awatar: JPG {AVATAR_SIZE}×{AVATAR_SIZE} px.
          </p>
        </header>

        <div className="p-4 flex flex-col items-center gap-3">
          <div
            className="avatar-crop-viewport relative overflow-hidden rounded-lg border border-border bg-black/40 cursor-grab active:cursor-grabbing"
            style={{ width: VIEWPORT, height: VIEWPORT }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {loading ? (
              <span className="absolute inset-0 flex items-center justify-center text-xs text-muted">
                Ładowanie…
              </span>
            ) : null}
            {previewUrl ? (
              <img
                ref={imgRef}
                src={previewUrl}
                alt=""
                draggable={false}
                className={`absolute left-1/2 top-1/2 max-w-none select-none pointer-events-none ${
                  natural.w === 0 ? "opacity-0" : ""
                }`}
                style={
                  natural.w > 0
                    ? {
                        width: natural.w * effectiveScale,
                        height: natural.h * effectiveScale,
                        transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                      }
                    : undefined
                }
                onLoad={(e) => {
                  const el = e.currentTarget;
                  resetTransform(el.naturalWidth, el.naturalHeight);
                }}
              />
            ) : null}
            <div
              className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-inset ring-accent/70"
              aria-hidden
            />
          </div>

          <label className="w-full flex flex-col gap-1 text-xs text-muted">
            Powiększenie
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
              disabled={natural.w === 0}
            />
          </label>

          {error ? <p className="text-xs text-red-400 w-full">{error}</p> : null}
        </div>

        <footer className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button type="button" className="btn text-xs" onClick={onClose} disabled={saving}>
            Anuluj
          </button>
          <button
            type="button"
            className="btn-primary text-xs"
            onClick={() => void handleSave()}
            disabled={saving || loading || natural.w === 0}
          >
            {saving ? "Zapisywanie…" : "Zapisz awatar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
