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

// Health check — verifies Sheets access & headers (UPDATED: now reads more columns)
router.get("/health/sheets", async (req, res) => {
  try {
    const header = await readRange("Listings!A1:K1"); // UPDATED: A1:K1 to include new columns
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
      // NEW: Add photo_url and mls_url from your Google Sheets columns
      photo_url: L.photo_url || null,
      mls_url: L["Live Listing URL"] || L.live_listing_url || null, // Handle both possible column names
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

// ---------------- DEBUG ROUTES ----------------
function mapRowsByHeader(rows) {
  if (!rows || !rows.length) return [];
  const [header, ...data] = rows;
  return data.map((r) =>
    Object.fromEntries(header.map((h, i) => [String(h).trim(), r[i] ?? ""]))
  );
}
function parseISOorBlank(s) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function withinLastNDays(dateStr, days = 30) {
  const d = parseISOorBlank(dateStr);
  if (!d) return false;
  const since = new Date();
  since.setDate(since.getDate() - days);
  return d >= since;
}

// List ALL listings rows (UPDATED: now reads more columns)
router.get("/debug/listings", async (_req, res) => {
  try {
    const rows = mapRowsByHeader(await readRange("Listings!A1:K100000")); // UPDATED: A1:K100000
    res.json(rows);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// METRICS: all rows for MLS
router.get("/debug/metrics/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const rows = mapRowsByHeader(await readRange("Metrics_Daily!A1:D100000"));
    const matches = rows.filter(r => String(r.mls_id) === String(id));
    res.json(matches);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// METRICS: breakdown of last-30d include/exclude (with reasons)
router.get("/debug/metrics/:id/last30", async (req, res) => {
  try {
    const id = req.params.id;
    const rows = mapRowsByHeader(await readRange("Metrics_Daily!A1:D100000"))
      .filter(r => String(r.mls_id) === String(id));
    const since = new Date(); since.setDate(since.getDate() - 30);
    const included = [];
    const excluded = [];
    for (const r of rows) {
      const d = parseISOorBlank(r.date);
      if (!d) { excluded.push({ row: r, reason: "bad date" }); continue; }
      if (d < since) { excluded.push({ row: r, reason: "older than 30d" }); continue; }
      included.push(r);
    }
    res.json({ since: since.toISOString().slice(0,10), included, excluded });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// SHOWINGS: all rows for MLS
router.get("/debug/showings/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const rows = mapRowsByHeader(await readRange("Showings_Daily!A1:D100000"));
    const matches = rows.filter(r => String(r.mls_id) === String(id));
    res.json(matches);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// SHOWINGS: last-30d breakdown
router.get("/debug/showings/:id/last30", async (req, res) => {
  try {
    const id = req.params.id;
    const rows = mapRowsByHeader(await readRange("Showings_Daily!A1:D100000"))
      .filter(r => String(r.mls_id) === String(id));
    const since = new Date(); since.setDate(since.getDate() - 30);
    const included = [];
    const excluded = [];
    for (const r of rows) {
      const d = parseISOorBlank(r.date);
      if (!d) { excluded.push({ row: r, reason: "bad date" }); continue; }
      if (d < since) { excluded.push({ row: r, reason: "older than 30d" }); continue; }
      included.push(r);
    }
    res.json({ since: since.toISOString().slice(0,10), included, excluded });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ADS: all rows for MLS
router.get("/debug/ads/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const rows = mapRowsByHeader(await readRange("Ads_Daily!A1:F100000"));
    const matches = rows.filter(r => String(r.mls_id) === String(id));
    res.json(matches);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ADS: last-30d breakdown
router.get("/debug/ads/:id/last30", async (req, res) => {
  try {
    const id = req.params.id;
    const rows = mapRowsByHeader(await readRange("Ads_Daily!A1:F100000"))
      .filter(r => String(r.mls_id) === String(id));
    const since = new Date(); since.setDate(since.getDate() - 30);
    const included = [];
    const excluded = [];
    for (const r of rows) {
      const d = parseISOorBlank(r.date);
      if (!d) { excluded.push({ row: r, reason: "bad date" }); continue; }
      if (d < since) { excluded.push({ row: r, reason: "older than 30d" }); continue; }
      included.push(r);
    }
    res.json({ since: since.toISOString().slice(0,10), included, excluded });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// FEEDBACK: all rows for MLS (newest first)
router.get("/debug/feedback/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const rows = mapRowsByHeader(await readRange("Feedback!A1:D100000"))
      .filter(r => String(r.mls_id) === String(id))
      .sort((a,b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

module.exports = router;
