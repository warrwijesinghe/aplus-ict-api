import "dotenv/config";
import { sequelize } from "../src/config/database.js";
import { bootstrapAdmin } from "../src/modules/auth/auth.js";
const [email, password, name] = process.argv.slice(2);
if (!email || !password) {
  console.error(
    "Usage: node scripts/bootstrap-admin.js <email> <password> [name]",
  );
  process.exit(1);
}
try {
  await sequelize.authenticate();
  const user = await bootstrapAdmin({ email, password, name });
  console.log(`Created admin ${user.email}`);
} finally {
  await sequelize.close();
}
