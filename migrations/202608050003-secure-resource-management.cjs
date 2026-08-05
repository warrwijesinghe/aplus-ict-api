"use strict";

const fields = {
  storedName: { type: require("sequelize").DataTypes.STRING, allowNull: true },
  description: { type: require("sequelize").DataTypes.TEXT, allowNull: true },
  extension: { type: require("sequelize").DataTypes.STRING(12), allowNull: true },
  checksum: { type: require("sequelize").DataTypes.STRING(64), allowNull: true },
  accessPolicy: { type: require("sequelize").DataTypes.STRING, allowNull: false, defaultValue: "admin_only" },
  uploadedByUserId: { type: require("sequelize").DataTypes.UUID, allowNull: true },
  replacedByResourceId: { type: require("sequelize").DataTypes.UUID, allowNull: true },
  archivedAt: { type: require("sequelize").DataTypes.DATE, allowNull: true },
  deletedAt: { type: require("sequelize").DataTypes.DATE, allowNull: true },
  imageWidth: { type: require("sequelize").DataTypes.INTEGER, allowNull: true },
  imageHeight: { type: require("sequelize").DataTypes.INTEGER, allowNull: true },
};

module.exports = {
  async up(q, S) {
    for (const [name, definition] of Object.entries(fields)) await q.addColumn("resources", name, definition);
    await q.changeColumn("resources", "category", { type: S.STRING, allowNull: false });
    await q.changeColumn("resources", "visibility", { type: S.STRING, allowNull: false, defaultValue: "private" });
    await q.changeColumn("resources", "status", { type: S.STRING, allowNull: false, defaultValue: "active" });
    await q.sequelize.query("UPDATE resources SET status = 'active' WHERE status = 'ready'");
    await q.sequelize.query("UPDATE resources SET uploadedByUserId = ownerUserId WHERE uploadedByUserId IS NULL");
    await q.addIndex("resources", ["checksum"]);
    await q.addIndex("resources", ["category", "status"]);
    await q.createTable("resource_links", {
      id: { type: S.UUID, primaryKey: true, allowNull: false },
      resourceId: { type: S.UUID, allowNull: false, references: { model: "resources", key: "id" }, onDelete: "RESTRICT" },
      entityType: { type: S.STRING, allowNull: false }, entityId: { type: S.UUID, allowNull: false },
      purpose: { type: S.STRING, allowNull: false, defaultValue: "attachment" }, sortOrder: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
      createdByUserId: S.UUID, createdAt: { type: S.DATE, allowNull: false }, updatedAt: { type: S.DATE, allowNull: false },
    });
    await q.addIndex("resource_links", ["resourceId", "entityType", "entityId", "purpose"], { unique: true, name: "resource_links_unique_relation" });
  },
  async down(q) {
    await q.dropTable("resource_links");
    await q.removeIndex("resources", ["checksum"]); await q.removeIndex("resources", ["category", "status"]);
    for (const name of Object.keys(fields).reverse()) await q.removeColumn("resources", name);
  },
};
