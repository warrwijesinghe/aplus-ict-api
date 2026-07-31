import { ApiError } from "../../core/errors.js";

const signatures = {
  "image/jpeg": (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")),
  "image/webp": (b) =>
    b.subarray(0, 4).equals(Buffer.from("RIFF")) &&
    b.subarray(8, 12).equals(Buffer.from("WEBP")),
  "application/pdf": (b) => b.subarray(0, 5).equals(Buffer.from("%PDF-")),
};

export const extensionsByMime = Object.freeze({
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
});

const imageMimes = new Set(["image/jpeg", "image/png", "image/webp"]);
const documentMimes = new Set(Object.keys(extensionsByMime).filter((mime) => !mime.startsWith("image/")));

export const validateUpload = (file, { kind, maxBytes, allowOffice = false }) => {
  if (!file) throw new ApiError(422, "File is required");
  const allowed = kind === "image" ? imageMimes : allowOffice ? documentMimes : new Set(["application/pdf"]);
  if (!allowed.has(file.mimetype) || !extensionsByMime[file.mimetype])
    throw new ApiError(422, "Unsupported file type");
  if (file.size > maxBytes) throw new ApiError(422, "Uploaded file is too large");
  const verifier = signatures[file.mimetype];
  if (verifier && !verifier(file.buffer)) throw new ApiError(422, "File contents do not match its type");
  return { mimeType: file.mimetype, extension: extensionsByMime[file.mimetype] };
};

export const validatePaymentSlip = (file, maxBytes) =>
  validateUpload(file, {
    kind: file?.mimetype?.startsWith("image/") ? "image" : "document",
    maxBytes,
  });
