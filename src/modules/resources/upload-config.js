import fs from "fs/promises";
import { constants } from "fs";
import path from "path";
import { env } from "../../config/env.js";
import { ApiError } from "../../core/errors.js";

export const UPLOAD_CATEGORIES = Object.freeze({
  COURSE: "courses",
  LESSON: "lessons",
  CHAPTER: "chapters",
  GENERAL: "general",
  PAID_RESOURCE: "paid-resources",
  PAYMENT_SLIP: "payment-slips",
  STUDENT_DOCUMENT: "student-documents",
});

const publicCategories = new Set([
  UPLOAD_CATEGORIES.COURSE,
  UPLOAD_CATEGORIES.LESSON,
  UPLOAD_CATEGORIES.CHAPTER,
  UPLOAD_CATEGORIES.GENERAL,
]);
const privateCategories = new Set([
  UPLOAD_CATEGORIES.PAID_RESOURCE,
  UPLOAD_CATEGORIES.PAYMENT_SLIP,
  UPLOAD_CATEGORIES.STUDENT_DOCUMENT,
]);

export const uploadRoots = Object.freeze({
  public: path.resolve(env.publicUploadDir),
  private: path.resolve(env.privateUploadDir),
});

export const assertUploadCategory = (visibility, category) => {
  const allowed = visibility === "public" ? publicCategories : privateCategories;
  if (!allowed?.has(category)) throw new ApiError(422, "Invalid upload category");
  return category;
};

export const initializeUploadDirectories = async () => {
  for (const root of Object.values(uploadRoots)) {
    try {
      await fs.mkdir(root, { recursive: true });
      await fs.access(root, constants.W_OK);
    } catch (error) {
      throw new Error(`Upload directory is unavailable: ${root}`, { cause: error });
    }
  }
};
