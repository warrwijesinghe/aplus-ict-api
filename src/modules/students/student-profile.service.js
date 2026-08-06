import { ApiError } from "../../core/errors.js";
import { db } from "../../models/index.js";

export const SRI_LANKAN_DISTRICTS = Object.freeze(["Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle", "Gampaha", "Hambantota", "Jaffna", "Kalutara", "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar", "Matale", "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya", "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya"]);
const mobilePattern = /^(?:\+94|0)?7\d{8}$/;
const fields = ["fullName", "mobileNumber", "whatsAppNumber", "examYear", "schoolName", "district", "preferredMedium", "town", "guardianContactNumber", "referralSource"];
const required = ["fullName", "mobileNumber", "whatsAppNumber", "examYear", "schoolName", "district", "preferredMedium"];
const text = (value, limit) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, limit);
const normalizedPhone = (value) => String(value || "").replace(/[\s-]/g, "");

export const profileComplete = (profile) => Boolean(profile && required.every((field) => profile[field]));
export const profileView = (profile) => {
  if (!profile) return { profileStatus: "incomplete", isComplete: false, completedAt: null };
  const values = profile.toJSON ? profile.toJSON() : profile;
  return { id: values.id, fullName: values.fullName || "", mobileNumber: values.mobileNumber || "", whatsAppNumber: values.whatsAppNumber || "", schoolName: values.schoolName || "", district: values.district || "", gradeOrExamYear: values.examYear || null, examYear: values.examYear || null, preferredMedium: values.preferredMedium || "", guardianContactNumber: values.guardianContactNumber || "", referralSource: values.referralSource || "", town: values.town || "", profileStatus: profileComplete(values) ? "complete" : "incomplete", isComplete: profileComplete(values), completedAt: values.completedAt || null, createdAt: values.createdAt, updatedAt: values.updatedAt };
};

export const profileInput = (body = {}) => {
  const source = { ...body, ...(body.gradeOrExamYear !== undefined ? { examYear: body.gradeOrExamYear } : {}) };
  const values = Object.fromEntries(fields.filter((field) => field in source).map((field) => [field, source[field] === null ? null : source[field]]));
  for (const field of ["fullName", "schoolName", "district", "town", "referralSource"]) if (field in values) values[field] = text(values[field], field === "referralSource" ? 120 : 120) || null;
  for (const field of ["mobileNumber", "whatsAppNumber", "guardianContactNumber"]) {
    if (field in values) values[field] = normalizedPhone(values[field]) || null;
    if (values[field] && !mobilePattern.test(values[field])) throw new ApiError(422, `${field} must be a valid Sri Lankan mobile number`);
  }
  if (values.district && !SRI_LANKAN_DISTRICTS.includes(values.district)) throw new ApiError(422, "district must be a Sri Lankan district");
  if (values.preferredMedium && !["sinhala", "english"].includes(values.preferredMedium)) throw new ApiError(422, "preferredMedium must be sinhala or english");
  if (values.examYear !== undefined && values.examYear !== null && (!Number.isInteger(Number(values.examYear)) || Number(values.examYear) < 2020 || Number(values.examYear) > 2100)) throw new ApiError(422, "gradeOrExamYear must be a valid year");
  if (values.examYear !== undefined && values.examYear !== null) values.examYear = Number(values.examYear);
  return values;
};

export const getStudentProfile = async (userId) => profileView(await db.StudentProfile.findOne({ where: { userId } }));

export const requireCompletedProfile = async (userId) => {
  const profile = await db.StudentProfile.findOne({ where: { userId } });
  if (!profileComplete(profile)) throw new ApiError(403, "Complete your student profile before using this learning workflow", { code: "PROFILE_INCOMPLETE" });
  return profile;
};

export const saveStudentProfile = async (userId, body) => {
  const values = profileInput(body);
  if (values.preferredMedium && !(await db.Medium.findOne({ where: { code: values.preferredMedium, isActive: true } }))) throw new ApiError(422, "preferredMedium must be an active Medium");
  const [profile, created] = await db.StudentProfile.findOrCreate({ where: { userId }, defaults: values });
  if (!created) await profile.update(values);
  const complete = profileComplete(profile);
  await profile.update({ profileStatus: complete ? "complete" : "incomplete", completedAt: complete ? profile.completedAt || new Date() : null });
  return profileView(profile);
};
