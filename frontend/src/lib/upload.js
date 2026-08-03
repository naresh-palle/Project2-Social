import { api, API } from "./api";
import { toast } from "sonner";

function resolveUrl(relativeOrAbsolute) {
  if (!relativeOrAbsolute) return null;
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute;
  const base = API.replace(/\/api$/, "");
  return `${base}${relativeOrAbsolute.startsWith("/") ? relativeOrAbsolute : `/${relativeOrAbsolute}`}`;
}

/**
 * Upload an image file to /api/uploads. Returns a full absolute URL usable in <img src>.
 * Server accepts jpeg/png/webp/gif up to 8MB.
 */
export async function uploadImage(file) {
  if (!file) return null;
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
    toast.error("Only JPEG / PNG / WebP / GIF up to 8MB.");
    return null;
  }
  if (file.size > 8 * 1024 * 1024) {
    toast.error("Image too large (max 8MB).");
    return null;
  }
  const fd = new FormData();
  fd.append("file", file);
  try {
    const { data } = await api.post("/uploads", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return resolveUrl(data.url);
  } catch (e) {
    toast.error(e.response?.data?.detail || "Upload failed");
    return null;
  }
}

const MEDIA_TYPES = /^(image|video|audio)\//;

/**
 * Upload image/video/audio to /api/media/upload (fallback /api/uploads).
 * Returns { url, media_type } with absolute URL. Max 50MB.
 */
export async function uploadMedia(file) {
  if (!file) return null;
  if (!MEDIA_TYPES.test(file.type)) {
    toast.error("Only image, video, or audio files up to 50MB.");
    return null;
  }
  if (file.size > 50 * 1024 * 1024) {
    toast.error("File too large (max 50MB).");
    return null;
  }
  const fd = new FormData();
  fd.append("file", file);
  try {
    let data;
    try {
      ({ data } = await api.post("/media/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      }));
    } catch {
      ({ data } = await api.post("/uploads", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      }));
    }
    const media_type =
      data.media_type ||
      (file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "image");
    return { url: resolveUrl(data.url), media_type };
  } catch (e) {
    toast.error(e.response?.data?.detail || "Upload failed");
    return null;
  }
}
