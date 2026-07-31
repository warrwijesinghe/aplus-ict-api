import request from "supertest";
import { app } from "../src/app.js";
import { validateUpload } from "../src/modules/resources/upload-validation.js";
import { uploadStorage } from "../src/modules/resources/storage.js";

describe("upload validation and storage boundaries", () => {
  it("accepts a verified public image type and supplies a safe extension", () => {
    const result = validateUpload(
      { mimetype: "image/png", size: 8, buffer: Buffer.from("89504e470d0a1a0a", "hex") },
      { kind: "image", maxBytes: 10 },
    );
    expect(result).toEqual({ mimeType: "image/png", extension: ".png" });
  });

  it("rejects unsupported or oversized uploads", () => {
    expect(() => validateUpload(
      { mimetype: "image/svg+xml", size: 1, buffer: Buffer.alloc(1) },
      { kind: "image", maxBytes: 10 },
    )).toThrow("Unsupported file type");
    expect(() => validateUpload(
      { mimetype: "application/pdf", size: 11, buffer: Buffer.from("%PDF-") },
      { kind: "document", maxBytes: 10 },
    )).toThrow("too large");
  });

  it("rejects traversal and never exposes private files as static content", async () => {
    expect(() => uploadStorage.resolvePrivateFile("../secrets.pdf")).toThrow("Unsafe");
    const response = await request(app).get("/uploads/payment-slips/other-student.png");
    expect(response.status).toBe(404);
  });
});
