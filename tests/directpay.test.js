import crypto from "node:crypto";
import request from "supertest";
import { app } from "../src/app.js";
import { directPayHealth } from "../src/modules/integrations/directpay/directpay.service.js";
import { responseSigningPayload, signPayload, verifyPayload } from "../src/modules/integrations/directpay/directpay.signature.js";

const keyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKey = keyPair.privateKey.export({ type: "pkcs8", format: "pem" });
const publicKey = keyPair.publicKey.export({ type: "spki", format: "pem" });
const response = { orderId: "order-1", transactionId: "transaction-1", reference: "APL-1", amount: "2500.00", currency: "LKR", status: "SUCCESS" };

describe("DirectPay sandbox foundation", () => {
  it("reports disabled by default without revealing configuration", () => {
    expect(directPayHealth({ enabled: false, environment: "sandbox" })).toEqual({ status: "disabled", environment: "sandbox", enabled: false });
  });

  it("detects missing enabled sandbox configuration", () => {
    expect(directPayHealth({ enabled: true, environment: "sandbox" }).status).toBe("incomplete");
  });

  it("signs and verifies a valid response signature", () => {
    const signature = signPayload(responseSigningPayload(response), privateKey);
    expect(verifyPayload(responseSigningPayload(response), signature, publicKey)).toBe(true);
  });

  it("rejects an invalid response signature", () => {
    expect(verifyPayload(responseSigningPayload(response), "not-a-signature", publicKey)).toBe(false);
  });

  it("rejects malformed callback payloads and never grants access", async () => {
    const malformed = await request(app).post("/api/v1/payments/directpay/response").send({ orderId: "order-1" });
    expect(malformed.status).toBe(422);
    const health = await request(app).get("/api/v1/payments/directpay/health");
    expect(health.body.data).toMatchObject({ status: "disabled", enabled: false });
  });
});
