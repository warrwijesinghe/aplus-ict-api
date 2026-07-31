import request from "supertest";
import { app } from "../src/app.js";
describe("health endpoints", () => {
  it("returns health without a database", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});
