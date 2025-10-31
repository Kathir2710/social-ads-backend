// backend/server.js
import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import querystring from "querystring";

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
const CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const REDIRECT_URI = "https://social-ads-backend.onrender.com/auth/twitter/callback";

// 1️⃣ Redirect user to Twitter login
app.get("/auth/twitter", (req, res) => {
  const params = querystring.stringify({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "tweet.read tweet.write users.read offline.access",
    state: "secure123",
    code_challenge: "challenge",
    code_challenge_method: "plain"
  });
  res.redirect(`https://twitter.com/i/oauth2/authorize?${params}`);
});

// 2️⃣ Callback to exchange code for access_token
app.get("/auth/twitter/callback", async (req, res) => {
  const { code } = req.query;
  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: querystring.stringify({
      client_id: CLIENT_ID,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: "challenge"
    })
  });
  const tokenData = await tokenRes.json();
  console.log("Twitter token data:", tokenData);
  res.json(tokenData);
});

// 3️⃣ Proxy request using user's access_token
app.all("/twitter/:endpoint(*)", async (req, res) => {
  try {
    const { access_token } = req.headers; // Pass from frontend dynamically
    if (!access_token)
      return res.status(401).json({ error: "Missing Twitter user access_token" });

    const endpoint = req.params.endpoint;
    const response = await fetch(`https://api.twitter.com/2/${endpoint}`, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: req.method === "POST" ? JSON.stringify(req.body) : undefined
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
