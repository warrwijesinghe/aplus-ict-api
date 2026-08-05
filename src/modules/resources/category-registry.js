const MB = 1024 * 1024;
export const MIME = Object.freeze({
  JPEG: "image/jpeg", PNG: "image/png", WEBP: "image/webp", GIF: "image/gif", PDF: "application/pdf", TEXT: "text/plain", CSV: "text/csv",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});
const images = [MIME.JPEG, MIME.PNG, MIME.WEBP, MIME.GIF];
const documents = [MIME.PDF, MIME.TEXT, MIME.CSV, MIME.DOCX, MIME.PPTX, MIME.XLSX];
const define = (code, values) => [code, Object.freeze({ code, active: true, replacementAllowed: true, studentUploadAllowed: false, ...values })];

export const RESOURCE_CATEGORIES = Object.freeze(Object.fromEntries([
  define("course_thumbnail", { allowedMimeTypes: images, maxSizeBytes: 5 * MB, defaultVisibility: "public", defaultAccessPolicy: "public", publicAllowed: true, storageArea: "course-images" }),
  define("course_banner", { allowedMimeTypes: images, maxSizeBytes: 8 * MB, defaultVisibility: "public", defaultAccessPolicy: "public", publicAllowed: true, storageArea: "course-images" }),
  define("lesson_image", { allowedMimeTypes: images, maxSizeBytes: 8 * MB, defaultVisibility: "private", defaultAccessPolicy: "course_enrolled", publicAllowed: true, storageArea: "lesson-images" }),
  define("lesson_pdf", { allowedMimeTypes: [MIME.PDF], maxSizeBytes: 25 * MB, defaultVisibility: "private", defaultAccessPolicy: "course_enrolled", publicAllowed: false, storageArea: "lesson-files" }),
  define("tute_pdf", { allowedMimeTypes: [MIME.PDF], maxSizeBytes: 25 * MB, defaultVisibility: "private", defaultAccessPolicy: "course_enrolled", publicAllowed: false, storageArea: "lesson-files" }),
  define("worksheet", { allowedMimeTypes: documents, maxSizeBytes: 25 * MB, defaultVisibility: "private", defaultAccessPolicy: "course_enrolled", publicAllowed: false, storageArea: "lesson-files" }),
  define("model_answer", { allowedMimeTypes: documents, maxSizeBytes: 25 * MB, defaultVisibility: "private", defaultAccessPolicy: "premium", publicAllowed: false, storageArea: "lesson-files" }),
  define("practical_file", { allowedMimeTypes: documents, maxSizeBytes: 25 * MB, defaultVisibility: "private", defaultAccessPolicy: "course_enrolled", publicAllowed: false, storageArea: "practical-files" }),
  define("general_document", { allowedMimeTypes: documents, maxSizeBytes: 25 * MB, defaultVisibility: "private", defaultAccessPolicy: "authenticated", publicAllowed: true, storageArea: "documents" }),
  define("video_thumbnail", { allowedMimeTypes: images, maxSizeBytes: 5 * MB, defaultVisibility: "public", defaultAccessPolicy: "public", publicAllowed: true, storageArea: "video-images" }),
  define("assignment_attachment", { allowedMimeTypes: documents, maxSizeBytes: 25 * MB, defaultVisibility: "private", defaultAccessPolicy: "course_enrolled", publicAllowed: false, storageArea: "assignment-files" }),
  define("assignment_submission", { allowedMimeTypes: documents, maxSizeBytes: 25 * MB, defaultVisibility: "private", defaultAccessPolicy: "owner_only", publicAllowed: false, studentUploadAllowed: true, storageArea: "assignment-submissions" }),
  define("payment_slip", { allowedMimeTypes: [...images, MIME.PDF], maxSizeBytes: 10 * MB, defaultVisibility: "private", defaultAccessPolicy: "owner_only", publicAllowed: false, studentUploadAllowed: true, replacementAllowed: false, storageArea: "payment-slips" }),
  define("profile_image", { allowedMimeTypes: images, maxSizeBytes: 3 * MB, defaultVisibility: "private", defaultAccessPolicy: "owner_only", publicAllowed: false, studentUploadAllowed: true, storageArea: "profile-images" }),
  define("site_asset", { allowedMimeTypes: images, maxSizeBytes: 5 * MB, defaultVisibility: "public", defaultAccessPolicy: "public", publicAllowed: true, storageArea: "site-assets" }),
].map(([code, rule]) => [code, rule])));

export const getResourceCategory = (code) => RESOURCE_CATEGORIES[code] || null;
export const publicCategoryResponse = () => Object.values(RESOURCE_CATEGORIES).map((category) => {
  const item = { ...category }; delete item.storageArea; return item;
});
