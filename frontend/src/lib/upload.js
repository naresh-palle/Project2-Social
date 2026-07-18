import { api, API } from "./api";
import { toast } from "sonner";

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
    // Server returns a relative /api/uploads/... path — resolve against backend base URL.
    const base = API.replace(/\/api$/, "");
    return `${base}${data.url}`;
  } catch (e) {
    toast.error(e.response?.data?.detail || "Upload failed");
    return null;
  }
}
