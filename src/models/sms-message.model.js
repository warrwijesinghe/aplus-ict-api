import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

export const defineSmsMessage = (sequelize) =>
  defineModel(sequelize, "SmsMessage", {
    recipient: { type: DataTypes.STRING(20), allowNull: false },
    sender: { type: DataTypes.STRING(11), allowNull: false },
    text: { type: DataTypes.STRING(160), allowNull: false },
    category: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "general" },
    messageType: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    contentType: { type: DataTypes.ENUM("standard", "multilingual"), allowNull: false, defaultValue: "standard" },
    status: { type: DataTypes.ENUM("queued", "sending", "sent", "failed"), allowNull: false, defaultValue: "queued" },
    attemptCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    maxAttempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 3 },
    nextAttemptAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lastAttemptAt: DataTypes.DATE,
    acceptedAt: DataTypes.DATE,
    failedAt: DataTypes.DATE,
    gatewayCode: DataTypes.STRING(16),
    gatewayResponse: DataTypes.TEXT,
    failureReason: DataTypes.STRING(500),
    // Present only for server-generated notifications.  Manual messages and
    // intentional resends leave this null so they remain unrestricted.
    eventKey: { type: DataTypes.STRING(191), unique: true },
    createdByUserId: { type: DataTypes.UUID, allowNull: false },
    resentFromMessageId: DataTypes.UUID,
  });

export const defineSmsMessageAttempt = (sequelize) =>
  defineModel(sequelize, "SmsMessageAttempt", {
    smsMessageId: { type: DataTypes.UUID, allowNull: false },
    attemptNumber: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    status: { type: DataTypes.ENUM("sending", "accepted", "failed"), allowNull: false, defaultValue: "sending" },
    gatewayCode: DataTypes.STRING(16),
    gatewayResponse: DataTypes.TEXT,
    failureReason: DataTypes.STRING(500),
    startedAt: { type: DataTypes.DATE, allowNull: false },
    completedAt: DataTypes.DATE,
  });

export const defineSmsInboundMessage = (sequelize) =>
  defineModel(sequelize, "SmsInboundMessage", {
    sender: { type: DataTypes.STRING(20), allowNull: false },
    recipient: { type: DataTypes.STRING(20), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });
