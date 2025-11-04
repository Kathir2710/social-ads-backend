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
app.use("/uploads", express.static("uploads"));
app.use("/api/snapchat", snapchatMetrics); // ✅ Snapchat route

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

// ✅ YouTube proxy
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


// ✅ Upload video via resumable upload
app.post("/upload-video", upload.single("video"), async (req, res) => {
  const { title, description, privacyStatus } = req.body;
  const accessToken = req.headers.authorization?.replace("Bearer ", "");

  if (!accessToken) return res.status(401).json({ error: "Missing access token" });

  try {
    const videoPath = path.resolve(req.file.path);

    // Step 1: Initiate resumable upload
    const initRes = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/*",
      },
      body: JSON.stringify({
        snippet: { title, description },
        status: { privacyStatus: privacyStatus || "private" },
      }),
    });

    if (!initRes.ok) {
      const errText = await initRes.text();
      throw new Error("Failed to initiate upload: " + errText);
    }

    const uploadUrl = initRes.headers.get("location");

    // Step 2: Upload video file
    const videoStream = fs.createReadStream(videoPath);
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Length": fs.statSync(videoPath).size },
      body: videoStream,
    });

    const uploadData = await uploadRes.json();
    fs.unlinkSync(videoPath); // clean temp file
    res.json({ message: "✅ Video uploaded successfully", data: uploadData });
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ error: "Upload failed", details: err.message });
  }
});




// ✅ Single server listener
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));































// // backend/server.js
// import express from "express";
// import cors from "cors";
// import multer from "multer";
// import fetch from "node-fetch";
// import dotenv from "dotenv";
// import path from "path";
// import fs from "fs";

// dotenv.config();
// const app = express();
// const express = require('express');
// const PORT = process.env.PORT || 5000;
// const snapchatMetrics = require('./snapchatMetrics');

// app.use(
//   cors({
//     origin: "https://data-add-management.netlify.app",  // your Netlify frontend
//     methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//     credentials: true,
//   })
// );

// app.use(express.json());
// app.use("/uploads", express.static("uploads"));
// app.use('/api/snapchat', snapchatMetrics); 

// // Storage setup
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const dir = "uploads/";
//     if (!fs.existsSync(dir)) fs.mkdirSync(dir);
//     cb(null, dir);
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + "_" + file.originalname);
//   },
// });
// const upload = multer({ storage });

// // ---- Upload Route ----
// app.post("/api/upload", upload.single("adFile"), (req, res) => {
//   if (!req.file) return res.status(400).json({ error: "No file uploaded" });
//   const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
//   res.json({ message: "File uploaded successfully", url: fileUrl });
// });


// // ---- Twitter Proxy ----
// app.all("/twitter/*", async (req, res) => {
//   try {
//     const endpoint = req.params[0];
//     const method = req.method;
//     const bearer = process.env.TWITTER_BEARER;
//     const url = `https://api.twitter.com/2/${endpoint}`;
//     const options = {
//       method,
//       headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
//     };
//     if (["POST", "PUT"].includes(method)) options.body = JSON.stringify(req.body);

//     const response = await fetch(url, options);
//     const data = await response.json();
//     res.json(data);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Twitter proxy failed" });
//   }
// });

// // ---- YouTube Proxy (for analytics / uploads) ----
// app.all("/youtube/*", async (req, res) => {
//   try {
//     const endpoint = req.params[0];
//     const method = req.method;
//     const token = req.headers.authorization?.replace("Bearer ", "");
//     const url = `https://www.googleapis.com/youtube/v3/${endpoint}`;

//     const response = await fetch(url, {
//       method,
//       headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//       body: method === "POST" ? JSON.stringify(req.body) : undefined,
//     });
//     const data = await response.json();
//     res.json(data);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "YouTube proxy failed" });
//   }
// });

// app.listen(PORT, () => {
//   console.log(`Backend listening on port ${PORT}`);
// });

// // function createOAuthClient() {
// //   // We don't need to set client_id/secret for using existing access_token in googleapis,
// //   // but set them if you prefer using refresh tokens server-side.
// //   const o = new google.auth.OAuth2(process.env.YT_GOOGLE_CLIENT_ID, process.env.YT_GOOGLE_CLIENT_SECRET);
// //   return o;
// // }

// // /**
// //  * POST /api/yt/upload
// //  * FormData fields:
// //  *  - adFile (file)
// //  *  - title (string)
// //  *  - description (string)
// //  *  - accessToken (string)  <-- OAuth access token obtained in browser
// //  */
// // app.post("/api/yt/upload", upload.single("adFile"), async (req, res) => {
// //   try {
// //     if (!req.file) return res.status(400).json({ error: "No file uploaded" });
// //     const { title = "Ad video", description = "" } = req.body;
// //     const accessToken = req.body.accessToken || req.headers.authorization?.split(" ")[1];
// //     if (!accessToken) {
// //       // Delete uploaded file
// //       try { fs.unlinkSync(req.file.path); } catch(e){}
// //       return res.status(400).json({ error: "Missing accessToken (send in form field 'accessToken' or Authorization header)" });
// //     }

// //     // Create OAuth2 client and set credentials with token from frontend
// //     const oauth2Client = createOAuthClient();
// //     oauth2Client.setCredentials({ access_token: accessToken });

// //     const youtube = google.youtube({ version: "v3", auth: oauth2Client });

// //     // Insert video (resumable upload handled by googleapis)
// //     const fileSize = fs.statSync(req.file.path).size;
// //     const insertRes = await youtube.videos.insert({
// //       part: ["snippet","status"],
// //       requestBody: {
// //         snippet: { title, description },
// //         status: { privacyStatus: "unlisted" } // change to 'private' or 'public' if you want
// //       },
// //       media: {
// //         body: fs.createReadStream(req.file.path)
// //       }
// //     }, {
// //       // optional: onUploadProgress
// //       onUploadProgress: evt => {
// //         const pct = (evt.bytesRead / fileSize) * 100;
// //         process.stdout.write(`Upload progress: ${pct.toFixed(2)}%\r`);
// //       }
// //     });

// //     // cleanup local file
// //     try { fs.unlinkSync(req.file.path); } catch(e){ console.warn("cleanup failed", e); }

// //     const videoId = insertRes.data.id;
// //     const videoUrl = `https://youtu.be/${videoId}`;
// //     return res.json({ ok: true, videoId, videoUrl, raw: insertRes.data });
// //   } catch (err) {
// //     console.error("YT upload error:", err);
// //     return res.status(500).json({ error: "YouTube upload failed", details: err.message || err });
// //   }
// // });

// // /**
// //  * GET /api/yt/videos
// //  * Query or header:
// //  *  - access_token (query param) OR Authorization: Bearer <token>
// //  *
// //  * Returns recent uploads for the authenticated channel (title, id, publish date)
// //  */
// // app.get("/api/yt/videos", async (req, res) => {
// //   try {
// //     const accessToken = req.query.access_token || req.headers.authorization?.split(" ")[1];
// //     if (!accessToken) return res.status(400).json({ error: "Missing access token" });

// //     const oauth2Client = createOAuthClient();
// //     oauth2Client.setCredentials({ access_token: accessToken });
// //     const youtube = google.youtube({ version: "v3", auth: oauth2Client });

// //     // 1) get the channel's uploads playlist id
// //     const ch = await youtube.channels.list({ part: ["contentDetails","snippet"], mine: true });
// //     if (!ch.data.items || ch.data.items.length === 0) return res.json({ items: [] });

// //     const uploadsPlaylistId = ch.data.items[0].contentDetails?.relatedPlaylists?.uploads;
// //     if (!uploadsPlaylistId) return res.json({ items: [] });

// //     // 2) list playlist items (videos)
// //     const pl = await youtube.playlistItems.list({
// //       part: ["snippet","contentDetails"],
// //       playlistId: uploadsPlaylistId,
// //       maxResults: 50
// //     });

// //     const items = (pl.data.items || []).map(it => ({
// //       videoId: it.contentDetails.videoId,
// //       title: it.snippet.title,
// //       publishedAt: it.contentDetails.videoPublishedAt || it.snippet.publishedAt,
// //       thumbnail: it.snippet.thumbnails?.high?.url || it.snippet.thumbnails?.default?.url
// //     }));
// //     return res.json({ items });
// //   } catch (err) {
// //     console.error("YT videos list error:", err);
// //     return res.status(500).json({ error: "Failed to list videos", details: err.message || err });
// //   }
// // });

// // /**
// //  * GET /api/yt/metrics?videoId=VIDEO_ID&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// //  * Header Authorization: Bearer <access_token> or provide access_token query param
// //  *
// //  * Returns YouTube Analytics metrics for the specified video over the date range.
// //  */
// // app.get("/api/yt/metrics", async (req, res) => {
// //   try {
// //     const { videoId, startDate, endDate } = req.query;
// //     const accessToken = req.query.access_token || req.headers.authorization?.split(" ")[1];
// //     if (!accessToken) return res.status(400).json({ error: "Missing access token" });
// //     if (!videoId) return res.status(400).json({ error: "Missing videoId query param" });

// //     const oauth2Client = createOAuthClient();
// //     oauth2Client.setCredentials({ access_token: accessToken });

// //     const youtubeAnalytics = google.youtubeAnalytics({ version: "v2", auth: oauth2Client });

// //     // default date range = last 7 days
// //     const end = endDate || new Date().toISOString().split("T")[0];
// //     const start = startDate || new Date(Date.now() - 7*24*60*60*1000).toISOString().split("T")[0];

// //     // metrics: views, estimatedMinutesWatched, averageViewDuration, likes, shares, comments
// //     const metrics = "views,estimatedMinutesWatched,averageViewDuration,likes,comments";
// //     const response = await youtubeAnalytics.reports.query({
// //       ids: "channel==MINE",
// //       startDate: start,
// //       endDate: end,
// //       metrics,
// //       dimensions: "day",         // get daily metrics; change to 'video' if you want per-video across range
// //       filters: `video==${videoId}`,
// //       maxResults: 1000
// //     });

// //     return res.json({ ok: true, request: { start, end, videoId, metrics }, data: response.data });
// //   } catch (err) {
// //     console.error("YT analytics error:", err);
// //     return res.status(500).json({ error: "Failed to fetch analytics", details: err.message || err });
// //   }
// // });

// // app.listen(PORT, () => console.log(`✅ YT backend listening on port ${PORT}`));

// app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
