import express, { Router } from "express";
import { asyncHandler, ApiError } from "../../core/errors.js";
import { authenticate } from "../auth/auth.js";
import { audit, requirePermission } from "../../security/authorization.js";
import { PERMISSIONS } from "../../security/permissions.js";
import { getSmsConfig } from "./sms.config.js";
import { listSmsMessages, queueSms, receiveSms, resendSms } from "./sms.service.js";

const send = (res, data, status = 200) => res.status(status).json({ data });
const router = Router();

router.get("/admin/sms/health", authenticate, requirePermission(PERMISSIONS.SMS_READ), asyncHandler(async (_req, res) => {
  const config = getSmsConfig();
  send(res, { enabled: config.enabled, configured: Boolean(config.username && config.password && config.sender), sender: config.sender || null });
}));
router.get("/admin/sms/messages", authenticate, requirePermission(PERMISSIONS.SMS_READ), asyncHandler(async (req, res) => send(res, await listSmsMessages(req.query))));
router.post("/admin/sms/messages", authenticate, requirePermission(PERMISSIONS.SMS_SEND), asyncHandler(async (req, res) => {
  const message = await queueSms(req.body, req.user.sub);
  await audit(req, "sms_queued", "sms_message", message.id, { recipient: message.recipient, contentType: message.contentType, messageType: message.messageType });
  send(res, message, 201);
}));
router.post("/admin/sms/messages/:id/resend", authenticate, requirePermission(PERMISSIONS.SMS_RESEND), asyncHandler(async (req, res) => {
  const message = await resendSms(req.params.id, req.user.sub);
  await audit(req, "sms_resent", "sms_message", message.id, { resentFromMessageId: message.resentFromMessageId, recipient: message.recipient });
  send(res, message, 201);
}));

// Mobitel pushes application/x-www-form-urlencoded fields named from, to, and
// message. An optional token adds protection when the provider supports it.
router.post("/integrations/mobitel/sms/inbound", express.urlencoded({ extended: false }), asyncHandler(async (req, res) => {
  const config = getSmsConfig();
  if (config.inboundToken && req.get("x-sms-inbound-token") !== config.inboundToken)
    throw new ApiError(401, "Invalid inbound SMS token");
  const inbound = await receiveSms(req.body);
  send(res, { id: inbound.id, receivedAt: inbound.receivedAt }, 201);
}));

export default router;
