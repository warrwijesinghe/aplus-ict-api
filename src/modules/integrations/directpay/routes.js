import { Router } from "express";
import crypto from "node:crypto";
import { asyncHandler, ApiError } from "../../../core/errors.js";
import { authenticate } from "../../auth/auth.js";
import { audit, requirePermission } from "../../../security/authorization.js";
import { PERMISSIONS } from "../../../security/permissions.js";
import { db } from "../../../models/index.js";
import { checkDirectPayStatus, directPayHealth, handleDirectPayCallback, initiateDirectPay, studentPaymentStatus } from "./directpay.service.js";
import { validateResponsePayload } from "./directpay.validation.js";

const router = Router(); const send = (res, data, status = 200) => res.status(status).json({ data });
const safeTransaction = (payment) => ({ id: payment.id, orderId: payment.orderId, provider: payment.provider, merchantReference: payment.merchantReference, providerTransactionId: payment.providerTransactionId, providerReference: payment.providerReference, amount: payment.amount, verifiedAmount: payment.verifiedAmount, currency: payment.currency, status: payment.status, providerStatusCode: payment.providerStatusCode, providerStatusMessage: payment.providerStatusMessage, initiatedAt: payment.initiatedAt, verifiedAt: payment.verifiedAt, completedAt: payment.completedAt, lastStatusCheckedAt: payment.lastStatusCheckedAt, verificationSource: payment.verificationSource });

router.get("/payments/directpay/health", (_req, res) => send(res, directPayHealth()));
router.post("/student/orders/:orderId/payments/directpay", authenticate, asyncHandler(async (req, res) => { const result = await initiateDirectPay(req.user.sub, req.params.orderId, req.get("Idempotency-Key") || crypto.randomUUID()); await audit(req, "directpay_payment_initiated", "payment_transaction", result.payment.id, { orderId: req.params.orderId }); send(res, { payment: safeTransaction(result.payment), checkout: result.checkout }, 201); }));
router.get("/student/orders/:orderId/payment-status", authenticate, asyncHandler(async (req, res) => send(res, await studentPaymentStatus(req.user.sub, req.params.orderId, req.query.refresh === "true"))));
router.get("/student/payments/:paymentTransactionId", authenticate, asyncHandler(async (req, res) => { const payment = await db.PaymentTransaction.findByPk(req.params.paymentTransactionId); if (!payment) throw new ApiError(404, "Payment transaction not found"); send(res, await studentPaymentStatus(req.user.sub, payment.orderId, req.query.refresh === "true")); }));
// DirectPay's documented ONE_TIME response is a signed JSON POST. Browser query
// parameters are intentionally ignored; this endpoint is unauthenticated by design.
router.post("/payments/directpay/callback", asyncHandler(async (req, res) => { const result = await handleDirectPayCallback(req.body); if (result.requiresStatusCheck) await checkDirectPayStatus(result.paymentId, "directpay_callback"); send(res, result); }));
// Compatibility alias for the Task 01 route. It retains the same strict
// callback validation and never grants access from an unverified payload.
router.post("/payments/directpay/response", asyncHandler(async (req, res) => { validateResponsePayload(req.body); const result = await handleDirectPayCallback(req.body); if (result.requiresStatusCheck) await checkDirectPayStatus(result.paymentId, "directpay_callback"); send(res, result); }));
router.get("/admin/directpay-payments", authenticate, requirePermission(PERMISSIONS.PAYMENTS_VIEW), asyncHandler(async (_req, res) => { const rows = await db.PaymentTransaction.findAll({ include: [{ model: db.Order }], order: [["createdAt", "DESC"]] }); send(res, rows.map((payment) => ({ ...safeTransaction(payment), orderNumber: payment.Order?.orderNumber, orderStatus: payment.Order?.status, paymentStatus: payment.Order?.paymentStatus }))); }));
router.get("/admin/directpay-payments/:id", authenticate, requirePermission(PERMISSIONS.PAYMENTS_VIEW), asyncHandler(async (req, res) => { const payment = await db.PaymentTransaction.findByPk(req.params.id, { include: [{ model: db.PaymentProviderEvent, as: "ProviderEvents" }] }); if (!payment) throw new ApiError(404, "Payment transaction not found"); send(res, { ...safeTransaction(payment), events: (payment.ProviderEvents || []).map((event) => ({ id: event.id, eventType: event.eventType, eventStatus: event.eventStatus, signatureValid: event.signatureValid, processed: event.processed, processingError: event.processingError, receivedAt: event.receivedAt })) }); }));
router.post("/admin/directpay-payments/:id/reconcile", authenticate, requirePermission(PERMISSIONS.PAYMENTS_RECONCILE), asyncHandler(async (req, res) => { const result = await checkDirectPayStatus(req.params.id, "admin_reconciliation"); await audit(req, "directpay_payment_reconciled", "payment_transaction", req.params.id, { status: result.payment.status, idempotent: !!result.idempotent }); send(res, { payment: safeTransaction(result.payment), idempotent: !!result.idempotent, pending: !!result.pending }); }));

export default router;
