import bcrypt from "bcrypt";
import request from "supertest";
import { app } from "../src/app.js";
import { hasValidReviewerCredentials } from "../src/modules/auth/reviewer-credentials.js";

describe("reviewer login credentials", () => {
  const config = { enabled: true, email: "payhere-review@aplusict.lk", passwordHash: "" };

  beforeAll(async () => {
    config.passwordHash = await bcrypt.hash("review-password", 4);
  });

  it("accepts only the configured email and password", async () => {
    await expect(hasValidReviewerCredentials({ email: config.email, password: "review-password", config })).resolves.toBe(true);
    await expect(hasValidReviewerCredentials({ email: config.email, password: "wrong-password", config })).resolves.toBe(false);
    await expect(hasValidReviewerCredentials({ email: "someone@example.com", password: "review-password", config })).resolves.toBe(false);
  });

  it("rejects the endpoint while review access is disabled", async () => {
    const response = await request(app).post("/api/v1/auth/reviewer-login").send({ email: config.email, password: "review-password" });
    expect(response.status).toBe(503);
    expect(response.body.error.message).toBe("Review access is currently unavailable.");
  });
});
