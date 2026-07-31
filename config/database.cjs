require("dotenv").config();
module.exports = {
  development: {
    dialect: "mariadb",
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || "aplus_ict",
    username: process.env.DB_USER || "aplus_ict",
    password: process.env.DB_PASSWORD || "",
    logging: false,
  },
};
