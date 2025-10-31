// backend/server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: "https://data-add-management.netlify.app",  // your Netlify frontend
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  },
});
const upload = multer({ storage });

// ---- Upload Route ----
app.post("/api/upload", upload.single("adFile"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ message: "File uploaded successfully", url: fileUrl });
});

// ---- Twitter Proxy ----
app.all("/twitter/*", async (req, res) => {
  try {
    const endpoint = req.params[0];
    const method = req.method;
    const bearer = process.env.TWITTER_BEARER;
    const url = `https://api.twitter.com/2/${endpoint}`;
    const options = {
      method,
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    };
    if (["POST", "PUT"].includes(method)) options.body = JSON.stringify(req.body);

    const response = await fetch(url, options);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Twitter proxy failed" });
  }
});

// ---- YouTube Proxy (for analytics / uploads) ----
app.all("/youtube/*", async (req, res) => {
  try {
    const endpoint = req.params[0];
    const method = req.method;
    const token = req.headers.authorization?.replace("Bearer ", "");
    const url = `https://www.googleapis.com/youtube/v3/${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify(req.body) : undefined,
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "YouTube proxy failed" });
  }
});

app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
