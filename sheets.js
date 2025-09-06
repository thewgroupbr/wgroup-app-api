// sheets.js
const { google } = require("googleapis");

async function getSheetsClient() {
  const keyFile = process.env.GOOGLE_SA_KEY_FILE;
  const sheetId = process.env.SHEET_ID;
  if (!keyFile || !sheetId) {
    throw new Error("Missing GOOGLE_SA_KEY_FILE or SHEET_ID env vars");
  }

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });
  return { sheets, sheetId };
}

async function readRange(a1) {
  const { sheets, sheetId } = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: a1,
  });
  return res.data.values || [];
}

function rowsByHeader(rows) {
  if (!rows.length) return [];
  const [header, ...data] = rows;
  return data.map((r) =>
    Object.fromEntries(header.map((h, i) => [String(h).trim(), r[i] ?? ""]))
  );
}

function sum30d(rows, dateField, filters) {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  return rows.reduce((acc, r) => {
    const ok = Object.entries(filters || {}).every(([k, v]) => String(r[k]) === String(v));
    if (!ok) return acc;
    const d = new Date(r[dateField]);
    if (Number.isNaN(d.getTime()) || d < since) return acc;
    acc.push(r);
    return acc;
  }, []);
}

// Public API (used by routes)
async function getListing(mls_id) {
  const rows = rowsByHeader(await readRange("Listings!A1:I100000"));
  return rows.find((r) => String(r.mls_id) === String(mls_id)) || null;
}

async function getMetrics30d(mls_id) {
  const rows = rowsByHeader(await readRange("Metrics_Daily!A1:D100000"));
  const last30 = sum30d(rows, "date", { mls_id });
  const page_views_30d = last30.reduce((n, r) => n + Number(r.page_views || 0), 0);
  const unique_users_30d = last30.reduce((n, r) => n + Number(r.unique_users || 0), 0);
  return { page_views_30d, unique_users_30d };
}

async function getShowings30d(mls_id) {
  const rows = rowsByHeader(await readRange("Showings_Daily!A1:D100000"));
  const last30 = sum30d(rows, "date", { mls_id });
  const scheduled_30d = last30.reduce((n, r) => n + Number(r.scheduled || 0), 0);
  const completed_30d = last30.reduce((n, r) => n + Number(r.completed || 0), 0);
  return { scheduled_30d, completed_30d };
}

async function getFeedback(mls_id, limit = 10) {
  const rows = rowsByHeader(await readRange("Feedback!A1:D100000"))
    .filter((r) => String(r.mls_id) === String(mls_id))
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
    .slice(0, limit);
  return rows;
}

async function getAds30d(mls_id) {
  try {
    const rows = rowsByHeader(await readRange("Ads_Daily!A1:F100000"));
    const last30 = sum30d(rows, "date", { mls_id });
    const impressions_30d = last30.reduce((n, r) => n + Number(r.impressions || 0), 0);
    const clicks_30d = last30.reduce((n, r) => n + Number(r.clicks || 0), 0);
    const cost_30d_usd = Number(
      last30.reduce((n, r) => n + Number(r.cost_usd || 0), 0).toFixed(2)
    );
    const cpc_30d_usd = clicks_30d > 0 ? Number((cost_30d_usd / clicks_30d).toFixed(2)) : null;
    return { impressions_30d, clicks_30d, cost_30d_usd, cpc_30d_usd };
  } catch {
    // If Ads_Daily tab doesn't exist yet, return zeros
    return { impressions_30d: 0, clicks_30d: 0, cost_30d_usd: 0, cpc_30d_usd: null };
  }
}

module.exports = {
  readRange,
  getListing,
  getMetrics30d,
  getShowings30d,
  getFeedback,
  getAds30d,
};
