require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= MONGODB CONNECTION ================= */

const uri = process.env.MONGO_URI; // add this in Render env vars
const client = new MongoClient(uri);

let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db(); // default DB from URI
    console.log("MongoDB Connected Successfully");
  } catch (err) {
    console.error("MongoDB Connection Failed:", err);
  }
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
    console.log(err);
    res.status(500).send("Server error");
  }
});

/* ================= ADD PRODUCTIVITY ================= */

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
    console.log(err);
    res.status(500).send("DB Error");
  }
});

/* ================= ADMIN RECORDS ================= */

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
    console.log(err);
    res.status(500).send("DB Error");
  }
});

/* ================= USER RECORDS ================= */

app.get("/records/:userId", async (req, res) => {
  try {
    const records = await db.collection("productivity").find({
      userId: new ObjectId(req.params.userId)
    }).sort({ date: -1 }).toArray();

    res.json(records);

  } catch (err) {
    console.log(err);
    res.status(500).send("DB Error");
  }
});

/* ================= FILTER BY DATE ================= */

app.get("/records-by-date", async (req, res) => {
  try {
    const { date, userId, role } = req.query;

    const selectedDate = new Date(date);
    const nextDate = new Date(selectedDate);
    nextDate.setDate(selectedDate.getDate() + 1);

    let query = {
      date: { $gte: selectedDate, $lt: nextDate }
    };

    if (role !== "admin") {
      query.userId = new ObjectId(userId);
    }

    let records = await db.collection("productivity").find(query).toArray();

    if (role === "admin") {
      records = await db.collection("productivity").aggregate([
        { $match: query },
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
    }

    res.json(records);

  } catch (err) {
    console.log(err);
    res.status(500).send("DB Error");
  }
});

/* ================= TEST USERS ================= */

app.get("/test-users", async (req, res) => {
  try {
    const users = await db.collection("users").find().toArray();
    res.json(users);
  } catch (err) {
    console.log(err);
    res.status(500).send("DB Error");
  }
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
