import { ApiError } from "../../core/errors.js";
import { db } from "../../models/index.js";

const mobilePattern = /^(?:\+94|0)?7\d{8}$/;
const fields = [
  "fullName", "mobileNumber", "whatsAppNumber", "examYear", "schoolName",
  "district", "preferredMedium", "town", "guardianContactNumber", "referralSource",
];

const normalizedPhone = (value) => String(value || "").replace(/[\s-]/g, "");

export const profileInput = (body = {}) => {
  const values = Object.fromEntries(fields.filter((field) => field in body).map((field) => [field, body[field] || null]));
  for (const field of ["mobileNumber", "whatsAppNumber", "guardianContactNumber"]) {
    if (values[field] && !mobilePattern.test(normalizedPhone(values[field])))
      throw new ApiError(422, `${field} must be a valid Sri Lankan mobile number`);
    if (values[field]) values[field] = normalizedPhone(values[field]);
  }
  if (values.preferredMedium && !["sinhala", "english"].includes(values.preferredMedium))
    throw new ApiError(422, "preferredMedium must be sinhala or english");
  if (values.examYear && (!Number.isInteger(Number(values.examYear)) || Number(values.examYear) < 2020 || Number(values.examYear) > 2100))
    throw new ApiError(422, "examYear must be a valid year");
  if (values.examYear) values.examYear = Number(values.examYear);
  return values;
};

export const getStudentProfile = (userId) => db.StudentProfile.findOne({ where: { userId } });

export const saveStudentProfile = async (userId, body) => {
  const values = profileInput(body);
  const [profile, created] = await db.StudentProfile.findOrCreate({ where: { userId }, defaults: values });
  if (!created) await profile.update(values);
  return profile;
};
