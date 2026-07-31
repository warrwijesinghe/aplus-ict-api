import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { db } from "../src/models/index.js";
import { uploadStorage } from "../src/modules/resources/storage.js";
import { UPLOAD_CATEGORIES } from "../src/modules/resources/upload-config.js";

// Run this script once after migration to import the six supplied A/L ICT files.
// Pass a different folder as the first argument if the source files move later.
const sourceFolder =
  process.argv[2] ||
  "H:\\MCS School\\Courses\\Advanced Level\\Teachers Guide\\New Sylabi";

const initialDownloads = [
  {
    filename: "AL ICT English Syllabus.pdf",
    title: "A/L ICT Syllabus - English Medium",
    description:
      "Information and Communication Technology syllabus for Grades 12 and 13.",
    resourceType: "syllabus",
    academicLevel: "al",
    medium: "english",
    sortOrder: 10,
  },
  {
    filename: "AL ICT Sinhala Syllabus.pdf",
    title: "A/L ICT Syllabus - Sinhala Medium",
    description:
      "Information and Communication Technology syllabus for Grades 12 and 13.",
    resourceType: "syllabus",
    academicLevel: "al",
    medium: "sinhala",
    sortOrder: 20,
  },
  {
    filename: "English Teachers Guide 1.pdf",
    title: "A/L ICT Teachers' Guide - Grade 12 - English Medium",
    description:
      "Teachers' guide for Grade 12 Information and Communication Technology.",
    resourceType: "teachers_guide",
    academicLevel: "al",
    medium: "english",
    sortOrder: 30,
  },
  {
    filename: "English Teachers Guide 2.pdf",
    title: "A/L ICT Teachers' Guide - Grade 13 - English Medium",
    description:
      "Teachers' guide for Grade 13 Information and Communication Technology.",
    resourceType: "teachers_guide",
    academicLevel: "al",
    medium: "english",
    sortOrder: 40,
  },
  {
    filename: "Sinhala Teachers Guide 1.pdf",
    title: "A/L ICT Teachers' Guide - Grade 12 - Sinhala Medium",
    description:
      "Teachers' guide for Grade 12 Information and Communication Technology.",
    resourceType: "teachers_guide",
    academicLevel: "al",
    medium: "sinhala",
    sortOrder: 50,
  },
  {
    filename: "Sinhala Teachers Guide 2.pdf",
    title: "A/L ICT Teachers' Guide - Grade 13 - Sinhala Medium",
    description:
      "Teachers' guide for Grade 13 Information and Communication Technology.",
    resourceType: "teachers_guide",
    academicLevel: "al",
    medium: "sinhala",
    sortOrder: 60,
  },
];

const importDownload = async (entry) => {
  const existing = await db.DownloadableResource.findOne({
    where: {
      title: entry.title,
      academicLevel: entry.academicLevel,
      medium: entry.medium,
    },
  });
  if (existing) {
    console.log("Skipped existing:", entry.title);
    return;
  }

  const sourcePath = path.join(sourceFolder, entry.filename);
  const data = await fs.readFile(sourcePath);
  const id = crypto.randomUUID();
  const storageKey = `${UPLOAD_CATEGORIES.PAID_RESOURCE}/${id}.pdf`;
  await uploadStorage.savePrivateFile(
    UPLOAD_CATEGORIES.PAID_RESOURCE, `${id}.pdf`, data,
  );

  try {
    const file = await db.Resource.create({
      id,
      category: "pdf",
      originalFilename: entry.filename,
      displayName: entry.title,
      mimeType: "application/pdf",
      sizeBytes: data.length,
      storageKey,
      visibility: "private",
    });
    await db.DownloadableResource.create({
      ...entry,
      resourceId: file.id,
      accessPolicy: "free",
      status: "published",
    });
    console.log("Imported:", entry.title);
  } catch (error) {
    await uploadStorage.deletePrivateFile(storageKey).catch(() => undefined);
    throw error;
  }
};

try {
  await db.sequelize.authenticate();
  for (const entry of initialDownloads) await importDownload(entry);
} finally {
  await db.sequelize.close();
}
