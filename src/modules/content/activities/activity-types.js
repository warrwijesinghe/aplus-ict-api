import { ApiError } from "../../../core/errors.js";

const definition = (value) => Object.freeze({
  supportedAccessPolicies: ["free", "premium"],
  canBeFree: true,
  canBePremium: true,
  requiredFields: ["title"],
  optionalFields: ["description", "estimatedMinutes", "availability"],
  supportedResourceTypes: [],
  defaultConfig: {},
  canBeScored: false,
  status: "active",
  ...value,
});

// This is the single authority for activity behaviour.  API responses expose a
// deliberately small form-safe projection through activityTypeMetadata().
export const ACTIVITY_TYPE_REGISTRY = Object.freeze({
  label: definition({ name: "Label", description: "A short heading, separator, or instruction.", supportedCompletionModes: ["none"], optionalFields: ["content", "visibility"], publishRequirements: ["title"], contentLimit: 1200 }),
  page: definition({ name: "Page", description: "A standalone long-form learning page.", supportedCompletionModes: ["none", "view", "manual"], requiredFields: ["title", "content"], publishRequirements: ["title", "content"], supportsContent: true }),
  rich_text: definition({ name: "Rich text", description: "Formatted inline educational content.", supportedCompletionModes: ["none", "view", "manual"], requiredFields: ["title", "content"], publishRequirements: ["title", "content"], supportsContent: true }),
  video: definition({ name: "Video", description: "An approved YouTube educational video.", supportedCompletionModes: ["none", "view", "manual"], requiredFields: ["title", "youtubeUrl"], optionalFields: ["description", "estimatedMinutes", "displayMode", "allowExternalOpen"], publishRequirements: ["title", "video source"], supportsExternalUrl: true, allowedConfigKeys: ["provider", "displayMode", "allowExternalOpen"], defaultConfig: { provider: "youtube", displayMode: "embedded", allowExternalOpen: true } }),
  image: definition({ name: "Image", description: "An educational diagram or illustration.", supportedCompletionModes: ["none", "view", "manual"], requiredFields: ["title", "resourceId"], publishRequirements: ["title", "image resource", "alternative text unless decorative"], supportedResourceTypes: ["image"], allowedConfigKeys: ["altText", "caption", "decorative"], defaultConfig: { decorative: false } }),
  pdf: definition({ name: "PDF", description: "A PDF for viewing or controlled download.", supportedCompletionModes: ["none", "view", "manual"], requiredFields: ["title", "resourceId"], publishRequirements: ["title", "PDF resource"], supportedResourceTypes: ["pdf"], allowedConfigKeys: ["displayMode", "allowDownload"], defaultConfig: { displayMode: "viewer", allowDownload: true } }),
  file: definition({ name: "File", description: "A general downloadable learning file.", supportedCompletionModes: ["none", "view", "manual"], requiredFields: ["title", "resourceId"], publishRequirements: ["title", "resource"], supportedResourceTypes: ["document", "pdf", "image"] }),
  download: definition({ name: "Download", description: "An explicit download action for a learning file.", supportedCompletionModes: ["none", "view", "manual"], requiredFields: ["title", "resourceId"], publishRequirements: ["title", "resource"], supportedResourceTypes: ["document", "pdf", "image"] }),
  external_link: definition({ name: "External link", description: "An approved external educational webpage.", supportedCompletionModes: ["none", "view", "manual"], requiredFields: ["title", "externalUrl"], publishRequirements: ["title", "external URL"], supportsExternalUrl: true, allowedConfigKeys: ["openInNewTab"], defaultConfig: { openInNewTab: true } }),
  embed: definition({ name: "Embed", description: "Controlled content from an approved provider.", supportedCompletionModes: ["none", "view", "manual"], requiredFields: ["title"], publishRequirements: ["title", "approved embed provider"], supportsExternalUrl: true, allowedConfigKeys: ["provider", "sourceUrl", "displayMode"], defaultConfig: {}, status: "future_ready" }),
  practical_activity: definition({ name: "Practical activity", description: "Step-by-step hands-on ICT instructions.", supportedCompletionModes: ["none", "view", "manual"], requiredFields: ["title", "instructions"], publishRequirements: ["title", "instructions"], allowedConfigKeys: ["requiredSoftware", "expectedOutput"], defaultConfig: {} }),
  assignment: definition({ name: "Assignment", description: "Future formal student-submission activity.", supportedCompletionModes: ["submit", "pass"], requiredFields: ["title"], optionalFields: ["description", "instructions", "estimatedMinutes"], publishRequirements: ["linked assignment setup"], status: "future_ready" }),
  quiz: definition({ name: "Quiz", description: "Future Question Bank and Quiz engine activity.", supportedCompletionModes: ["submit", "pass"], requiredFields: ["title"], optionalFields: ["description", "instructions", "estimatedMinutes"], publishRequirements: ["linked quiz"], canBeScored: true, status: "future_ready" }),
});

export const ACTIVITY_TYPES = Object.freeze(Object.keys(ACTIVITY_TYPE_REGISTRY));

export const getActivityType = (code) => {
  const item = ACTIVITY_TYPE_REGISTRY[code];
  if (!item) throw new ApiError(422, "Invalid activity type");
  return item;
};

export const activityTypeMetadata = () => ACTIVITY_TYPES.map((code) => {
  const item = ACTIVITY_TYPE_REGISTRY[code];
  return {
    code, name: item.name, description: item.description,
    supportedCompletionModes: item.supportedCompletionModes,
    supportedAccessPolicies: item.supportedAccessPolicies,
    requiredFields: item.requiredFields,
    optionalFields: item.optionalFields,
    supportedResourceTypes: item.supportedResourceTypes,
    defaultConfig: item.defaultConfig,
    publishRequirements: item.publishRequirements,
    canBeScored: item.canBeScored,
    status: item.status,
  };
});
