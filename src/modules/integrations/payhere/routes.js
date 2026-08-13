import { Router } from "express";
import crypto from "node:crypto";
import { asyncHandler } from "../../../core/errors.js";
import { authenticate } from "../../auth/auth.js";
import { audit } from "../../../security/authorization.js";
import { handlePayHereNotification, initiatePayHere, studentPayHerePaymentStatus } from "./payhere.service.js";

const router = Router();
const send = (res, data, status = 200) => res.status(status).json({ data });
const safePayment = (payment) => ({ id: payment.id, orderId: payment.orderId, reference: payment.merchantReference, amount: payment.amount, currency: payment.currency, status: payment.status });
router.post("/student/orders/:orderId/payments/payhere", authenticate, asyncHandler(async (req, res) => { const result = await initiatePayHere(req.user.sub, req.params.orderId, req.get("Idempotency-Key") || crypto.randomUUID()); await audit(req, "payhere_payment_initiated", "payment_transaction", result.payment.id, { orderId: req.params.orderId }); send(res, { payment: safePayment(result.payment), checkout: result.checkout }, 201); }));
router.get("/student/orders/:orderId/payment-status", authenticate, asyncHandler(async (req, res) => send(res, await studentPayHerePaymentStatus(req.user.sub, req.params.orderId))));
router.post("/payments/payhere/notify", asyncHandler(async (req, res) => { await handlePayHereNotification(req.body); res.status(200).json({ received: true }); }));
export default router;
