import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import path from "path";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ dest: "uploads/" });

const PORT = process.env.PORT || 5000;

// ====== UPLOAD VIDEO TO YOUTUBE ======
app.post("/upload-video", upload.single("video"), async (req, res) => {
  try {
    const { title, description, privacyStatus } = req.body;
    const accessToken = req.headers.authorization?.split(" ")[1];
    const videoPath = req.file.path;

    const metadata = {
      snippet: { title, description },
      status: { privacyStatus },
    };

    const response = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!response.ok) {
      return res.status(400).json({ error: "Failed to create upload session" });
    }

    const uploadUrl = response.headers.get("location");
    const videoData = fs.readFileSync(videoPath);

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": videoData.length,
        "Content-Type": "video/*",
      },
      body: videoData,
    });

    fs.unlinkSync(videoPath);
    const result = await uploadRes.json();
    res.json({ success: true, videoId: result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ====== FETCH YOUTUBE ORGANIC METRICS ======
app.post("/youtube-metrics", async (req, res) => {
  try {
    const { accessToken, videoId } = req.body;
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== FETCH GOOGLE ADS METRICS (REACH, CTR, etc.) ======
app.post("/googleads-metrics", async (req, res) => {
  try {
    const { accessToken } = req.body;
    const developerToken = process.env.YOUR_GOOGLE_ADS_DEVELOPER_TOKEN;
    const customerId = process.env.YOUR_AD_ACCOUNT_ID;

    const query = `
      SELECT
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_micros
      FROM campaign
      WHERE segments.date DURING LAST_7_DAYS
    `;

    const response = await fetch(
      `https://googleads.googleapis.com/v15/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": developerToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      }
    );

    const text = await response.text(); // 👈 log raw response
    console.log("Google Ads raw response:", text);
    const data = JSON.parse(text);
    res.json(data);
  } catch (err) {
    console.error("Google Ads Metrics Error:", err);
    res.status(500).json({ error: err.message });
  }
});


app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
