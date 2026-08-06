import { describe, expect, it } from "@jest/globals";
import { profileInput } from "../src/modules/students/student-profile.service.js";

describe("student profile input", () => {
  it("accepts a Sri Lankan student profile and normalizes phone input", () => {
    expect(profileInput({
      fullName: "Student Name", dateOfBirth: "2008-06-18", address: "12 Lake Road", city: "Kandy",
      mobileNumber: "077 123 4567", whatsAppNumber: "+94771234567", schoolName: "Central College", gender: "Female",
      examYear: "2027", preferredMedium: "sinhala",
    })).toMatchObject({ dateOfBirth: "2008-06-18", gender: "female", mobileNumber: "0771234567", whatsAppNumber: "+94771234567", examYear: 2027 });
  });

  it("rejects invalid mobile numbers and unsupported media", () => {
    expect(() => profileInput({ mobileNumber: "0112345678" })).toThrow("valid Sri Lankan mobile");
    expect(() => profileInput({ preferredMedium: "tamil" })).toThrow("sinhala or english");
    expect(() => profileInput({ dateOfBirth: "2030-01-01" })).toThrow("dateOfBirth");
    expect(() => profileInput({ gender: "unknown" })).toThrow("gender");
  });
});
