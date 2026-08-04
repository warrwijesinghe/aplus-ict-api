import { Router } from "express";
import { asyncHandler } from "../../../core/errors.js";
import { directPayHealth, verifyDirectPayResponse } from "./directpay.service.js";

const router = Router();
const send = (res, data, status = 200) => res.status(status).json({ data });

router.get("/payments/directpay/health", (_req, res) => send(res, directPayHealth()));
router.post("/payments/directpay/response", asyncHandler(async (req, res) => {
  const transaction = verifyDirectPayResponse(req.body);
  // Do not log payloads, signatures, keys, or customer data. Entitlements remain untouched.
  console.info("Verified DirectPay sandbox response", transaction);
  send(res, { received: true, verified: true, entitlementGranted: false });
}));

export default router;
