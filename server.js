require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= MONGODB ================= */

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;

async function connectDB() {
  await client.connect();
  db = client.db("productivity_crm_db");
  console.log("MongoDB Connected");
}

connectDB();

/* ================= LOGIN ================= */

app.post("/login", async (req, res) => {
  try {

    const { email, password } = req.body;

    const user = await db.collection("users").findOne({ email });

    if (!user || user.password !== password) {
      return res.json({ success: false });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        role: user.role
      }
    });

  } catch (err) {
    res.status(500).send("Server error");
  }
});

/* ================= ADD RECORD ================= */

app.post("/records", async (req, res) => {
  try {

    const { date, task, userId } = req.body;

    await db.collection("productivity").insertOne({
      date: new Date(date),
      task,
      userId: new ObjectId(userId)
    });

    res.send("Saved");

  } catch (err) {
    res.status(500).send("DB Error");
  }
});

/* ================= ADMIN ALL RECORDS ================= */

app.get("/records", async (req, res) => {
  try {

    const records = await db.collection("productivity").aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          date: 1,
          task: 1,
          name: "$user.name"
        }
      },
      { $sort: { date: -1 } }
    ]).toArray();

    res.json(records);

  } catch (err) {
    res.status(500).send("DB Error");
  }
});

/* ================= USER RECORDS ================= */

app.get("/records/:userId", async (req, res) => {
  try {

    const records = await db.collection("productivity").aggregate([
      {
        $match: {
          userId: new ObjectId(req.params.userId)
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          date: 1,
          task: 1,
          name: "$user.name"
        }
      },
      { $sort: { date: -1 } }
    ]).toArray();

    res.json(records);

  } catch (err) {
    res.status(500).send("DB Error");
  }
});

/* ================= USER DATE FILTER ================= */

app.get("/records-by-date", async (req, res) => {
  try {

    const { date, userId } = req.query;

    const start = new Date(date);
    const end = new Date(date);
    end.setDate(start.getDate() + 1);

    const records = await db.collection("productivity").aggregate([
      {
        $match: {
          userId: new ObjectId(userId),
          date: { $gte: start, $lt: end }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          date: 1,
          task: 1,
          name: "$user.name"
        }
      }
    ]).toArray();

    res.json(records);

  } catch (err) {
    res.status(500).send("DB Error");
  }
});

/* ================= ADMIN DATE FILTER ================= */

app.get("/admin-records-by-date", async (req, res) => {
  try {

    const { date } = req.query;

    const start = new Date(date);
    const end = new Date(date);
    end.setDate(start.getDate() + 1);

    const records = await db.collection("productivity").aggregate([
      {
        $match: {
          date: { $gte: start, $lt: end }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          date: 1,
          task: 1,
          name: "$user.name"
        }
      }
    ]).toArray();

    res.json(records);

  } catch (err) {
    res.status(500).send("DB Error");
  }
});

/* ================= SERVER ================= */

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
