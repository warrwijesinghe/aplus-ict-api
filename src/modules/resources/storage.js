import fs from "fs/promises";
import path from "path";
import { env } from "../../config/env.js";
import { assertUploadCategory, uploadRoots } from "./upload-config.js";

const isInside = (root, target) => target === root || target.startsWith(root + path.sep);
export class UploadStorageService {
  resolve(visibility, storageKey) {
    const root = uploadRoots[visibility];
    if (!root) throw new Error("Unsafe upload storage key");
    const target = path.resolve(root, storageKey);
    if (!isInside(root, target)) throw new Error("Unsafe upload storage key");
    return target;
  }
  async save(visibility, categoryOrKey, storedNameOrBuffer, maybeBuffer) {
    const directKey = Buffer.isBuffer(storedNameOrBuffer);
    const storageKey = directKey ? categoryOrKey : path.posix.join(categoryOrKey, storedNameOrBuffer);
    const buffer = directKey ? storedNameOrBuffer : maybeBuffer;
    if (!directKey) assertUploadCategory(visibility, categoryOrKey);
    const target = this.resolve(visibility, storageKey);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer, { flag: "wx" });
    return storageKey;
  }
  savePublicFile(category, storedName, buffer) { return this.save("public", category, storedName, buffer); }
  savePublicImage(category, storedName, buffer) { return this.savePublicFile(category, storedName, buffer); }
  savePrivateFile(category, storedName, buffer) { return this.save("private", category, storedName, buffer); }
  resolvePrivateFile(storageKey) { return this.resolve("private", storageKey); }
  async openPrivateFile(storageKey) { return fs.readFile(this.resolvePrivateFile(storageKey)); }
  resolvePublicUrl(storageKey) { return `${env.publicUploadUrl.replace(/\/$/, "")}/${storageKey}`; }
  async delete(visibility, storageKey) { await fs.rm(this.resolve(visibility, storageKey), { force: true }); }
  deletePublicFile(key) { return this.delete("public", key); }
  deletePrivateFile(key) { return this.delete("private", key); }
}
export const uploadStorage = new UploadStorageService();
