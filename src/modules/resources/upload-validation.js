import path from "path";
import { ApiError } from "../../core/errors.js";
import { MIME } from "./category-registry.js";

export const extensionsByMime = Object.freeze({
  [MIME.JPEG]: ".jpg", [MIME.PNG]: ".png", [MIME.WEBP]: ".webp", [MIME.GIF]: ".gif", [MIME.PDF]: ".pdf", [MIME.TEXT]: ".txt", [MIME.CSV]: ".csv", [MIME.DOCX]: ".docx", [MIME.PPTX]: ".pptx", [MIME.XLSX]: ".xlsx",
});
const dangerous = /\.(?:exe|msi|bat|cmd|ps1|sh|dll|scr|com|jar|apk)$/i;
const device = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const signatures = {
  [MIME.JPEG]: (b) => b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  [MIME.PNG]: (b) => b.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")),
  [MIME.WEBP]: (b) => b.subarray(0, 4).equals(Buffer.from("RIFF")) && b.subarray(8, 12).equals(Buffer.from("WEBP")),
  [MIME.GIF]: (b) => ["GIF87a", "GIF89a"].some((signature) => b.subarray(0, 6).equals(Buffer.from(signature))),
  [MIME.PDF]: (b) => b.subarray(0, 5).equals(Buffer.from("%PDF-")),
};
const zipSignature = (b) => b.subarray(0, 4).equals(Buffer.from("504b0304", "hex"));

export const sanitizeOriginalFilename = (value) => {
  const name = String(value || "").trim();
  if (!name || name.length > 180 || /[\0\r\n]|[\\/]|\.\./.test(name) || device.test(name) || dangerous.test(name)) throw new ApiError(422, "Unsafe filename");
  const extension = path.extname(name).toLowerCase();
  if (!extension || name.slice(0, -extension.length).includes(".")) throw new ApiError(422, "Unsafe filename");
  return name;
};

export const validateUpload = (file, { allowedMimeTypes, maxBytes, kind, allowOffice = false } = {}) => {
  if (!file || !Buffer.isBuffer(file.buffer)) throw new ApiError(422, "File is required");
  if (!file.size || !file.buffer.length) throw new ApiError(422, "Empty files are not allowed");
  const allowed = allowedMimeTypes || (kind === "image" ? [MIME.JPEG, MIME.PNG, MIME.WEBP, MIME.GIF] : allowOffice ? [MIME.PDF, MIME.DOCX, MIME.PPTX, MIME.XLSX] : [MIME.PDF]);
  if (!allowed.includes(file.mimetype) || !extensionsByMime[file.mimetype]) throw new ApiError(422, "Unsupported file type");
  if (file.size > maxBytes) throw new ApiError(422, "Uploaded file is too large");
  if (file.originalname) sanitizeOriginalFilename(file.originalname);
  const expectedExtension = extensionsByMime[file.mimetype];
  if (file.originalname && path.extname(file.originalname).toLowerCase() !== expectedExtension && !(file.mimetype === MIME.JPEG && path.extname(file.originalname).toLowerCase() === ".jpeg")) throw new ApiError(422, "Filename extension does not match file type");
  const verifier = signatures[file.mimetype];
  if (verifier && !verifier(file.buffer)) throw new ApiError(422, "File contents do not match its type");
  if ([MIME.DOCX, MIME.PPTX, MIME.XLSX].includes(file.mimetype) && !zipSignature(file.buffer)) throw new ApiError(422, "File contents do not match its type");
  return { mimeType: file.mimetype, extension: expectedExtension };
};

export const validatePaymentSlip = (file, maxBytes) => validateUpload(file, { allowedMimeTypes: [MIME.JPEG, MIME.PNG, MIME.WEBP, MIME.GIF, MIME.PDF], maxBytes });
