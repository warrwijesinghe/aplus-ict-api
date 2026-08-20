import "dotenv/config";
import { sequelize } from "../src/config/database.js";
import { setupReviewer } from "../src/modules/auth/reviewer-setup.service.js";

try {
  await sequelize.authenticate();
  const result = await setupReviewer({ userOnly: process.argv.includes("--user-only") });
  console.log(`Reviewer user: ${result.user.email} (${result.user.id})`);
  console.log(`Active review course tracks: ${result.courseTrackCount}`);
  console.log(`Active premium lesson entitlements: ${result.entitlementCount}`);
} finally {
  await sequelize.close();
}
