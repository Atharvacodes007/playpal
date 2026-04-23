const mysql = require("mysql2");

const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "123456",
  database: process.env.DB_NAME || "playpal",
  port: process.env.DB_PORT || 3307
});

db.connect(err => {
  if (err) console.error("DB Error:", err);
  else console.log("MySQL Connected ✅");
});

module.exports = db;