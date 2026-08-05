import crypto from "crypto";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import sharp from "sharp";
import { Op } from "sequelize";
import { db } from "../../models/index.js";
import { ApiError } from "../../core/errors.js";
import { getResourceCategory } from "./category-registry.js";
import { validateUpload } from "./upload-validation.js";
import { uploadStorage } from "./storage.js";

const datePart = () => { const now = new Date(); return `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`; };
const safeName = (name, extension) => `${String(name || "resource").replace(/[\\/:*?"<>|\r\n]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "resource"}${extension}`;
export const resourceResponse = (resource, { includeLinks = false } = {}) => {
  const value = resource.toJSON ? resource.toJSON() : resource;
  const replacement = value.Replacement ? { id: value.Replacement.id, displayName: value.Replacement.displayName, status: value.Replacement.status } : null;
  const safe = { ...value }; delete safe.storageKey; delete safe.storedName; delete safe.Links; delete safe.Replacement;
  return { ...safe, ...(includeLinks ? { links: (value.Links || []).map((link) => link.toJSON ? link.toJSON() : link), replacement } : {}) };
};

export const createResource = async ({ file, body, user }) => {
  const category = getResourceCategory(body.category);
  if (!category || !category.active) throw new ApiError(422, "Unknown or inactive resource category");
  const validation = validateUpload(file, category);
  const requestedVisibility = body.visibility || category.defaultVisibility;
  const requestedPolicy = body.accessPolicy || category.defaultAccessPolicy;
  if (!["public", "private"].includes(requestedVisibility) || !["public", "authenticated", "course_enrolled", "premium", "admin_only", "owner_only"].includes(requestedPolicy)) throw new ApiError(422, "Invalid visibility or access policy");
  if ((requestedVisibility === "public" || requestedPolicy === "public") && (!category.publicAllowed || user.role === "teacher" || user.role === "content_editor")) throw new ApiError(403, "This resource cannot be made public");
  if ((requestedVisibility === "public") !== (requestedPolicy === "public")) throw new ApiError(422, "Public resources must use the public access policy");
  const id = crypto.randomUUID(); const storedName = `${id}${validation.extension}`;
  const area = category.storageArea; const visibility = requestedVisibility;
  const storageKey = path.posix.join(area, datePart(), storedName);
  const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");
  let dimensions = {};
  if (validation.mimeType.startsWith("image/")) {
    try { const metadata = await sharp(file.buffer, { animated: false }).metadata(); dimensions = { imageWidth: metadata.width || null, imageHeight: metadata.height || null }; } catch { throw new ApiError(422, "Image file is corrupted"); }
  }
  const duplicate = await db.Resource.findOne({ where: { checksum, category: body.category, status: { [Op.in]: ["active", "ready"] } } });
  await uploadStorage.save(visibility, storageKey, file.buffer);
  try {
    const resource = await db.Resource.create({ id, ownerUserId: user.sub, uploadedByUserId: user.sub, category: body.category, originalFilename: file.originalname, storedName, displayName: String(body.displayName || file.originalname).trim().slice(0, 180), description: String(body.description || "").trim().slice(0, 5000) || null, mimeType: validation.mimeType, extension: validation.extension, sizeBytes: file.size, checksum, storageProvider: "local", storageKey, visibility, accessPolicy: requestedPolicy, status: "active", ...dimensions });
    return { resource, duplicateId: duplicate?.id || null };
  } catch (error) { await uploadStorage.delete(visibility, storageKey).catch(() => undefined); throw error; }
};

export const archiveResource = async (resource) => resource.update({ status: "archived", archivedAt: new Date() });
export const createResourceReplacement = async ({ resource, file, user }) => {
  const category = getResourceCategory(resource.category);
  if (!category?.replacementAllowed) throw new ApiError(422, "This category cannot be replaced");
  const { resource: replacement } = await createResource({ file, body: { category: resource.category, displayName: resource.displayName, description: resource.description, visibility: resource.visibility, accessPolicy: resource.accessPolicy }, user });
  const transaction = await db.sequelize.transaction();
  try {
    const links = await db.ResourceLink.findAll({ where: { resourceId: resource.id }, transaction });
    await db.ResourceLink.bulkCreate(links.map((link) => ({ resourceId: replacement.id, entityType: link.entityType, entityId: link.entityId, purpose: link.purpose, sortOrder: link.sortOrder, createdByUserId: user.sub })), { transaction, ignoreDuplicates: true });
    await resource.update({ replacedByResourceId: replacement.id, status: "archived", archivedAt: new Date() }, { transaction });
    await transaction.commit(); return replacement;
  } catch (error) { await transaction.rollback(); throw error; }
};

export const streamResource = async (req, res, resource, { download = false } = {}) => {
  const visibility = resource.visibility; const location = uploadStorage.resolve(visibility, resource.storageKey);
  const stat = await fs.stat(location).catch(() => null); if (!stat?.isFile()) throw new ApiError(404, "Resource file not found");
  const inline = !download && ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif", "text/plain"].includes(resource.mimeType);
  const filename = safeName(resource.displayName || resource.originalFilename, resource.extension || path.extname(resource.originalFilename || ""));
  res.set({ "Content-Type": resource.mimeType || "application/octet-stream", "Content-Length": String(stat.size), "X-Content-Type-Options": "nosniff", "Cache-Control": visibility === "public" ? "public, max-age=3600" : "private, no-store", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"` });
  const range = req.headers.range;
  if (!range || !["application/pdf"].includes(resource.mimeType)) return createReadStream(location).pipe(res);
  const match = /^bytes=(\d*)-(\d*)$/.exec(range); if (!match) { res.set("Content-Range", `bytes */${stat.size}`); return res.sendStatus(416); }
  const start = Number(match[1] || 0); const end = Math.min(Number(match[2] || stat.size - 1), stat.size - 1); if (start > end || start >= stat.size) { res.set("Content-Range", `bytes */${stat.size}`); return res.sendStatus(416); }
  res.status(206).set({ "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(end - start + 1) }); return createReadStream(location, { start, end }).pipe(res);
};
