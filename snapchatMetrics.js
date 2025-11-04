// snapchatMetrics.js
const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// Replace these with your actual values
const SNAPCHAT_API_BASE = 'https://adsapi.snapchat.com/v1';
const ACCESS_TOKEN = process.env.SNAPCHAT_ACCESS_TOKEN;  // use env var

// Helper to get stats for a campaign/ad account
async function getSnapchatStats({ accountId, campaignId, startTime, endTime, granularity, breakdowns }) {
  const url = `${SNAPCHAT_API_BASE}/ad_accounts/${accountId}/stats`;
  const body = {
    start_time: startTime,
    end_time: endTime,
    granularity: granularity || 'DAY',
    fields: [
      'impressions',
      'swipe_ups',
      'spend',
      'video_views',
      'total_installs'
      // add fields like clicks, likes if available in your account
    ],
    filters: {
      campaign_id: campaignId
    },
    breakdowns: breakdowns || []  // e.g., ['age_range','region']
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Snapchat API error: ${JSON.stringify(data)}`);
  return data;
}

// Route endpoint
router.get('/metrics', async (req, res) => {
  try {
    const { accountId, campaignId, startTime, endTime, breakdowns } = req.query;
    if (!accountId || !campaignId || !startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required query parameters' });
    }
    const stats = await getSnapchatStats({
      accountId,
      campaignId,
      startTime,
      endTime,
      granularity: 'DAY',
      breakdowns: breakdowns ? breakdowns.split(',') : []
    });
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
