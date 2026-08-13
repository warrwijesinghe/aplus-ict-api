import { formatPayHereAmount, mapPayHereStatus, normalizePayHerePhone, payHereHash, payHereNotificationSignature } from "../src/modules/integrations/payhere/payhere.service.js";

describe("PayHere payment helpers", () => {
  const fields = { merchantId: "12345", orderId: "PHORDER", amount: "2800.00", currency: "LKR", merchantSecret: "secret" };
  it("formats server amounts with exactly two decimals", () => {
    expect(formatPayHereAmount("2800")).toBe("2800.00");
    expect(formatPayHereAmount("2800.5")).toBe("2800.50");
    expect(formatPayHereAmount("2800.123")).toBeNull();
  });
  it("creates the documented checkout and callback signatures", () => {
    expect(payHereHash(fields)).toBe("C94C4E21DA80DF8C181C3E2EB00909AF");
    expect(payHereNotificationSignature({ ...fields, statusCode: "2" })).toBe("442CEBE8189EAAC98D8D37DA20E27547");
  });
  it.each([["2", "completed"], ["0", "processing"], ["-1", "cancelled"], ["-2", "failed"], ["-3", "failed"]])("maps PayHere status %s", (status, expected) => expect(mapPayHereStatus(status)).toBe(expected));
  it("normalizes Sri Lankan mobile numbers for PayHere", () => {
    expect(normalizePayHerePhone("077 123 4567")).toBe("94771234567");
    expect(normalizePayHerePhone("0112345678")).toBeNull();
  });
});
