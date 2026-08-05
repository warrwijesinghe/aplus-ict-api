export const ACTIVITY_TYPES = Object.freeze([
  "label", "page", "rich_text", "video", "image", "pdf", "file", "download",
  "external_link", "embed", "practical_activity", "assignment", "quiz",
]);

export const ACCESS_POLICIES = Object.freeze(["free", "premium"]);
export const COMPLETION_MODES = Object.freeze(["none", "view", "manual", "submit", "pass"]);
export const CONTENT_STATUSES = Object.freeze(["draft", "published", "archived"]);
export const TRACK_AVAILABILITY = Object.freeze(["active", "coming_soon", "paused", "archived"]);

// Temporary compatibility for records created before Task 03. Never emit this
// value from new APIs, but treat it as premium while migrations are deployed.
export const isPremium = (accessPolicy) => accessPolicy === "premium" || accessPolicy === "paid";
