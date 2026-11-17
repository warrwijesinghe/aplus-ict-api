import { parseTopicCsv } from "../src/modules/content/topic-import.js";

describe("Lesson topic CSV", () => {
  it("supports UTF-8, quoted commas, escaped quotes and multiline summaries", () => {
    expect(parseTopicCsv('\uFEFFtitle,summary\r\n"දත්ත, තොරතුරු","Line 1\r\nLine ""2"""\r\nNetworking,')).toEqual([
      { title: "දත්ත, තොරතුරු", descriptionEn: 'Line 1\nLine "2"' },
      { title: "Networking", descriptionEn: "" },
    ]);
    expect(parseTopicCsv("title\nDatabases")).toEqual([{ title: "Databases", descriptionEn: "" }]);
  });

  it.each([
    ["name\nNetworking", "CSV line 1"],
    ['title,summary\nNetworking,"missing', "CSV line 2"],
    ["title,summary\nNetworking", "CSV line 2"],
    ["title\nNetworking\nnetworking", "CSV line 3"],
  ])("reports the affected line for invalid files", (text, error) => {
    expect(() => parseTopicCsv(text)).toThrow(error);
  });
});
