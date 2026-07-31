import { db } from "../../models/index.js";

// Central place for student-facing records; avoids copying student data into learning tables.
export const findStudentProfile = (userId) =>
  db.StudentProfile.findOne({ where: { userId }, include: [db.User] });
