import { ApiError } from "../../core/errors.js";
import { ACCESS_POLICIES, ACTIVITY_TYPES, COMPLETION_MODES, CONTENT_STATUSES, TRACK_AVAILABILITY } from "./activity-registry.js";

const has = (body, field) => Object.hasOwn(body, field);
const oneOf = (value, allowed, field) => {
  if (value !== undefined && !allowed.includes(value)) throw new ApiError(422, `Invalid ${field}`);
};
const validDate = (value, field) => {
  if (value !== undefined && value !== null && Number.isNaN(Date.parse(value))) throw new ApiError(422, `Invalid ${field}`);
};
const safeUrl = (value, field, youtube = false) => {
  if (!value) return;
  let url;
  try { url = new URL(value); } catch { throw new ApiError(422, `Invalid ${field}`); }
  if (!/^https?:$/.test(url.protocol)) throw new ApiError(422, `Invalid ${field}`);
  if (youtube && !["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(url.hostname))
    throw new ApiError(422, "youtubeUrl must use an approved YouTube URL");
};

export const validateSlug = (value) => {
  if (value !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw new ApiError(422, "Invalid slug");
};

export const validateAvailability = (body) => {
  validDate(body.availableFrom, "availableFrom");
  validDate(body.availableUntil, "availableUntil");
  if (body.availableFrom && body.availableUntil && new Date(body.availableUntil) < new Date(body.availableFrom))
    throw new ApiError(422, "availableUntil cannot be earlier than availableFrom");
};

export const validateContentPayload = (body, kind) => {
  validateSlug(body.slug);
  validateAvailability(body);
  if (has(body, "status")) oneOf(body.status, CONTENT_STATUSES, "status");
  if (kind === "track" && has(body, "availabilityStatus")) oneOf(body.availabilityStatus, TRACK_AVAILABILITY, "availabilityStatus");
  if (kind !== "activity") return;
  if (has(body, "type")) oneOf(body.type, ACTIVITY_TYPES, "activity type");
  if (has(body, "accessPolicy")) oneOf(body.accessPolicy, ACCESS_POLICIES, "accessPolicy");
  if (has(body, "completionMode")) oneOf(body.completionMode, COMPLETION_MODES, "completionMode");
  if (body.estimatedMinutes !== undefined && (!Number.isInteger(body.estimatedMinutes) || body.estimatedMinutes < 0)) throw new ApiError(422, "estimatedMinutes must be a non-negative integer");
  if (body.maxScore !== undefined && (Number(body.maxScore) < 0 || Number.isNaN(Number(body.maxScore)))) throw new ApiError(422, "maxScore must be a non-negative number");
  if (body.passingScore !== undefined && (Number(body.passingScore) < 0 || Number.isNaN(Number(body.passingScore)))) throw new ApiError(422, "passingScore must be a non-negative number");
  if (body.maxScore !== undefined && body.passingScore !== undefined && Number(body.passingScore) > Number(body.maxScore)) throw new ApiError(422, "passingScore cannot exceed maxScore");
  safeUrl(body.youtubeUrl, "youtubeUrl", true);
  safeUrl(body.externalUrl, "externalUrl");
  if (body.config !== undefined && (body.config === null || Array.isArray(body.config) || typeof body.config !== "object")) throw new ApiError(422, "config must be an object");
};

export const pick = (body, fields) => Object.fromEntries(fields.filter((field) => has(body, field)).map((field) => [field, body[field]]));
