import { DataTypes } from 'sequelize';
import { defineModel } from './helpers.js';

export const defineLessonEnrolment = (sequelize) => defineModel(sequelize, 'LessonEnrolment', {
  userId: { type: DataTypes.UUID, allowNull: false },
  courseTrackId: { type: DataTypes.UUID, allowNull: false },
  lessonId: { type: DataTypes.UUID, allowNull: false },
  enrolledAt: { type: DataTypes.DATE, allowNull: false },
  // Legacy column retained for compatibility. Free membership never expires;
  // purchased access is governed exclusively by Entitlement.endsAt.
  expiresAt: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
}, { indexes: [{ unique: true, fields: ['userId', 'lessonId'] }] });
