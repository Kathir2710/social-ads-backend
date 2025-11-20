import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import { OAuth2Client } from "google-auth-library";

dotenv.config();
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const upload = multer({ dest: "uploads/" });

// ------------------ GOOGLE OAUTH SETUP ------------------

const oauthClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

let ADS_ACCESS_TOKEN = "";
let ADS_REFRESH_TOKEN = "";

// STEP 1: Redirect user to Google login
app.get("/google/login", (req, res) => {
  const url = oauthClient.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/adwords", 
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly"
    ],
  });
  res.redirect(url);
});

// STEP 2: Google redirects user back here
app.get("/google/callback", async (req, res) => {
  const { code } = req.query;

  const { tokens } = await oauthClient.getToken(code);

  ADS_ACCESS_TOKEN = tokens.access_token;
  ADS_REFRESH_TOKEN = tokens.refresh_token;

  res.send("Google Login Success. You can now fetch metrics.");
});

// Auto-refresh Google Ads token when needed
async function getValidAccessToken() {
  if (!ADS_REFRESH_TOKEN) throw new Error("User not logged in");

  const { credentials } = await oauthClient.refreshToken(ADS_REFRESH_TOKEN);
  ADS_ACCESS_TOKEN = credentials.access_token;

  return ADS_ACCESS_TOKEN;
}

// ------------------ YOUTUBE VIDEO UPLOAD ------------------

app.post("/upload-video", upload.single("video"), async (req, res) => {
  try {
    const accessToken = await getValidAccessToken();

    const { title, description, privacyStatus } = req.body;
    const videoPath = req.file.path;

    const metadata = {
      snippet: { title, description },
      status: { privacyStatus },
    };

    const initRes = await fetch(
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

    const uploadUrl = initRes.headers.get("location");
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
    res.status(500).json({ error: err.message });
  }
});

// ------------------ GOOGLE ADS METRICS ------------------

app.get("/googleads-metrics", async (req, res) => {
  try {
    const accessToken = await getValidAccessToken();

    const query = `
      SELECT
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.cost_micros
      FROM campaign
      WHERE segments.date DURING LAST_7_DAYS
    `;

    const response = await fetch(
      `https://googleads.googleapis.com/v14/customers/${process.env.CUSTOMER_ID}/googleAds:search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": process.env.DEVELOPER_TOKEN,
          "login-customer-id": process.env.MANAGER_ID,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------ SERVER ------------------

app.listen(process.env.PORT || 5000, () => {
  console.log("Server running...");
});
