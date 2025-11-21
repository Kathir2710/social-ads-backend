import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import { OAuth2Client } from "google-auth-library";
console.log("BACKEND REDIRECT_URI =", process.env.REDIRECT_URI);


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
    redirect_uri: process.env.REDIRECT_URI,   // <-- REQUIRED
    scope: [
      "https://www.googleapis.com/auth/adwords",
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly"
    ],
    
  });
  console.log("LOGIN REDIRECT =", process.env.REDIRECT_URI);
  res.redirect(url);
});

app.get("/google/callback", async (req, res) => {
  try {
    const code = req.query.code;
    console.log("Callback received code:", code);

    if (!code) {
      return res.status(400).send("No OAuth code received.");
    }

    const { tokens } = await oauthClient.getToken({
      code,
      redirect_uri: process.env.REDIRECT_URI
    });

    TOKENS.access = tokens.access_token;
    TOKENS.refresh = tokens.refresh_token;

    console.log("Tokens saved successfully");

    // REDIRECT BACK TO FRONTEND DASHBOARD
    return res.redirect(process.env.FRONTEND_URL + "/?loggedIn=true");

  } catch (error) {
    console.error("OAuth Error:", error);
    return res.status(500).send("OAuth failed: " + error.message);
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
