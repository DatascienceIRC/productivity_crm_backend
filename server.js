require("dotenv").config();

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error("JWT_SECRET is missing");
}


const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI);
let db;

(async () => {
  try {
    await client.connect();
    db = client.db("productivity_crm_db");
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed", err);
  }
})();
/* ===== LOGIN ===== */

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.collection("users").findOne({ email });
    if (!user) return res.json({ success: false });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ success: false });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});



/* ===== ADD PRODUCTIVITY ===== */

app.post("/records", auth, async (req, res) => {
  try {
    const { date, task } = req.body;

    await db.collection("productivity").insertOne({
      date: new Date(date),
      task,
      userId: new ObjectId(req.user.id)
    });

    res.send("Saved");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

/* ===== ADMIN ALL RECORDS ===== */

app.get("/records", auth, adminOnly, async (req,res)=>{

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

app.get("/records/:userId", auth, async (req, res) => {

  if (req.user.role !== "admin" && req.user.id !== req.params.userId) {
    return res.status(403).send("Forbidden");
  }

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

app.get("/filter-records", auth, async (req, res) => {
  try {
    const { search, month } = req.query;
    let match = {};

    if (req.user.role !== "admin") {
      match.userId = new ObjectId(req.user.id);
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
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

/* ===== MONTHLY REPORT ===== */

app.get("/monthly-report", auth, async (req, res) => {
  try {
    let match = {};

    if (req.user.role !== "admin") {
      match.userId = new ObjectId(req.user.id);
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
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

/* ===== USERS (ADMIN) ===== */

app.get("/users", auth, adminOnly, async (req, res) => {
  const users = await db.collection("users").find().toArray();
  res.json(users);
});

app.post("/users", auth, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).send("Email and password required");
    }

    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) {
      return res.status(409).send("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.collection("users").insertOne({
      name,
      email,
      password: hashedPassword,
      role: role || "user"
    });

    res.send("User added successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.delete("/users/:id", auth, adminOnly, async (req,res)=>{
  await db.collection("users").deleteOne({_id:new ObjectId(req.params.id)});
  res.send("Deleted");
});

/* ===== AUTH ===== */

function auth(req,res,next){

 const authHeader = req.headers.authorization;
if (!authHeader) return res.status(401).send("No token");

const token = authHeader.split(" ")[1];

  jwt.verify(token, SECRET, (err, user)=>{
    if(err) return res.status(403).send("Invalid token");

    req.user = user;
    next();
  });
}

/* ===== Admin middleware ===== */

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).send("Admin only");
  }
  next();
}


/* ===== SERVER ===== */

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));

