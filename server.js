require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: "*"
}));

app.use(express.json());

/* ================= MYSQL CONNECTION ================= */

const db = mysql.createConnection({
  host: "railway-host",
  user: "railway-user",
  password: "railway-pass",
  database: "railway-db"
});



db.connect(err => {
  if (err) {
    console.log("MySQL error:", err);
  } else {
    console.log("MySQL Connected");
  }
});

/* ================= LOGIN ================= */

app.post("/login", (req, res) => {

  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email=? AND password=?",
    [email, password],
    (err, result) => {

      if (err) return res.json({ success: false });

      if (result.length === 0) {
        return res.json({ success: false });
      }

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

/* ================= ADD PRODUCTIVITY ================= */

app.post("/records", (req, res) => {

  const { date, task, userId } = req.body;

  db.query(
    "INSERT INTO productivity (date, task, user_id) VALUES (?, ?, ?)",
    [date, task, userId],
    err => {

      if (err) {
        console.log(err);
        return res.status(500).send("DB Error");
      }

      res.send("Saved");
    }
  );
});

/* ================= GET ALL RECORDS (ADMIN) ================= */

app.get("/records", (req, res) => {

  const sql = `
    SELECT productivity.date, productivity.task, users.name
    FROM productivity
    JOIN users ON productivity.user_id = users.id
    ORDER BY productivity.date DESC
  `;

  db.query(sql, (err, result) => {

    if (err) {
      console.log(err);
      return res.status(500).send("DB Error");
    }

    res.json(result);
  });
});

/* ================= GET USER RECORDS ================= */

app.get("/records/:userId", (req, res) => {

  const userId = req.params.userId;

  db.query(
    "SELECT date, task FROM productivity WHERE user_id=? ORDER BY date DESC",
    [userId],
    (err, result) => {

      if (err) {
        console.log(err);
        return res.status(500).send("DB Error");
      }

      res.json(result);
    }
  );
});

/* ============ GET RECORDS BY DATE ============ */

app.get("/records-by-date", (req, res) => {

  const { date, userId, role } = req.query;

  let sql = "";
  let params = [];

  if (role === "admin") {

    sql = `
      SELECT DATE(p.date) as date, p.task, u.name
      FROM productivity p
      JOIN users u ON p.user_id = u.id
      WHERE DATE(p.date) = ?
      ORDER BY u.name
    `;

    params = [date];

  } else {

    sql = `
      SELECT DATE(date) as date, task
      FROM productivity
      WHERE DATE(date) = ? AND user_id = ?
      ORDER BY date
    `;

    params = [date, userId];
  }

  db.query(sql, params, (err, result) => {

    if (err) {
      console.log(err);
      return res.status(500).send("DB Error");
    }

    res.json(result);
  });
});


/* ================= SERVER ================= */

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
