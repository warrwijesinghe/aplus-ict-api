import { Op } from "sequelize";
import { db } from "../models/index.js";

export const adminDashboard = async (now = new Date()) => {
  const offsetMs = 330 * 60 * 1000;
  const local = new Date(now.getTime() + offsetMs);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const date = local.getUTCDate();
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const midnight = (day) => new Date(Date.UTC(year, month, day) - offsetMs);
  const periods = Object.entries({
    all: null, month: midnight(1), week: midnight(date - daysSinceMonday), today: midnight(date),
  });
  const [total, active, counts] = await Promise.all([
    db.Course.count(),
    db.Course.count({ where: { status: "published", isPublic: true } }),
    Promise.all(periods.map(async ([period, start]) => {
      const range = start ? { [Op.between]: [start, now] } : null;
      const [students, sales] = await Promise.all([
        db.User.count({ where: { role: "student", ...(range && { createdAt: range }) } }),
        db.OrderItem.sum("quantity", {
          where: { productTypeSnapshot: "lesson_exam_success_pack", lessonId: { [Op.ne]: null } },
          include: [{ model: db.Order, attributes: [], required: true, where: {
            paymentStatus: "verified", status: ["paid", "completed"], ...(range && { completedAt: range }),
          } }],
        }),
      ]);
      return { period, students, sales: Number(sales ?? 0) };
    })),
  ]);
  return {
    courses: { total, active },
    students: Object.fromEntries(counts.map(({ period, students }) => [period, students])),
    sales: Object.fromEntries(counts.map(({ period, sales }) => [period, sales])),
  };
};
