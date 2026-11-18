const API_BASE = (process.env.NGN_MARKET_BASE_URL || "https://api.ngnmarket.com/v1").replace(/\/$/, "");
const CACHE_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;

let cache = { body: null, expiresAt: 0 };

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rowsFrom(payload) {
  const data = payload && payload.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

function pickQuote(row) {
  const price = toNumber(row.price ?? row.current_price);
  const previousClose = toNumber(row.prev_close ?? row.previous_close);
  const change = toNumber(row.price_change) ?? (
    price !== null && previousClose !== null ? price - previousClose : null
  );

  return {
    symbol: String(row.symbol || "").toUpperCase(),
    name: row.name || row.company_name || null,
    price,
    previousClose,
    change,
    changePct: toNumber(row.price_change_percent),
    volume: toNumber(row.volume),
    marketCap: toNumber(row.market_cap),
    dayHigh: toNumber(row.day_high),
    dayLow: toNumber(row.day_low),
    sector: row.sector || null,
    updatedAt: row.last_updated || null,
  };
}

function pickMarket(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const breadth = snapshot.breadth || {};

  return {
    date: snapshot.date || null,
    asi: toNumber(snapshot.asi),
    change: toNumber(snapshot.asi_change),
    changePct: toNumber(snapshot.asi_change_percent),
    ytdChangePct: toNumber(snapshot.ytd_asi_change_percent),
    deals: toNumber(snapshot.deals),
    volume: toNumber(snapshot.volume),
    valueTraded: toNumber(snapshot.value_traded),
    turnoverRate: toNumber(snapshot.turnover_rate),
    marketCap: snapshot.market_cap || null,
    breadth: {
      advancers: toNumber(breadth.advancers),
      decliners: toNumber(breadth.decliners),
      unchanged: toNumber(breadth.unchanged),
      total: toNumber(breadth.total),
      advDecRatio: toNumber(breadth.adv_dec_ratio),
    },
    totalListedSecurities: toNumber(snapshot.total_listed_securities),
    session: snapshot.session || null,
    updatedAt: snapshot.updated_at || null,
  };
}

async function fetchJson(path, key) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || (payload && payload.success === false)) {
    const message = payload?.error?.message || `NGN Market returned HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload || {};
}

async function loadMarket() {
  const key = process.env.NGN_MARKET_API_KEY;
  if (!key) {
    const error = new Error("Market data is not configured");
    error.status = 503;
    throw error;
  }

  const [companiesResult, snapshotResult] = await Promise.allSettled([
    fetchJson("/companies?limit=200&sort=market_cap&order=desc", key),
    fetchJson("/market/snapshot", key),
  ]);

  if (companiesResult.status === "rejected" && snapshotResult.status === "rejected") {
    throw companiesResult.reason;
  }

  const companiesPayload =
    companiesResult.status === "fulfilled" ? companiesResult.value : null;
  const snapshotPayload =
    snapshotResult.status === "fulfilled" ? snapshotResult.value : null;

  const quotes = rowsFrom(companiesPayload)
    .map(pickQuote)
    .filter((quote) => quote.symbol);

  if (companiesResult.status === "rejected" && quotes.length === 0) {
    throw companiesResult.reason;
  }

  const market = pickMarket(snapshotPayload && snapshotPayload.data);
  const meta =
    (snapshotPayload && snapshotPayload.meta) ||
    (companiesPayload && companiesPayload.meta) ||
    null;

  return {
    source: "NGN Market",
    delayMinutes: 20,
    fetchedAt: new Date().toISOString(),
    asOf: (market && market.updatedAt) || (quotes[0] && quotes[0].updatedAt) || null,
    market,
    quotes,
    quota: meta
      ? {
          plan: meta.plan || null,
          callsUsed: toNumber(meta.calls_used),
          callsRemaining: toNumber(meta.calls_remaining),
          resetAt: meta.reset_at || null,
        }
      : null,
    warning:
      companiesResult.status === "rejected"
        ? "Company quotes are temporarily unavailable."
        : snapshotResult.status === "rejected"
          ? "Market summary is temporarily unavailable."
          : null,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=300");

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const now = Date.now();
  if (cache.body && now < cache.expiresAt) {
    res.status(200).json({ ...cache.body, cached: true });
    return;
  }

  try {
    const body = await loadMarket();
    cache = { body, expiresAt: now + CACHE_MS };
    res.status(200).json({ ...body, cached: false });
  } catch (error) {
    if (cache.body) {
      res.status(200).json({
        ...cache.body,
        cached: true,
        stale: true,
        warning: "Live refresh failed. Showing the last cached snapshot.",
      });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.status(error.status || 502).json({
      error: error.message || "Unable to load market data",
      source: "NGN Market",
      fetchedAt: new Date().toISOString(),
    });
  }
};
