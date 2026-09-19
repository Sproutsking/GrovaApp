export const MESSAGE_ATTACHMENT_LIMITS = {
  image: { maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/gif", "image/webp"] },
  video: { maxBytes: 100 * 1024 * 1024, types: ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v", "video/mpeg"] },
  file: { maxBytes: 25 * 1024 * 1024, types: [
    "application/pdf", "text/plain", "application/zip", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ] },
};

const extensionType = (name = "") => {
  const ext = name.toLowerCase().split(".").pop();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "m4v", "mpeg", "mpg"].includes(ext)) return "video";
  return "file";
};

export function getMessageAttachmentType(file) {
  if (!file) throw new Error("No attachment selected");
  const type = file.type?.startsWith("image/") ? "image"
    : file.type?.startsWith("video/") ? "video"
      : extensionType(file.name);
  const limits = MESSAGE_ATTACHMENT_LIMITS[type];
  if (!limits) throw new Error("Unsupported attachment type");
  if (file.size > limits.maxBytes) {
    throw new Error(`${type === "image" ? "Images" : type === "video" ? "Videos" : "Files"} must be smaller than ${Math.round(limits.maxBytes / 1024 / 1024)}MB`);
  }
  if (file.size < 100) throw new Error("This file is too small or corrupted");
  if (file.type && !limits.types.includes(file.type)) {
    throw new Error("This file type is not supported");
  }
  return type;
}

export function validateMessageAttachments(files = [], maxCount = 10) {
  if (!Array.isArray(files) || files.length === 0) return [];
  if (files.length > maxCount) throw new Error(`You can attach up to ${maxCount} files`);
  return files.map((file) => ({ file, type: getMessageAttachmentType(file) }));
}