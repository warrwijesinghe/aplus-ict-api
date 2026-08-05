"use strict";

const columns = {
  course_tracks: {
    publishedAt: { type: "DATE", allowNull: true },
  },
  lessons: {
    titleEn: { type: "STRING", allowNull: true }, titleSi: { type: "STRING", allowNull: true },
    descriptionEn: { type: "TEXT", allowNull: true }, descriptionSi: { type: "TEXT", allowNull: true },
    estimatedMinutes: { type: "INTEGER", allowNull: true }, isVisible: { type: "BOOLEAN", allowNull: false, defaultValue: true },
    availableFrom: { type: "DATE", allowNull: true }, availableUntil: { type: "DATE", allowNull: true }, publishedAt: { type: "DATE", allowNull: true },
  },
  topics: {
    slug: { type: "STRING", allowNull: true }, isVisible: { type: "BOOLEAN", allowNull: false, defaultValue: true },
    availableFrom: { type: "DATE", allowNull: true }, availableUntil: { type: "DATE", allowNull: true },
  },
  lesson_sections: {
    externalUrl: { type: "STRING", allowNull: true }, instructions: { type: "TEXT", allowNull: true },
    completionMode: { type: "STRING", allowNull: false, defaultValue: "none" }, estimatedMinutes: { type: "INTEGER", allowNull: true },
    maxScore: { type: "DECIMAL(10,2)", allowNull: true }, passingScore: { type: "DECIMAL(10,2)", allowNull: true },
    availableFrom: { type: "DATE", allowNull: true }, availableUntil: { type: "DATE", allowNull: true },
  },
};

module.exports = {
  async up(q, S) {
    const addMissing = async (table, field, definition) => {
      if (!(await q.describeTable(table))[field]) await q.addColumn(table, field, { ...definition, type: definition.type === "DECIMAL(10,2)" ? S.DECIMAL(10, 2) : S[definition.type] });
    };
    for (const [table, fields] of Object.entries(columns)) for (const [field, definition] of Object.entries(fields)) await addMissing(table, field, definition);

    // Existing content uses paid. It is normalized to premium without dropping a
    // record or changing any entitlement relationship.
    await q.sequelize.query("UPDATE lesson_sections SET accessPolicy = 'premium' WHERE accessPolicy IN ('paid', 'preview')", { type: S.QueryTypes.UPDATE });
    await q.changeColumn("lesson_sections", "accessPolicy", { type: S.STRING, allowNull: false, defaultValue: "free" });
    await q.changeColumn("lesson_sections", "type", { type: S.STRING, allowNull: false });
    await q.changeColumn("course_tracks", "availabilityStatus", { type: S.STRING, allowNull: false, defaultValue: "active" });
    await q.sequelize.query("UPDATE lessons SET isVisible = true WHERE isVisible IS NULL");
    await q.sequelize.query("UPDATE topics SET isVisible = true WHERE isVisible IS NULL");

    const ensureIndex = async (table, fields, name, unique = false) => {
      if ((await q.showIndex(table)).some((index) => index.name === name)) return;
      // Existing published data is never deleted merely to make a new
      // constraint fit. If legacy duplicates exist, API validation still
      // prevents new duplicates and the deployment remains safe.
      if (unique) {
        const duplicates = await q.sequelize.query(`SELECT COUNT(*) AS count FROM (SELECT ${fields.join(", ")} FROM ${table} GROUP BY ${fields.join(", ")} HAVING COUNT(*) > 1) duplicates`, { type: S.QueryTypes.SELECT });
        if (Number(duplicates[0].count) > 0) return;
      }
      await q.addIndex(table, fields, { name, unique });
    };
    await ensureIndex("courses", ["academicLevelId", "status", "isPublic"], "courses_level_public_filters");
    await ensureIndex("course_tracks", ["courseId", "mediumId"], "course_tracks_course_medium_unique", true);
    await ensureIndex("course_tracks", ["status", "isPublic", "availabilityStatus"], "course_tracks_public_filters");
    await ensureIndex("lessons", ["trackId", "slug"], "lessons_track_slug_unique", true);
    await ensureIndex("lessons", ["trackId", "sortOrder"], "lessons_track_sort_order");
    await ensureIndex("topics", ["lessonId", "slug"], "topics_lesson_slug_unique", true);
    await ensureIndex("topics", ["lessonId", "status", "isVisible", "sortOrder"], "topics_public_filters");
    await ensureIndex("lesson_sections", ["topicId", "status", "isVisible", "sortOrder"], "lesson_sections_public_topic_filters");

    const ensureForeignKey = async (table, field, target, name) => {
      const existing = await q.getForeignKeyReferencesForTable(table);
      if (existing.some((key) => key.columnName === field)) return;
      const invalid = await q.sequelize.query(`SELECT COUNT(*) AS count FROM ${table} item LEFT JOIN ${target} target ON target.id = item.${field} WHERE item.${field} IS NOT NULL AND target.id IS NULL`, { type: S.QueryTypes.SELECT });
      if (Number(invalid[0].count) === 0) await q.addConstraint(table, { name, fields: [field], type: "foreign key", references: { table: target, field: "id" }, onUpdate: "cascade", onDelete: "restrict" });
    };
    for (const [table, field, target, name] of [
      ["courses", "academicLevelId", "academic_levels", "courses_academic_level_fk"], ["course_tracks", "courseId", "courses", "course_tracks_course_fk"], ["course_tracks", "mediumId", "media", "course_tracks_medium_fk"],
      ["lessons", "trackId", "course_tracks", "lessons_track_fk"], ["topics", "lessonId", "lessons", "topics_lesson_fk"], ["lesson_sections", "lessonId", "lessons", "lesson_sections_lesson_fk"],
      ["lesson_sections", "topicId", "topics", "lesson_sections_topic_fk"], ["lesson_sections", "resourceId", "resources", "lesson_sections_resource_fk"],
    ]) await ensureForeignKey(table, field, target, name);
  },
  async down(q) {
    for (const [table, name] of [["lesson_sections", "lesson_sections_public_topic_filters"], ["topics", "topics_public_filters"], ["topics", "topics_lesson_slug_unique"], ["lessons", "lessons_track_sort_order"], ["lessons", "lessons_track_slug_unique"], ["course_tracks", "course_tracks_public_filters"], ["course_tracks", "course_tracks_course_medium_unique"], ["courses", "courses_level_public_filters"]]) {
      if ((await q.showIndex(table)).some((index) => index.name === name)) await q.removeIndex(table, name);
    }
    for (const [table, fields] of Object.entries(columns)) for (const field of Object.keys(fields)) if ((await q.describeTable(table))[field]) await q.removeColumn(table, field);
  },
};
