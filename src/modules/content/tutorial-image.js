import { db } from "../../models/index.js";
import { ApiError } from "../../core/errors.js";

export const validateTutorialImage = async (body) => {
  if (!Object.hasOwn(body, "tutorialImageResourceId") || body.tutorialImageResourceId === null) return;
  const id = body.tutorialImageResourceId;
  if (typeof id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
    throw new ApiError(422, "Select a valid tutorial image or remove the selection");
  const resource = await db.Resource.findByPk(id);
  if (!resource || resource.deletedAt || !["active", "ready"].includes(resource.status)
    || resource.visibility !== "public" || resource.accessPolicy !== "public"
    || !["lesson_image", "site_asset", "course_thumbnail"].includes(resource.category)
    || !resource.mimeType?.startsWith("image/"))
    throw new ApiError(422, "Tutorial images must be active public images from the Resource Library");
};
