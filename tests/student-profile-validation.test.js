import { describe, expect, it } from "@jest/globals";
import { profileInput } from "../src/modules/students/student-profile.service.js";

describe("student profile input", () => {
  it("accepts a Sri Lankan student profile and normalizes phone input", () => {
    expect(profileInput({
      fullName: "Student Name", mobileNumber: "077 123 4567", whatsAppNumber: "+94771234567",
      examYear: "2027", preferredMedium: "sinhala",
    })).toMatchObject({ mobileNumber: "0771234567", whatsAppNumber: "+94771234567", examYear: 2027 });
  });

  it("rejects invalid mobile numbers and unsupported media", () => {
    expect(() => profileInput({ mobileNumber: "0112345678" })).toThrow("valid Sri Lankan mobile");
    expect(() => profileInput({ preferredMedium: "tamil" })).toThrow("sinhala or english");
  });
});
