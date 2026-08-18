import "dotenv/config";
import { sequelize } from "../src/config/database.js";
import { setupReviewer } from "../src/modules/auth/reviewer-setup.service.js";

try {
  await sequelize.authenticate();
  const result = await setupReviewer({ userOnly: process.argv.includes("--user-only") });
  console.log(`Reviewer user: ${result.user.email} (${result.user.id})`);
  if (result.courseTrack) {
    console.log(`Review course track: ${result.courseTrack.title} (${result.courseTrack.id})`);
    console.log(`Active premium lesson entitlements: ${result.entitlementCount}`);
  }
} finally {
  await sequelize.close();
}
