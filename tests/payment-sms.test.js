import { jest } from "@jest/globals";
import { db } from "../src/models/index.js";
import { paymentApprovedSmsText, paymentCorrectionSmsText, receiptReceivedSmsText } from "../src/modules/commerce/commerce.service.js";
import { queueAutomatedSms } from "../src/modules/sms/sms.service.js";

const order = { id: "2a5d5d53-5b1c-4be1-9f72-72ee362b562d", orderNumber: "26080001" };
const message = {
  id: "sms-1", recipient: "94771234567", sender: "APLUSICT", text: "Receipt received", category: "payment",
  messageType: 0, contentType: "standard", status: "queued", attemptCount: 0, maxAttempts: 3,
  nextAttemptAt: new Date(), createdAt: new Date(), eventKey: "RECEIPT_RECEIVED:payment-1",
};

describe("transactional payment SMS", () => {
  it("uses concise PAYMENT messages with the order reference and public order link", () => {
    const receipt = receiptReceivedSmsText(order);
    const approved = paymentApprovedSmsText(order);
    const correction = paymentCorrectionSmsText(order);

    expect(receipt).toContain("Receipt received.\nOrder:26080001");
    expect(receipt).toContain("under review");
    expect(approved).toContain("Payment approved.\nOrder:26080001");
    expect(approved).toContain("https://aplusict.lk/student/orders/");
    expect(correction).toContain("Payment needs attention.\nOrder:26080001");
    expect(correction).toContain("Review & resubmit receipt");
    for (const text of [receipt, approved, correction]) expect([...text].length).toBeLessThanOrEqual(160);
  });

  it("returns the existing outbox message when the same automated event is retried", async () => {
    const previous = { SMS_ENABLED: process.env.SMS_ENABLED, SMS_USERNAME: process.env.SMS_USERNAME, SMS_PASSWORD: process.env.SMS_PASSWORD, SMS_SENDER: process.env.SMS_SENDER };
    Object.assign(process.env, { SMS_ENABLED: "true", SMS_USERNAME: "user", SMS_PASSWORD: "password", SMS_SENDER: "APLUSICT" });
    const findOrCreate = jest.spyOn(db.SmsMessage, "findOrCreate")
      .mockResolvedValueOnce([message, true])
      .mockResolvedValueOnce([message, false]);

    try {
      const input = { recipient: "0771234567", text: "Receipt received", category: "payment", messageType: 0, contentType: "standard" };
      const first = await queueAutomatedSms(input, "student-1", "RECEIPT_RECEIVED:payment-1");
      const retry = await queueAutomatedSms(input, "student-1", "RECEIPT_RECEIVED:payment-1");
      expect(first.created).toBe(true);
      expect(retry.created).toBe(false);
      expect(findOrCreate).toHaveBeenCalledTimes(2);
      expect(findOrCreate.mock.calls[1][0].where).toEqual({ eventKey: "RECEIPT_RECEIVED:payment-1" });
    } finally {
      findOrCreate.mockRestore();
      Object.assign(process.env, previous);
    }
  });
});
