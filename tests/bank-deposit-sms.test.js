import { bankAccounts, findBankAccount } from "../src/modules/commerce/bank-accounts.js";
import { env } from "../src/config/env.js";
import { bankDepositSmsText, orderDetailsSmsText, receiptUploadSmsText } from "../src/modules/commerce/commerce.service.js";

describe("bank deposit payment-detail SMS", () => {
  it("includes only the selected account in a readable multi-line SMS", () => {
    const account = findBankAccount("ndb");
    const text = bankDepositSmsText({ orderNumber: "26080001", total: "1500.00" }, account);
    expect(text).toContain("A Plus ICT PAYMENT\nOrder:26080001 | Rs1500");
    expect(text).toContain("Bank: NDB");
    expect(text).toContain("111000370017");
    expect(text).not.toContain("200550052621");
    expect(text).toContain("\nBank: NDB\nBr: Kuliyapitiya\nA/C:");
    expect([...text].length).toBeLessThanOrEqual(160);
  });

  it("does not accept an account supplied outside the server-owned list", () => {
    expect(() => findBankAccount("untrusted-account")).toThrow("Select a valid bank account");
    expect(bankAccounts).toHaveLength(4);
  });

  it("keeps every bank's payment instruction within Mobitel's 160-character limit", () => {
    for (const account of bankAccounts)
      expect([...bankDepositSmsText({ orderNumber: "26080001", total: "1500.00" }, account)].length).toBeLessThanOrEqual(160);
  });

  it("creates one short, order-specific receipt-upload link after the bank details", () => {
    const text = receiptUploadSmsText({ id: "2a5d5d53-5b1c-4be1-9f72-72ee362b562d" });
    expect(text).toContain("Upload receipt:");
    expect(text).toContain(env.publicWebUrl);
    expect(text).toContain("/student/orders/2a5d5d53-5b1c-4be1-9f72-72ee362b562d/payment/bank-deposit");
    expect([...text].length).toBeLessThanOrEqual(160);
  });

  it("creates an order-details SMS for every new order before a payment method is selected", () => {
    const text = orderDetailsSmsText({ id: "2a5d5d53-5b1c-4be1-9f72-72ee362b562d", orderNumber: "26080001", total: "1800.00" });
    expect(text).toContain("A Plus ICT ORDER\nOrder:26080001\nAmount: Rs1800");
    expect(text).toContain("Order ready. Choose payment:");
    expect(text).toContain(`${env.publicWebUrl}/student/orders/2a5d5d53-5b1c-4be1-9f72-72ee362b562d`);
    expect([...text].length).toBeLessThanOrEqual(160);
  });
});
