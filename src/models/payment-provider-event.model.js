import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

export const definePaymentProviderEvent = (sequelize) => defineModel(sequelize, "PaymentProviderEvent", {
  provider: { type: DataTypes.ENUM("directpay"), allowNull: false, defaultValue: "directpay" },
  providerEventId: DataTypes.STRING,
  paymentTransactionId: DataTypes.UUID,
  orderId: DataTypes.UUID,
  eventType: { type: DataTypes.STRING, allowNull: false },
  eventStatus: DataTypes.STRING,
  payloadHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  signatureValid: DataTypes.BOOLEAN,
  processed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  processedAt: DataTypes.DATE,
  processingError: DataTypes.STRING,
  receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
});
