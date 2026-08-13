import request from "supertest";
import { app } from "../src/app.js";
import { directPayHealth, normalizeDirectPaySriLankanMobile } from "../src/modules/integrations/directpay/directpay.service.js";
import { parseConfirmationPayload } from "../src/modules/integrations/directpay/directpay.validation.js";

describe("DirectPay one-time payment foundation", () => {
  test.each([
    ["0762305837", "+94762305837"],
    ["+94762305837", "+94762305837"],
    ["94762305837", "+94762305837"],
    ["  0762305837  ", "+94762305837"],
    ["0112345678", null],
    ["", null],
    [null, null],
  ])("normalizes DirectPay Sri Lankan mobile %p", (input, expected) => {
    expect(normalizeDirectPaySriLankanMobile(input)).toBe(expected);
  });

  it("reports disabled by default without revealing configuration", () => {
    expect(directPayHealth({ enabled: false, environment: "development" })).toEqual({ status: "disabled", environment: "development", enabled: false });
  });

  it("detects missing enabled configuration", () => {
    expect(directPayHealth({ enabled: true, environment: "development" }).status).toBe("incomplete");
  });

  it("parses the documented server confirmation envelope", () => {
    expect(parseConfirmationPayload({ status: 200, type: "INIT_TRN", paymentCategory: "ONE_TIME", data: { transactionId: 1234, status: "SUCCESS", reference: "DPABC", amount: "2500.00", currency: "LKR", description: "Approved" } })).toEqual({ transactionId: "1234", status: "SUCCESS", reference: "DPABC", amount: "2500.00", currency: "LKR", description: "Approved" });
  });

  it("rejects incomplete confirmation payloads", () => {
    expect(() => parseConfirmationPayload({ data: { status: "SUCCESS" } })).toThrow("incomplete");
  });

  it("rejects malformed confirmation payloads", async () => {
    const malformed = await request(app).post("/api/v1/payments/directpay/confirmation").send({ orderId: "order-1" });
    expect(malformed.status).toBe(422);
    const health = await request(app).get("/api/v1/payments/directpay/health");
    expect(health.body.data).toEqual(directPayHealth());
  });
});
