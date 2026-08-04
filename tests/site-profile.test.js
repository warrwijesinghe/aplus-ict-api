import request from "supertest";
import { app } from "../src/app.js";

describe("public site profile", () => {
  it("returns the legal operator without DirectPay configuration", async () => {
    const response = await request(app).get("/api/v1/site-profile");
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      brandName: "A Plus ICT",
      legalBusinessName: "Miracle Network and Solutions (Pvt) Ltd",
      companyRegistrationNumber: "PV00201205",
    });
    expect(JSON.stringify(response.body)).not.toContain("DIRECTPAY_API_KEY");
  });
});
