import { getSmsConfig } from "../src/modules/sms/sms.config.js";
import { jest } from "@jest/globals";
import { normalizeSriLankanMobile, sendSms } from "../src/modules/sms/sms.service.js";

const config = getSmsConfig({ SMS_ENABLED: "true", TEXTLK_SMS_URL: "https://textlk.test/send", TEXTLK_API_TOKEN: "test-token", TEXTLK_SENDER_ID: "A Plus ICT", SMS_REQUEST_TIMEOUT_MS: "1000" });
const response = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });

describe("Text.lk SMS gateway adapter", () => {
  it("normalizes common Sri Lankan mobile formats", () => {
    expect(normalizeSriLankanMobile("077 123 4567")).toBe("94771234567");
    expect(normalizeSriLankanMobile("+94-77-123-4567")).toBe("94771234567");
  });

  it("uses the documented Text.lk JSON body and only accepts a success status", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response({ status: "success", data: { uid: "message-id" } }));
    const result = await sendSms({ recipient: "94771234567", message: "Hello" }, config, fetchImpl);
    expect(result).toMatchObject({ accepted: true, code: "200" });
    expect(fetchImpl).toHaveBeenCalledWith("https://textlk.test/send", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ recipient: "94771234567", sender_id: "A Plus ICT", type: "plain", message: "Hello" });
  });

  it("rejects a Text.lk error response even when HTTP succeeds", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response({ status: "error" }));
    await expect(sendSms({ recipient: "94771234567", message: "Hello" }, config, fetchImpl)).resolves.toMatchObject({ accepted: false, code: "200" });
  });
});
