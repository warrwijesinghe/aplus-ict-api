import { getSmsConfig } from "./sms.config.js";
import { processNextSms, recoverStalledSms } from "./sms.service.js";

export const startSmsWorker = () => {
  const config = getSmsConfig();
  if (!config.enabled) {
    console.info("SMS worker is disabled");
    return () => {};
  }
  if (![config.url, config.apiToken, config.sender].every(Boolean)) {
    console.error("SMS worker is not started because its configuration is incomplete");
    return () => {};
  }
  let processing = false;
  const run = async () => {
    if (processing) return;
    processing = true;
    try {
      await recoverStalledSms(config.sendingTimeoutMs);
      for (let count = 0; count < 20; count += 1) {
        const result = await processNextSms(config);
        if (!result) break;
      }
    } catch (error) {
      console.error("SMS worker cycle failed:", error.message);
    } finally {
      processing = false;
    }
  };
  void run();
  const interval = setInterval(() => void run(), config.workerIntervalMs);
  console.info("SMS worker started");
  return () => clearInterval(interval);
};
