import { Router } from "express";
import { asyncHandler } from "../../core/errors.js";
import { authenticate } from "../auth/auth.js";
import { activityPlayerResponse, continueLearning, playerCourseResponse, setManualCompletion } from "./student-player.service.js";

const send = (res, data, status = 200) => res.status(status).json({ data });
const router = Router();

router.get("/learning/courses/:courseSlug/player", authenticate, asyncHandler(async (req, res) => send(res, await playerCourseResponse(req.user.sub, req.params.courseSlug))));
router.get("/learning/courses/:courseSlug/continue", authenticate, asyncHandler(async (req, res) => send(res, await continueLearning(req.user.sub, req.params.courseSlug))));
router.get("/learning/courses/:courseSlug/lessons/:lessonSlug/activities/:activityId", authenticate, asyncHandler(async (req, res) => send(res, await activityPlayerResponse(req.user.sub, req.params.courseSlug, req.params.lessonSlug, req.params.activityId, { recordOpen: true }))));
router.patch("/learning/courses/:courseSlug/lessons/:lessonSlug/activities/:activityId/completion", authenticate, asyncHandler(async (req, res) => send(res, await setManualCompletion(req.user.sub, req.params.courseSlug, req.params.lessonSlug, req.params.activityId, Boolean(req.body.completed)))));

export default router;
