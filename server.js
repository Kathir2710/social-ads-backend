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

// ✅ CORS setup
app.use(
  cors({
    origin: "https://data-add-management.netlify.app", // your Netlify frontend
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ Middleware setup
app.use(express.json());



// ✅ Storage setup
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

// ✅ Upload route
app.post("/api/upload", upload.single("adFile"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ message: "File uploaded successfully", url: fileUrl });
});

// ✅ Twitter proxy
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

// ✅ YouTube proxy// ✅ YouTube proxy
app.all("/youtube/*", async (req, res) => {
  try {
    const endpoint = req.params[0];
    const method = req.method;
    const token = req.headers.authorization?.replace("Bearer ", "");
    const url = `https://www.googleapis.com/youtube/v3/${endpoint}`;

    if (!token) {
      return res.status(401).json({ error: "Missing Bearer token" });
    }

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: method === "POST" ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ YouTube proxy error:", err);
    res.status(500).json({ error: "YouTube proxy failed" });
  }
});


// ✅ Upload video via resumable upload
app.post("/upload-video", upload.single("video"), async (req, res) => {
  const { title, description, privacyStatus } = req.body;
  const accessToken = req.headers.authorization?.replace("Bearer ", "");

  if (!accessToken) {
    return res.status(401).json({ error: "Missing access token" });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" });
    }

    const videoPath = path.resolve(req.file.path);
    const videoSize = fs.statSync(videoPath).size;

    console.log(`📹 Uploading video: ${title} (${(videoSize / 1024 / 1024).toFixed(2)} MB)`);

    // Step 1: Initiate resumable upload
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "video/*",
          "X-Upload-Content-Length": videoSize.toString(),
        },
        body: JSON.stringify({
          snippet: { title, description },
          status: { privacyStatus: privacyStatus || "private" },
        }),
      }
    );

    if (!initRes.ok) {
      const errText = await initRes.text();
      throw new Error("Failed to initiate upload: " + errText);
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) throw new Error("No upload URL received from YouTube API");

    // Step 2: Upload the video file
    const videoStream = fs.createReadStream(videoPath);
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Length": videoSize,
        "Content-Type": "video/*",
      },
      body: videoStream,
    });

    const uploadData = await uploadRes.json();

    // Step 3: Clean up the uploaded file
    fs.unlink(videoPath, (err) => {
      if (err) console.warn("⚠️ Failed to delete temp file:", err);
    });

    res.json({
      message: "✅ Video uploaded successfully",
      data: uploadData,
    });
  } catch (err) {
    console.error("❌ Upload failed:", err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});




// ✅ Single server listener
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));


























