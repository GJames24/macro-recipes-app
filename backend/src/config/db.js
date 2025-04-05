require("dotenv").config(); // 👈 this must be at the top!

const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS, // 👈 this must be a real string!
  port: process.env.DB_PORT,
});

module.exports = pool;
