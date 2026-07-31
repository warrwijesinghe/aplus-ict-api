import { db } from "../../models/index.js";

// Return a safe user projection for management lists and auth responses.
export const findStudentUsers = () =>
  db.User.findAll({
    where: { role: "student" },
    attributes: ["id", "email", "name", "status", "createdAt", "updatedAt"],
  });
