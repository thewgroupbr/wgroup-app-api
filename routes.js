// routes.js
const express = require("express");
const {
  readRange,
  getListing,
  getMetrics30d,
  getShowings30d,
  getFeedback,
  getAds30d,
} = require("./sheets");

const router = express.Router();

// Health check — verifies Sheets access & headers
router.get("/health/sheets", async (req, res) => {
  try {
    const header = await readRange("Listings!A1:I1");
    return res.json({ ok: true, sheetId: process.env.SHEET_ID, header: header[0] || [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// Main seller summary — source: Google Sheet
router.get("/api/listings/:id/summary", async (req, res) => {
  try {
    const id = req.params.id;
    const L = await getListing(id);
    if (!L) return res.status(404).json({ error: "Listing not found in Sheet" });

    const metrics = await getMetrics30d(id);
    const show = await getShowings30d(id);
    const ads = await getAds30d(id);
    const feedback = await getFeedback(id, 10);

    const nowIso = new Date().toISOString();
    const toNum = (v) => (v === "" || v == null ? null : Number(v));

    return res.json({
      listingId: id,
      address: L.address || null,
      status: { value: L.status || "-", source: "Google Sheet", updatedAt: nowIso },
      price: {
        current: toNum(L.list_price),
        original: toNum(L.original_list_price),
        currency: "USD",
        source: "Google Sheet",
        updatedAt: nowIso,
      },
      marketDays: {
        dom: toNum(L.dom),
        cdom: toNum(L.cdom),
        source: "Google Sheet",
        updatedAt: nowIso,
      },
      openHouseNext: {
        start: L.open_house_start || null,
        end: L.open_house_end || null,
        source: "Google Sheet",
        updatedAt: nowIso,
      },
      kpis: [
        { key: "page_views", label: "Listing Views", value: metrics.page_views_30d, period: "30d", source: "Google Sheet" },
        { key: "unique_users", label: "Unique Visitors", value: metrics.unique_users_30d, period: "30d", source: "Google Sheet" },
        { key: "showings_sched", label: "Showings Scheduled", value: show.scheduled_30d, period: "30d", source: "Google Sheet" },
        { key: "showings_completed", label: "Showings Completed", value: show.completed_30d, period: "30d", source: "Google Sheet" },
        { key: "ad_impressions", label: "Ad Impressions", value: ads.impressions_30d, period: "30d", source: "Google Sheet" },
        { key: "ad_clicks", label: "Ad Clicks", value: ads.clicks_30d, period: "30d", source: "Google Sheet" }
      ],
      marketing: { ...ads, source: "Google Sheet" },
      feedback
    });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
});

module.exports = router;
