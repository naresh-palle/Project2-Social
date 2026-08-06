import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { X, Check, ZoomIn } from "lucide-react";

const MAX_OUTPUT = {
  avatar: 900,
  cover: 1600,
  default: 1200,
};

async function loadImage(imageSrc) {
  if (typeof createImageBitmap === "function" && imageSrc.startsWith("blob:")) {
    try {
      const res = await fetch(imageSrc);
      const blob = await res.blob();
      return await createImageBitmap(blob);
    } catch {
      /* fall through to Image() */
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
  });
}

function releaseImage(image) {
  if (image && typeof image.close === "function") {
    try { image.close(); } catch { /* ignore */ }
  }
}

/**
 * Crop + downscale to a reasonable upload size so Apply stays fast
 * even when the source photo is multi‑megapixel.
 */
async function getCroppedBlob(imageSrc, cropPixels, maxEdge = MAX_OUTPUT.default) {
  const image = await loadImage(imageSrc);
  try {
    const { width, height, x, y } = cropPixels;
    const srcW = Math.max(1, Math.round(width));
    const srcH = Math.max(1, Math.round(height));
    const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
    const outW = Math.max(1, Math.round(srcW * scale));
    const outH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "medium";
    ctx.drawImage(image, x, y, width, height, 0, 0, outW, outH);

    const quality = outW * outH > 800_000 ? 0.78 : 0.85;
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });
    return blob;
  } finally {
    releaseImage(image);
  }
}

/**
 * Modal cropper shown after picking a profile / cover image.
 * Calls onComplete(File) with the cropped JPEG, or onCancel().
 * Keeps the modal open through upload so progress is visible.
 */
export function ImageCropModal({
  imageSrc,
  aspect = 1,
  title = "Crop image",
  target = "default",
  onComplete,
  onCancel,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | cropping | uploading

  const onCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const apply = async () => {
    if (!croppedAreaPixels || busy) return;
    setBusy(true);
    setPhase("cropping");
    try {
      const maxEdge = MAX_OUTPUT[target] || MAX_OUTPUT.default;
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, maxEdge);
      if (!blob) throw new Error("Crop failed");
      const file = new File([blob], `crop-${Date.now()}.jpg`, { type: "image/jpeg" });
      setPhase("uploading");
      await onComplete(file);
    } catch (err) {
      console.error(err);
      setBusy(false);
      setPhase("idle");
    }
  };

  const statusLabel =
    phase === "uploading" ? "Uploading…" :
    phase === "cropping" ? "Applying crop…" :
    "Apply crop";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg bg-[#121212] border border-white/20 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="font-editorial text-xl">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="p-2 opacity-60 hover:opacity-100 disabled:opacity-30"
            aria-label="Cancel crop"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="relative h-72 bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
            showGrid={false}
          />
        </div>
        <div className="px-4 py-4 space-y-4">
          <label className="flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] uppercase opacity-70">
            <ZoomIn className="w-3.5 h-3.5" /> Zoom
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              disabled={busy}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[#FF3B30]"
            />
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="btn-solid flex-1 justify-center py-3 bg-white/10 text-white text-sm disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={busy || !croppedAreaPixels}
              className="btn-solid flex-1 justify-center py-3 bg-[#FF3B30] text-white text-sm disabled:opacity-60"
            >
              <Check className="w-4 h-4" /> {statusLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
