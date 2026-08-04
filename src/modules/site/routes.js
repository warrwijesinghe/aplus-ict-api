import { Router } from "express";
import { businessIdentity } from "../../config/business-identity.js";

const router = Router();
const send = (res, data, status = 200) => res.status(status).json({ data });

// This endpoint deliberately contains only information suitable for public use.
router.get("/site-profile", (_req, res) =>
  send(res, {
    ...businessIdentity,
    shortDescription: "Structured ICT learning from Grade 6 to A/L.",
    socialLinks: [
      { id: "facebook", platform: "facebook", label: "Facebook", url: "https://www.facebook.com/APlusICTclass" },
      { id: "youtube", platform: "youtube", label: "YouTube", url: "https://www.youtube.com/@aplusictclass" },
      { id: "tiktok", platform: "tiktok", label: "TikTok", url: "https://www.tiktok.com/@aplus.ict" },
      { id: "instagram", platform: "instagram", label: "Instagram", url: "https://www.instagram.com/aplusict" },
      { id: "whatsapp", platform: "whatsapp", label: "WhatsApp", url: "https://wa.me/94717105837" },
    ],
    contactChannels: [
      { id: "whatsapp", label: "WhatsApp: 071 710 5837", value: "071 710 5837", publicUrl: "https://wa.me/94717105837" },
    ],
  }),
);

export default router;
