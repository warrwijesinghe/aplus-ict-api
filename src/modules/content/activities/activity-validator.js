import { ApiError } from "../../../core/errors.js";
import { sanitizeEducationalHtml } from "./html-sanitizer.js";
import { getActivityType } from "./activity-types.js";

const TITLE_MAX_LENGTH = 255;
const EMBED_PROVIDERS = Object.freeze({});
const ACCESS_POLICIES = new Set(["free", "premium"]);
const CONTENT_STATUSES = new Set(["draft", "published", "archived"]);
const unsafeConfigKeys = new Set(["script", "privateKey", "accessToken", "paymentData", "correctAnswers", "studentSubmissions", "questions", "answers"]);
const has = (item, key) => Object.hasOwn(item, key);
const httpUrl = (value, field) => {
  if (!value) return null;
  let url;
  try { url = new URL(value); } catch { throw new ApiError(422, `Invalid ${field}`); }
  if (!/^https?:$/.test(url.protocol) || !url.hostname) throw new ApiError(422, `Invalid ${field}`);
  return url;
};

export const normalizeYouTubeUrl = (value) => {
  if (!value) return null;
  const url = httpUrl(value, "youtubeUrl");
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let id = host === "youtu.be" ? url.pathname.slice(1).split("/")[0] : host === "youtube.com" ? (url.searchParams.get("v") || (url.pathname.startsWith("/embed/") ? url.pathname.split("/")[2] : null)) : null;
  if (!id || !/^[A-Za-z0-9_-]{6,}$/.test(id)) throw new ApiError(422, "youtubeUrl must use an approved YouTube URL");
  return `https://www.youtube.com/watch?v=${id}`;
};

const validateConfig = (config, type) => {
  if (config === undefined) return undefined;
  if (!config || Array.isArray(config) || typeof config !== "object") throw new ApiError(422, "config must be an object");
  const allowed = new Set(type.allowedConfigKeys || []);
  for (const key of Object.keys(config)) {
    if (unsafeConfigKeys.has(key) || !allowed.has(key)) throw new ApiError(422, `Unsupported config key: ${key}`);
  }
  if (config.displayMode && !["embedded", "viewer", "download", "viewer_and_download"].includes(config.displayMode)) throw new ApiError(422, "Invalid displayMode");
  if (config.provider && config.provider !== "youtube" && !EMBED_PROVIDERS[config.provider]) throw new ApiError(422, "Embed provider is not approved");
  if (config.sourceUrl) httpUrl(config.sourceUrl, "config.sourceUrl");
  if (config.requiredSoftware && (!Array.isArray(config.requiredSoftware) || config.requiredSoftware.some((item) => typeof item !== "string" || !item.trim()))) throw new ApiError(422, "requiredSoftware must be a list of names");
  return config;
};

export const validateActivityDraft = (body, current = {}) => {
  const values = { ...body };
  const typeCode = values.type ?? current.type;
  const type = getActivityType(typeCode);
  const effective = { ...current, ...values };
  if (values.accessPolicy !== undefined && !ACCESS_POLICIES.has(values.accessPolicy)) throw new ApiError(422, "Invalid accessPolicy");
  if (values.status !== undefined && !CONTENT_STATUSES.has(values.status)) throw new ApiError(422, "Invalid status");
  if (has(values, "title") && values.title !== null) {
    if (typeof values.title !== "string") throw new ApiError(422, "title must be text");
    values.title = values.title.trim();
    if (values.title.length > TITLE_MAX_LENGTH) throw new ApiError(422, `title must not exceed ${TITLE_MAX_LENGTH} characters`);
  }
  for (const field of ["titleEn", "titleSi"]) if (has(values, field) && values[field] !== null) values[field] = String(values[field]).trim();
  if (has(values, "content")) values.content = sanitizeEducationalHtml(values.content);
  if (has(values, "instructions") && values.instructions !== null) values.instructions = sanitizeEducationalHtml(values.instructions);
  if (has(values, "youtubeUrl")) values.youtubeUrl = normalizeYouTubeUrl(values.youtubeUrl);
  if (has(values, "externalUrl") && values.externalUrl) httpUrl(values.externalUrl, "externalUrl");
  if (has(values, "completionMode") && !type.supportedCompletionModes.includes(values.completionMode)) throw new ApiError(422, `completionMode is not supported by ${typeCode}`);
  if (has(values, "config")) values.config = validateConfig(values.config, type);
  else if (values.type && values.type !== current.type && current.config) values.config = validateConfig(current.config, type);
  if (has(values, "sortOrder") && (!Number.isInteger(values.sortOrder) || values.sortOrder < 0)) throw new ApiError(422, "sortOrder must be a non-negative integer");
  if (has(values, "configVersion") && (!Number.isInteger(values.configVersion) || values.configVersion < 1)) throw new ApiError(422, "configVersion must be a positive integer");
  if (has(values, "estimatedMinutes") && (!Number.isInteger(values.estimatedMinutes) || values.estimatedMinutes < 0)) throw new ApiError(422, "estimatedMinutes must be a non-negative integer");
  if (has(values, "maxScore") && (Number(values.maxScore) < 0 || Number.isNaN(Number(values.maxScore)))) throw new ApiError(422, "maxScore must be a non-negative number");
  if (has(values, "passingScore") && (Number(values.passingScore) < 0 || Number.isNaN(Number(values.passingScore)))) throw new ApiError(422, "passingScore must be a non-negative number");
  if (Number(effective.maxScore ?? 0) < Number(effective.passingScore ?? 0)) throw new ApiError(422, "passingScore cannot exceed maxScore");
  if (has(values, "maxScore") || has(values, "passingScore")) {
    if (!type.canBeScored && (Number(effective.maxScore || 0) !== 0 || Number(effective.passingScore || 0) !== 0)) throw new ApiError(422, `${typeCode} cannot be scored`);
  }
  if (effective.availableFrom && Number.isNaN(Date.parse(effective.availableFrom))) throw new ApiError(422, "Invalid availableFrom");
  if (effective.availableUntil && Number.isNaN(Date.parse(effective.availableUntil))) throw new ApiError(422, "Invalid availableUntil");
  if (effective.availableFrom && effective.availableUntil && new Date(effective.availableUntil) < new Date(effective.availableFrom)) throw new ApiError(422, "availableUntil cannot be earlier than availableFrom");
  return values;
};

export const validateActivityForPublishing = (activity) => {
  const type = getActivityType(activity.type);
  if (!String(activity.titleEn || activity.title || "").trim()) throw new ApiError(422, "A publishable activity requires a title");
  if (activity.type === "page" || activity.type === "rich_text") {
    if (!String(activity.content || "").replace(/<[^>]+>/g, "").trim()) throw new ApiError(422, `${type.name} requires non-empty content before publishing`);
  }
  if (activity.type === "label" && String(activity.content || "").length > type.contentLimit) throw new ApiError(422, "Label content is too long");
  if (activity.type === "video" && !activity.youtubeUrl) throw new ApiError(422, "Video requires an approved YouTube URL before publishing");
  if (["image", "pdf", "file", "download"].includes(activity.type) && !activity.resourceId) throw new ApiError(422, `${type.name} requires a Resource before publishing`);
  if (activity.type === "image" && !activity.config?.decorative && !String(activity.config?.altText || "").trim()) throw new ApiError(422, "Image requires meaningful alternative text unless decorative");
  if (activity.type === "external_link" && !activity.externalUrl) throw new ApiError(422, "External link requires an externalUrl before publishing");
  if (activity.type === "embed") throw new ApiError(422, "Embed cannot be published until an approved provider is enabled");
  if (activity.type === "assignment") throw new ApiError(422, "Assignment setup is incomplete and cannot be published yet");
  if (activity.type === "quiz") throw new ApiError(422, "A Quiz must be linked before this activity can be published");
  return activity;
};

export const validateActivityResource = (activity, resource) => {
  if (!resource) return;
  const type = getActivityType(activity.type);
  if (type.supportedResourceTypes.length && !type.supportedResourceTypes.includes(resource.category)) throw new ApiError(422, `${type.name} requires a supported ${type.supportedResourceTypes.join(" or ")} Resource`);
  if (["file", "download"].includes(activity.type) && /(?:x-msdownload|x-sh|x-bat|x-msi)/i.test(resource.mimeType || "")) throw new ApiError(422, "Unsafe executable Resources are not allowed");
};
