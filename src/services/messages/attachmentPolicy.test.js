import { getMessageAttachmentType, validateMessageAttachments } from "./attachmentPolicy";

const file = (name, type, size) => ({ name, type, size });

describe("message attachment policy", () => {
  it("accepts supported images, videos, and documents", () => {
    expect(getMessageAttachmentType(file("photo.png", "image/png", 1000))).toBe("image");
    expect(getMessageAttachmentType(file("clip.mp4", "video/mp4", 1000))).toBe("video");
    expect(getMessageAttachmentType(file("notes.pdf", "application/pdf", 1000))).toBe("file");
  });

  it("rejects oversized and unsupported attachments", () => {
    expect(() => getMessageAttachmentType(file("photo.png", "image/png", 11 * 1024 * 1024))).toThrow("10MB");
    expect(() => getMessageAttachmentType(file("script.js", "application/javascript", 1000))).toThrow("not supported");
  });

  it("enforces the message attachment count", () => {
    expect(() => validateMessageAttachments([file("a.txt", "text/plain", 1000), file("b.txt", "text/plain", 1000)], 1)).toThrow("up to 1");
  });
});