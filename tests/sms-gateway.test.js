import { getSmsConfig } from "../src/modules/sms/sms.config.js";
import { jest } from "@jest/globals";
import { normalizeSriLankanMobile, sendToMobitel } from "../src/modules/sms/sms.service.js";

const config = getSmsConfig({ SMS_ENABLED: "true", SMS_USERNAME: "user", SMS_PASSWORD: "password", SMS_SENDER: "MIRACLE", SMS_REQUEST_TIMEOUT_MS: "1000" });
const response = (body, ok = true, status = 200) => ({ ok, status, text: async () => body });

describe("Mobitel SMS gateway adapter", () => {
  it("normalizes common Sri Lankan mobile formats", () => {
    expect(normalizeSriLankanMobile("077 123 4567")).toBe("94771234567");
    expect(normalizeSriLankanMobile("+94-77-123-4567")).toBe("94771234567");
  });

  it("uses the documented JSON body for standard SMS", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response("200"));
    const result = await sendToMobitel({ contentType: "standard", sender: "MIRACLE", recipient: "94771234567", text: "Hello", messageType: 0 }, config, fetchImpl);
    expect(result).toMatchObject({ accepted: true, code: "200" });
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("esmsproxyURL.php"), expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({ username: "user", password: "password", from: "MIRACLE", to: "94771234567", text: "Hello", mesageType: 0 });
  });

  it("uses the documented multi-language parameter names and reports gateway failures", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response("161"));
    const result = await sendToMobitel({ contentType: "multilingual", sender: "MIRACLE", recipient: "94771234567", text: "හලෝ", messageType: 0 }, config, fetchImpl);
    expect(result).toMatchObject({ accepted: false, code: "161" });
    expect(fetchImpl.mock.calls[0][0]).toContain("esmsproxy_multilang.php?m=");
    expect(fetchImpl.mock.calls[0][0]).toContain("&r=94771234567");
  });
});
