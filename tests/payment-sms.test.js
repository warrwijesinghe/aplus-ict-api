import { jest } from "@jest/globals";
import { db } from "../src/models/index.js";
import { env } from "../src/config/env.js";
import { paymentApprovedSmsText, paymentCorrectionSmsText, queueOrderProductSms, queueStudentPaymentSms, receiptReceivedSmsText } from "../src/modules/commerce/commerce.service.js";
import { queueAutomatedSms } from "../src/modules/sms/sms.service.js";

const order = { id: "2a5d5d53-5b1c-4be1-9f72-72ee362b562d", orderNumber: "26080001" };
const message = {
  id: "sms-1", recipient: "94771234567", sender: "APLUSICT", text: "Receipt received", category: "payment",
  messageType: 0, contentType: "standard", status: "queued", attemptCount: 0, maxAttempts: 3,
  nextAttemptAt: new Date(), createdAt: new Date(), eventKey: "RECEIPT_RECEIVED:payment-1",
};

describe("transactional payment SMS", () => {
  it("queues product details in the order transaction with stable deduplication keys and Sinhala support", async () => {
    const keys = ["SMS_ENABLED", "TEXTLK_SMS_URL", "TEXTLK_API_TOKEN", "TEXTLK_SENDER_ID"];
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    Object.assign(process.env, { SMS_ENABLED: "true", TEXTLK_SMS_URL: "https://textlk.test/send", TEXTLK_API_TOKEN: "test-token", TEXTLK_SENDER_ID: "A Plus ICT" });
    const profile = jest.spyOn(db.StudentProfile, "findOne").mockResolvedValue({ mobileNumber: "0771234567" });
    const queued = jest.spyOn(db.SmsMessage, "findOrCreate").mockImplementation(async ({ defaults }) => [{ ...message, ...defaults }, true]);
    const transaction = { id: "order-transaction" };
    try {
      const input = { order: { ...order, userId: "student-1" }, product: { Course: { titleEn: "Grade 11 ICT" }, Lesson: { title: "තොරතුරු තාක්ෂණය", lessonNumber: 1 }, CourseTrack: { Medium: { nameEn: "Sinhala" } } }, actorUserId: "student-1", transaction };
      await queueOrderProductSms(input);
      await queueOrderProductSms(input);
      expect(queued).toHaveBeenCalledTimes(2);
      for (const [options] of queued.mock.calls) {
        expect(options.transaction).toBe(transaction);
        expect(options.where.eventKey).toBe(`ORDER_PRODUCT:${order.id}:1`);
        expect(options.defaults).toMatchObject({ contentType: "multilingual", recipient: "94771234567" });
        expect(options.defaults.text).toContain("Grade 11 ICT");
        expect(options.defaults.text).toContain("තොරතුරු තාක්ෂණය");
        expect(options.defaults.text).toContain("Medium: Sinhala");
      }
    } finally {
      profile.mockRestore(); queued.mockRestore();
      for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
    }
  });
  it("does not let disabled SMS prevent an authoritative payment transaction", async () => {
    const previous = process.env.SMS_ENABLED;
    process.env.SMS_ENABLED = "false";
    try {
      await expect(queueStudentPaymentSms({ order, actorUserId: "admin-1", eventKey: "PAYMENT_APPROVED:order-1", text: "Payment approved" })).resolves.toEqual({ skipped: true, reason: "sms_disabled" });
    } finally { if (previous === undefined) delete process.env.SMS_ENABLED; else process.env.SMS_ENABLED = previous; }
  });

  it("uses concise PAYMENT messages with the order reference and public order link", () => {
    const receipt = receiptReceivedSmsText(order);
    const approved = paymentApprovedSmsText(order);
    const correction = paymentCorrectionSmsText(order);

    expect(receipt).toContain("Receipt received.\nOrder:26080001");
    expect(receipt).toContain("under review");
    expect(approved).toContain("Payment approved.\nOrder:26080001");
    expect(approved).toContain(`${env.publicWebUrl}/student/orders/`);
    expect(correction).toContain("Payment needs attention.\nOrder:26080001");
    expect(correction).toContain("Review & resubmit receipt");
    for (const text of [receipt, approved, correction]) expect([...text].length).toBeLessThanOrEqual(160);
  });

  it("returns the existing outbox message when the same automated event is retried", async () => {
    const previous = { SMS_ENABLED: process.env.SMS_ENABLED, TEXTLK_SMS_URL: process.env.TEXTLK_SMS_URL, TEXTLK_API_TOKEN: process.env.TEXTLK_API_TOKEN, TEXTLK_SENDER_ID: process.env.TEXTLK_SENDER_ID };
    Object.assign(process.env, { SMS_ENABLED: "true", TEXTLK_SMS_URL: "https://textlk.test/send", TEXTLK_API_TOKEN: "test-token", TEXTLK_SENDER_ID: "A Plus ICT" });
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
