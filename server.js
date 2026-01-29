require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT 
});


db.connect(err => {
  if (err) console.log("MySQL error:", err);
  else console.log("MySQL Connected");
});

/* LOGIN */

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email=? AND password=?",
    [email, password],
    (err, result) => {

      if (err || result.length === 0)
        return res.json({ success: false });

      const user = result[0];

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          role: user.role
        }
      });
    }
  );
});

/* ADD RECORD */

app.post("/records", (req, res) => {
  const { date, task, userId } = req.body;

  db.query(
    "INSERT INTO productivity (date, task, user_id) VALUES (?, ?, ?)",
    [date, task, userId],
    err => {
      if (err) return res.status(500).send("DB Error");
      res.send("Saved");
    }
  );
});

/* ADMIN RECORDS */

app.get("/records", (req, res) => {

  const sql = `
    SELECT p.date, p.task, u.name
    FROM productivity p
    JOIN users u ON p.user_id = u.id
    ORDER BY p.date DESC
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).send("DB Error");
    res.json(result);
  });
});

/* USER RECORDS */

app.get("/records/:userId", (req, res) => {

  db.query(
    "SELECT date, task FROM productivity WHERE user_id=? ORDER BY date DESC",
    [req.params.userId],
    (err, result) => {
      if (err) return res.status(500).send("DB Error");
      res.json(result);
    }
  );
});

/* FILTER BY DATE */

app.get("/records-by-date", (req, res) => {

  const { date, userId, role } = req.query;

  let sql, params;

  if (role === "admin") {

    sql = `
      SELECT DATE(p.date) as date, p.task, u.name
      FROM productivity p
      JOIN users u ON p.user_id = u.id
      WHERE DATE(p.date) = ?
    `;

    params = [date];

  } else {

    sql = `
      SELECT DATE(date) as date, task
      FROM productivity
      WHERE DATE(date) = ? AND user_id = ?
    `;

    params = [date, userId];
  }

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).send("DB Error");
    res.json(result);
  });
});

app.get("/test-users", (req, res) => {
  db.query("SELECT * FROM users", (err, rows) => {
    if (err) {
      console.log(err);
      return res.status(500).send("DB error");
    }
    res.json(rows);
  });
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
