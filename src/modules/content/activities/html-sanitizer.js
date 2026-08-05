import { ApiError } from "../../../core/errors.js";

const ALLOWED_TAGS = new Set(["p", "br", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "em", "i", "u", "ul", "ol", "li", "table", "thead", "tbody", "tr", "th", "td", "blockquote", "code", "pre", "a", "img", "hr"]);
const VOID_TAGS = new Set(["br", "img", "hr"]);
const SAFE_LINK = /^(https?:|mailto:|#|\/)/i;

// A deliberately restricted allow-list sanitizer.  It never permits styles,
// scripts, forms, iframe/object/embed tags, or arbitrary attributes.
export const sanitizeEducationalHtml = (value) => {
  if (value === undefined || value === null || value === "") return value;
  if (typeof value !== "string") throw new ApiError(422, "content must be text");
  let unsafeUrl = false;
  const sanitized = value
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select)\b[^>]*\/?\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (raw, tagName, rawAttributes) => {
      const tag = tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (raw.startsWith("</")) return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
      const attributes = [];
      const read = /([\w:-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
      for (const match of rawAttributes.matchAll(read)) {
        const name = match[1].toLowerCase();
        const valuePart = (match[2] || "").replace(/^['"]|['"]$/g, "");
        if (name.startsWith("on") || name === "style" || name === "srcdoc") continue;
        if (tag === "a" && name === "href") {
          if (!SAFE_LINK.test(valuePart)) { unsafeUrl = true; continue; }
          attributes.push(` href="${valuePart.replaceAll('"', "&quot;")}"`);
        } else if (tag === "a" && ["title", "target", "rel"].includes(name)) {
          attributes.push(` ${name}="${valuePart.replaceAll('"', "&quot;")}"`);
        } else if (tag === "img" && name === "alt") {
          attributes.push(` alt="${valuePart.replaceAll('"', "&quot;")}"`);
        } else if (tag === "img" && name === "src" && /^https:\/\//i.test(valuePart)) {
          attributes.push(` src="${valuePart.replaceAll('"', "&quot;")}"`);
        }
      }
      return `<${tag}${attributes.join("")}>`;
    });
  if (unsafeUrl) throw new ApiError(422, "Unsafe URL in content");
  return sanitized.trim();
};
