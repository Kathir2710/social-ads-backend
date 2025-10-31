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

app.use(cors());
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
// ================== TWITTER PROXY API ==================
import fetch from "node-fetch";

app.use(express.json());

// Fetch Twitter Profile, Tweets, or Metrics via backend proxy
app.all("/twitter/:endpoint(*)", async (req, res) => {
  try {
    const endpoint = req.params.endpoint;
    const method = req.method;
    const body = req.body;

    // Your saved Bearer token from your Twitter App (OAuth 2.0 User Context)
    const token = process.env.TWITTER_BEARER_TOKEN;
    if (!token) return res.status(401).json({ error: "Missing Twitter Bearer Token" });

    const response = await fetch(`https://api.twitter.com/2/${endpoint}`, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: method === "POST" ? JSON.stringify(body) : undefined
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Twitter proxy error:", err);
    res.status(500).json({ error: "Twitter proxy failed", details: err.message });
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
