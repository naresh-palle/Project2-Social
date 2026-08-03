import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import { X, Check, ZoomIn } from "lucide-react";

async function getCroppedBlob(imageSrc, cropPixels) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const { width, height, x, y } = cropPixels;
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  ctx.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}

/**
 * Modal cropper shown after picking a profile / cover image.
 * Calls onComplete(File) with the cropped JPEG, or onCancel().
 */
export function ImageCropModal({
  imageSrc,
  aspect = 1,
  title = "Crop image",
  onComplete,
  onCancel,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_area, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const apply = async () => {
    if (!croppedAreaPixels) return;
    setBusy(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      if (!blob) throw new Error("Crop failed");
      const file = new File([blob], `crop-${Date.now()}.jpg`, { type: "image/jpeg" });
      await onComplete(file);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg bg-[#121212] border border-white/20 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="font-editorial text-xl">{title}</h3>
          <button type="button" onClick={onCancel} className="p-2 opacity-60 hover:opacity-100" aria-label="Cancel crop">
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
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[#FF3B30]"
            />
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="btn-solid flex-1 justify-center py-3 bg-white/10 text-white text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={busy}
              className="btn-solid flex-1 justify-center py-3 bg-[#FF3B30] text-white text-sm"
            >
              <Check className="w-4 h-4" /> {busy ? "Saving…" : "Apply crop"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
