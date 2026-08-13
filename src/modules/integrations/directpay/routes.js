import { Router } from "express";
import crypto from "node:crypto";
import { asyncHandler } from "../../../core/errors.js";
import { authenticate } from "../../auth/auth.js";
import { audit } from "../../../security/authorization.js";
import { directPayHealth, handleDirectPayConfirmation, initiateDirectPay, studentPaymentStatus } from "./directpay.service.js";

const router = Router();
const send = (res, data, status = 200) => res.status(status).json({ data });
const safePayment = (payment) => ({ id: payment.id, orderId: payment.orderId, reference: payment.merchantReference, amount: payment.amount, currency: payment.currency, status: payment.status });

router.get("/payments/directpay/health", (_req, res) => send(res, directPayHealth()));
router.post("/student/orders/:orderId/payments/directpay", authenticate, asyncHandler(async (req, res) => {
  const result = await initiateDirectPay(req.user.sub, req.params.orderId, req.get("Idempotency-Key") || crypto.randomUUID());
  await audit(req, "directpay_payment_initiated", "payment_transaction", result.payment.id, { orderId: req.params.orderId });
  send(res, { payment: safePayment(result.payment), checkout: result.checkout }, 201);
}));
router.get("/student/orders/:orderId/payment-status", authenticate, asyncHandler(async (req, res) => send(res, await studentPaymentStatus(req.user.sub, req.params.orderId))));
// Configure this public HTTPS endpoint in the DirectPay merchant portal.
router.post("/payments/directpay/confirmation", asyncHandler(async (req, res) => { await handleDirectPayConfirmation(req.body); res.status(200).json({ received: true }); }));

export default router;
