import { Op } from "sequelize";
import { db } from "../src/models/index.js";
import { env } from "../src/config/env.js";
import { uploadStorage } from "../src/modules/resources/storage.js";

const confirmed = process.argv.includes("--confirm");
const run = async () => {
  await db.sequelize.authenticate();
  const cutoff = new Date(Date.now() - env.resourceArchiveRetentionDays * 86400e3);
  const resources = await db.Resource.findAll({ where: { status: "archived", archivedAt: { [Op.lt]: cutoff } } });
  console.log(`${confirmed ? "Removing" : "Dry run: would remove"} ${resources.length} archived resource files older than ${env.resourceArchiveRetentionDays} days.`);
  if (confirmed) for (const resource of resources) { await uploadStorage.delete(resource.visibility, resource.storageKey).catch(() => undefined); await resource.update({ status: "deleted", deletedAt: new Date() }); }
  await db.sequelize.close();
};
run().catch((error) => { console.error(error); process.exitCode = 1; });
