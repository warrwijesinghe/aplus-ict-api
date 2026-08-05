import fs from "fs/promises";
import path from "path";
import { db } from "../src/models/index.js";
import { uploadStorage } from "../src/modules/resources/storage.js";

const invalidKey = (key) => !key || key.includes("\\") || key.includes("..") || path.isAbsolute(key);
const run = async () => {
  await db.sequelize.authenticate();
  const resources = await db.Resource.findAll(); const links = await db.ResourceLink.findAll({ attributes: ["resourceId"] });
  const linked = new Set(links.map((link) => link.resourceId)); const report = { missingPhysicalFiles: [], invalidStorageKeys: [], unlinkedActiveResources: [], duplicateChecksums: [] };
  const checksums = new Map();
  for (const resource of resources) {
    if (invalidKey(resource.storageKey)) report.invalidStorageKeys.push(resource.id);
    else if (!(await fs.stat(uploadStorage.resolve(resource.visibility, resource.storageKey)).catch(() => null))) report.missingPhysicalFiles.push(resource.id);
    if (["active", "ready"].includes(resource.status) && !linked.has(resource.id)) report.unlinkedActiveResources.push(resource.id);
    if (resource.checksum) { const values = checksums.get(resource.checksum) || []; values.push(resource.id); checksums.set(resource.checksum, values); }
  }
  report.duplicateChecksums = [...checksums.values()].filter((ids) => ids.length > 1);
  console.log(JSON.stringify(report, null, 2)); await db.sequelize.close();
};
run().catch((error) => { console.error(error); process.exitCode = 1; });
