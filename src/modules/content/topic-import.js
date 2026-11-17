import { ApiError } from "../../core/errors.js";

const csvError = (line, message) => new ApiError(422, `CSV line ${line}: ${message}`);
export const topicTitleKey = (title) => title.trim().normalize("NFC").toLowerCase();

const readRecords = (text) => {
  const records = [];
  let fields = [], field = "", state = "start", line = 1, startLine = 1;
  const finishField = () => {
    fields.push(field.trim());
    field = "";
    state = "start";
  };
  const finishRecord = () => {
    finishField();
    if (fields.length > 1 || fields[0]) records.push({ fields, line: startLine });
    fields = [];
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === "\n") {
      if (state === "quoted") field += char;
      else finishRecord();
      line++;
      if (state !== "quoted") startLine = line;
    } else if (state === "quoted") {
      if (char !== '"') field += char;
      else if (text[index + 1] === '"') { field += char; index++; }
      else state = "closed";
    } else if (char === ",") {
      finishField();
    } else if (state === "closed") {
      if (char !== " " && char !== "\t") throw csvError(line, "Expected a comma after the quoted value.");
    } else if (char === '"') {
      if (state !== "start") throw csvError(line, "Put quotes around the full value and use two quotes for an embedded quote.");
      state = "quoted";
    } else {
      field += char;
      state = "plain";
    }
  }
  if (state === "quoted") throw csvError(startLine, "A quoted value is missing its closing quote.");
  finishRecord();
  return records;
};

export const parseTopicCsv = (text) => {
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > 256 * 1024)
    throw new ApiError(422, "Upload a UTF-8 CSV file up to 256 KB.");
  const [header, ...rows] = readRecords(text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n"));
  if (!header) throw new ApiError(422, "The CSV file is empty.");
  const columns = header.fields.map((field) => field.toLowerCase());
  if (columns[0] !== "title" || columns.length > 2 || (columns.length === 2 && columns[1] !== "summary"))
    throw csvError(header.line, "Use the header title or title,summary.");
  if (!rows.length) throw new ApiError(422, "Add at least one topic below the header.");
  if (rows.length > 200) throw new ApiError(422, "Upload at most 200 topics at a time.");

  const seen = new Set();
  return rows.map(({ fields, line }) => {
    const [title, summary = ""] = fields;
    if (fields.length !== columns.length) throw csvError(line, "Use the same number of columns as the header.");
    if (!title || title.length > 255 || title.includes("\n")) throw csvError(line, "Enter a topic title of 1 to 255 characters on one line.");
    if (summary.length > 4000) throw csvError(line, "Keep the summary to 4,000 characters or fewer.");
    const key = topicTitleKey(title);
    if (seen.has(key)) throw csvError(line, "This topic title appears more than once in the file.");
    seen.add(key);
    return { title, descriptionEn: summary };
  });
};
