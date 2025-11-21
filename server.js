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
app.use(cors({ origin: process.env.FRONTEND_URL }));

const upload = multer({ dest: "uploads/" });

// --------------------------- GOOGLE OAUTH ------------------------------

const oauthClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

let TOKENS = {
  access: "",
  refresh: ""
};

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

app.get("/google/callback", async (req, res) => {
  try {
    const { code } = req.query;

    const { tokens } = await oauthClient.getToken(code);

    TOKENS.access = tokens.access_token;
    TOKENS.refresh = tokens.refresh_token;

    res.send("Login successful. You may close this tab.");
  } catch (e) {
    res.status(500).send("OAuth failed: " + e.message);
  }
});

async function getAccessToken() {
  if (!TOKENS.refresh) throw new Error("User has not logged in");

  const { credentials } = await oauthClient.refreshToken(TOKENS.refresh);
  TOKENS.access = credentials.access_token;

  return TOKENS.access;
}

// --------------------------- YOUTUBE UPLOAD ------------------------------

app.post("/upload-video", upload.single("video"), async (req, res) => {
  try {
    const accessToken = await getAccessToken();

    const { title, description, privacyStatus } = req.body;
    const videoPath = req.file.path;

    const metadata = {
      snippet: { title, description },
      status: { privacyStatus }
    };

    // STEP 1: INIT
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

    // STEP 2: UPLOAD RAW VIDEO
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

// --------------------------- GOOGLE ADS METRICS ------------------------------

app.get("/googleads-metrics", async (req, res) => {
  try {
    const accessToken = await getAccessToken();

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

// --------------------------- START SERVER ------------------------------

app.listen(process.env.PORT || 5000, () => {
  console.log("Server running...");
});
