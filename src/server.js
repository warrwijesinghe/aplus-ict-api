import { app } from "./app.js";
import { env } from "./config/env.js";
import { initializeUploadDirectories } from "./modules/resources/upload-config.js";

initializeUploadDirectories()
  .then(() => app.listen(env.port, "0.0.0.0", () => console.log(`aplus-ict-api listening on ${env.port}`)))
  .catch((error) => { console.error("API startup failed:", error.message); process.exit(1); });
