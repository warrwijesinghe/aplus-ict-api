import { app } from "./app.js";
import { env } from "./config/env.js";
import { sequelize } from "./config/database.js";
import { initializeUploadDirectories } from "./modules/resources/upload-config.js";
import { startSmsWorker } from "./modules/sms/sms.worker.js";

Promise.all([initializeUploadDirectories(), sequelize.authenticate()])
  .then(() => {
    console.log("aplus-ict-api database connected");
    const server = app.listen(env.port, "0.0.0.0", () => console.log(`aplus-ict-api listening on ${env.port}`));
    const stopSmsWorker = startSmsWorker();
    const shutdown = () => { stopSmsWorker(); server.close(() => process.exit(0)); };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  })
  .catch((error) => { console.error("API startup failed:", error.message); process.exit(1); });
