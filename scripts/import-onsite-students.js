import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../src/models/index.js";

const usage = "Usage: node scripts/import-onsite-students.js <csv-path> [--apply]";

const parseCsv = (source) => {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.length)) rows.push(row);
      row = [];
      value = "";
    } else value += character;
  }
  row.push(value);
  if (row.some((cell) => cell.length)) rows.push(row);
  return rows;
};

const normalizeText = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
const normalizeEmail = (value) => normalizeText(value).toLowerCase();
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const readStudents = async (csvPath) => {
  const table = parseCsv(await fs.readFile(csvPath, "utf8"));
  const [headers = [], ...rows] = table;
  const columns = headers.map((header) => normalizeText(header).toLowerCase());
  const requiredColumns = ["firstname", "lastname", "email"];
  const missingColumns = requiredColumns.filter((column) => !columns.includes(column));
  if (missingColumns.length) throw new Error(`CSV is missing required column(s): ${missingColumns.join(", ")}`);

  return rows.map((row, index) => {
    const record = Object.fromEntries(columns.map((column, columnIndex) => [column, normalizeText(row[columnIndex])]));
    const email = normalizeEmail(record.email);
    const name = normalizeText([record.firstname, record.lastname].filter(Boolean).join(" "));
    return { rowNumber: index + 2, email, name };
  });
};

const summarize = (items) => Object.fromEntries(items.map(({ key, value }) => [key, value]));

const importStudents = async (students, apply) => {
  const invalid = students.filter((student) => !student.name || !validEmail(student.email));
  const seenEmails = new Set();
  const duplicateInFile = students.filter((student) => {
    if (!student.email || seenEmails.has(student.email)) return true;
    seenEmails.add(student.email);
    return false;
  });
  const candidates = students.filter((student) => validEmail(student.email) && student.name && !duplicateInFile.includes(student));
  const users = await db.User.findAll({ attributes: ["id", "email"], raw: true });
  const registeredEmails = new Set(users.map((user) => normalizeEmail(user.email)));
  const alreadyRegistered = candidates.filter((student) => registeredEmails.has(student.email));
  const newStudents = candidates.filter((student) => !registeredEmails.has(student.email));

  if (apply && newStudents.length) {
    await db.sequelize.transaction(async (transaction) => {
      const studentRole = await db.Role.findOne({ where: { code: "student", isActive: true }, transaction });
      for (const student of newStudents) {
        const user = await db.User.create({ email: student.email, name: student.name, role: "student", status: "active" }, { transaction });
        await db.StudentProfile.create({ userId: user.id, fullName: student.name, preferredMedium: "sinhala", profileStatus: "incomplete" }, { transaction });
        if (studentRole) await db.UserRole.create({ userId: user.id, roleId: studentRole.id }, { transaction });
      }
    });
  }

  return summarize([
    { key: "sourceRows", value: students.length },
    { key: "invalidRowsSkipped", value: invalid.length },
    { key: "duplicateRowsInCsvSkipped", value: duplicateInFile.length },
    { key: "alreadyRegistered", value: alreadyRegistered.length },
    { key: apply ? "imported" : "readyToImport", value: newStudents.length },
  ]);
};

const [csvArgument, flag] = process.argv.slice(2);
if (!csvArgument || (flag && flag !== "--apply")) {
  console.error(usage);
  process.exitCode = 1;
} else {
  const csvPath = path.resolve(csvArgument);
  try {
    await db.sequelize.authenticate();
    const result = await importStudents(await readStudents(csvPath), flag === "--apply");
    console.log(JSON.stringify({ mode: flag === "--apply" ? "applied" : "preview", ...result }, null, 2));
  } finally {
    await db.sequelize.close();
  }
}
