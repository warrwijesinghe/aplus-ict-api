import { Op } from "sequelize";
import { db } from "../../models/index.js";
import { ApiError } from "../../core/errors.js";

const allowedLevels = new Set(["al", "ol"]);
const allowedMedia = new Set(["sinhala", "english", "tamil", "all"]);
const allowedAccessPolicies = new Set(["free", "paid"]);
const allowedStatuses = new Set(["draft", "published", "archived"]);

const text = (value) => (typeof value === "string" ? value.trim() : "");

const normaliseTag = (value) =>
  text(value)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");

const uniqueSorted = (items) =>
  [...new Set(items.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );

const publicItem = (item) => ({
  id: item.id,
  title: item.title,
  description: item.description,
  resourceType: item.resourceType,
  academicLevel: item.academicLevel,
  medium: item.medium,
  accessPolicy: item.accessPolicy,
  filename: item.Resource?.originalFilename,
  sizeBytes: item.Resource?.sizeBytes,
  createdAt: item.createdAt,
});

const readyFile = {
  model: db.Resource,
  required: true,
  where: { status: "ready" },
};

export const findPublishedDownloads = async (query) => {
  const where = { status: "published" };
  const academicLevel = normaliseTag(query.academicLevel);
  const medium = normaliseTag(query.medium);
  const resourceType = normaliseTag(query.resourceType);
  const accessPolicy = normaliseTag(query.accessPolicy);
  const search = text(query.search);

  if (allowedLevels.has(academicLevel)) where.academicLevel = academicLevel;
  if (allowedMedia.has(medium)) where.medium = medium;
  if (resourceType) where.resourceType = resourceType;
  if (allowedAccessPolicies.has(accessPolicy))
    where.accessPolicy = accessPolicy;
  if (search) {
    where[Op.or] = [
      { title: { [Op.like]: "%" + search + "%" } },
      { description: { [Op.like]: "%" + search + "%" } },
    ];
  }

  const [items, allItems] = await Promise.all([
    db.DownloadableResource.findAll({
      where,
      include: [readyFile],
      order: [
        ["sortOrder", "ASC"],
        ["createdAt", "DESC"],
      ],
    }),
    db.DownloadableResource.findAll({
      where: { status: "published" },
      include: [readyFile],
    }),
  ]);

  return {
    items: items.map(publicItem),
    filters: {
      academicLevels: uniqueSorted(allItems.map((item) => item.academicLevel)),
      media: uniqueSorted(allItems.map((item) => item.medium)),
      resourceTypes: uniqueSorted(allItems.map((item) => item.resourceType)),
      accessPolicies: uniqueSorted(allItems.map((item) => item.accessPolicy)),
    },
  };
};

export const findPublishedDownload = (id) =>
  db.DownloadableResource.findOne({
    where: { id, status: "published" },
    include: [readyFile],
  });

// Only known access and publishing values are accepted. Resource type itself
// deliberately remains flexible so future study materials need no schema change.
export const downloadableResourceInput = (body, { creating = false } = {}) => {
  const values = {};
  const title = text(body.title);
  const description = text(body.description);
  const resourceType = normaliseTag(body.resourceType);
  const academicLevel = normaliseTag(body.academicLevel);
  const medium = normaliseTag(body.medium);
  const accessPolicy = normaliseTag(body.accessPolicy);
  const status = normaliseTag(body.status);

  if (creating || "title" in body) {
    if (!title) throw new ApiError(422, "A resource title is required");
    values.title = title;
  }
  if ("description" in body) values.description = description || null;
  if (creating || "resourceType" in body) {
    if (!resourceType) throw new ApiError(422, "A resource type is required");
    values.resourceType = resourceType;
  }
  if (creating || "academicLevel" in body) {
    if (!allowedLevels.has(academicLevel))
      throw new ApiError(422, "Academic level must be A/L or O/L");
    values.academicLevel = academicLevel;
  }
  if (creating || "medium" in body) {
    if (!allowedMedia.has(medium))
      throw new ApiError(422, "Medium must be Sinhala, English, Tamil, or All");
    values.medium = medium;
  }
  if (creating || "accessPolicy" in body) {
    if (!allowedAccessPolicies.has(accessPolicy))
      throw new ApiError(422, "Access policy must be free or paid");
    values.accessPolicy = accessPolicy;
  }
  if (creating || "status" in body) {
    if (!allowedStatuses.has(status))
      throw new ApiError(422, "Status must be draft, published, or archived");
    values.status = status;
  }
  if (creating || "sortOrder" in body) {
    const sortOrder = Number(body.sortOrder || 0);
    if (!Number.isInteger(sortOrder) || sortOrder < 0)
      throw new ApiError(422, "Sort order must be a whole number");
    values.sortOrder = sortOrder;
  }

  return values;
};
