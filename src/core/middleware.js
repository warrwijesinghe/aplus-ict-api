import { validationResult } from "express-validator";
import { ApiError } from "./errors.js";
export const validate = (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty())
    return next(new ApiError(422, "Validation failed", result.array()));
  next();
};
export const notFound = (req, res, next) =>
  next(new ApiError(404, `Route not found: ${req.method} ${req.path}`));
export const errorHandler = (err, req, res, _next) => {
  const status =
    err.status ||
    (err.name === "MulterError" || err.name === "SequelizeValidationError" ? 422 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: {
      message: err.message || "Internal server error",
      details: err.details,
    },
  });
};
