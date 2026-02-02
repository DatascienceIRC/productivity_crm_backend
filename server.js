require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI);
let db;

(async () => {
  await client.connect();
  db = client.db("productivity_crm_db");
  console.log("MongoDB connected");
})();

/* ===== LOGIN ===== */

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await db.collection("users").findOne({ email });

  if (!user || user.password !== password)
    return res.json({ success: false });

  res.json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      role: user.role
    }
  });
});

/* ===== ADD PRODUCTIVITY ===== */

app.post("/records", async (req, res) => {
  const { date, task, userId } = req.body;

  await db.collection("productivity").insertOne({
    date: new Date(date),
    task,
    userId: new ObjectId(userId)
  });

  res.send("Saved");
});

/* ===== ADMIN ALL RECORDS ===== */

app.get("/records", async (req, res) => {

  const data = await db.collection("productivity").aggregate([
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

  res.json(data);
});

/* ===== USER OWN RECORDS ===== */

app.get("/records/:userId", async (req, res) => {

  const data = await db.collection("productivity").aggregate([
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

  res.json(data);
});

/* ===== SEARCH & FILTER ===== */

app.get("/filter-records", async (req, res) => {

  const { role, userId, search, month } = req.query;

  let match = {};

  if (role !== "admin") {
    match.userId = new ObjectId(userId);
  }

  if (month) {
    const start = new Date(month + "-01");
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    match.date = { $gte: start, $lt: end };
  }

  if (search) {
    match.task = { $regex: search, $options: "i" };
  }

  const data = await db.collection("productivity").aggregate([
    { $match: match },
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

  res.json(data);
});

/* ===== MONTHLY REPORT ===== */

app.get("/monthly-report", async (req, res) => {

  const { role, userId } = req.query;

  let match = {};
  if (role !== "admin") {
    match.userId = new ObjectId(userId);
  }

  const report = await db.collection("productivity").aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          userId: "$userId",
          month: { $month: "$date" },
          year: { $year: "$date" }
        },
        totalTasks: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id.userId",
        foreignField: "_id",
        as: "user"
      }
    },
    { $unwind: "$user" },
    {
      $project: {
        user: "$user.name",
        month: "$_id.month",
        year: "$_id.year",
        totalTasks: 1
      }
    }
  ]).toArray();

  res.json(report);
});

/* ===== USERS (ADMIN) ===== */

app.get("/users", async (req, res) => {
  const users = await db.collection("users").find().toArray();
  res.json(users);
});

app.post("/users", async (req,res)=>{
  await db.collection("users").insertOne(req.body);
  res.send("Added");
});

app.delete("/users/:id", async (req,res)=>{
  await db.collection("users").deleteOne({_id:new ObjectId(req.params.id)});
  res.send("Deleted");
});

/* ===== SERVER ===== */

app.listen(5000, ()=> console.log("Server running on 5000"));
