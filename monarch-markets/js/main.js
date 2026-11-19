const menu = document.querySelector(".menu");
const panel = document.getElementById("menu-panel");
const ticker = document.getElementById("ticker");
const watchlist = document.getElementById("watchlist");
const watchNote = document.getElementById("watch-note");
const chartNote = document.getElementById("chart-note");
const form = document.querySelector("[data-form]");
const status = document.querySelector("[data-form-status]");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const WATCHLIST = ["DANGCEM", "MTNN", "GTCO", "ZENITHBANK", "BUACEMENT", "SEPLAT"];
const REFRESH_MS = 30 * 1000;
const number = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-NG", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const priceFormat = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 2,
});
const dateFormat = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
});

const BASE_QUOTES = [
  { symbol: "DANGCEM", name: "Dangote Cement", price: 680.0, changePct: 1.82 },
  { symbol: "MTNN", name: "MTN Nigeria", price: 215.5, changePct: -0.64 },
  { symbol: "GTCO", name: "Guaranty Trust Holding", price: 54.2, changePct: 0.41 },
  { symbol: "ZENITHBANK", name: "Zenith Bank", price: 46.8, changePct: 1.06 },
  { symbol: "BUACEMENT", name: "BUA Cement", price: 92.1, changePct: -1.1 },
  { symbol: "SEPLAT", name: "Seplat Energy", price: 3450.0, changePct: 2.34 },
];

const BASE_MARKET = {
  asi: 102450.82,
  change: 312.45,
  changePct: 0.31,
  ytdChangePct: 2.84,
  volume: 412000000,
  valueTraded: 8450000000,
  deals: 9842,
  breadth: { advancers: 31, decliners: 17, unchanged: 62 },
};

const byId = (id) => document.getElementById(id);

if (menu && panel) {
  menu.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") === "true";
    menu.setAttribute("aria-expanded", String(!open));
    panel.hidden = open;
  });
  panel.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.setAttribute("aria-expanded", "false");
      panel.hidden = true;
    });
  });
}

document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

function asNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(value) {
  const n = asNumber(value);
  return n === null ? "—" : number.format(n);
}

function formatCompact(value) {
  const n = asNumber(value);
  return n === null ? "—" : compact.format(n);
}

function formatPrice(value) {
  const n = asNumber(value);
  return n === null ? "—" : priceFormat.format(n);
}

function formatPercent(value) {
  const n = asNumber(value);
  if (n === null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function formatSigned(value) {
  const n = asNumber(value);
  if (n === null) return "—";
  return `${n > 0 ? "+" : ""}${number.format(n)}`;
}

function toneFor(value) {
  const n = asNumber(value);
  if (n === null || n === 0) return "";
  return n > 0 ? "up" : "down";
}

function applyTone(el, value) {
  if (!el) return;
  el.classList.remove("up", "down");
  const tone = toneFor(value);
  if (tone) el.classList.add(tone);
}

function jitter(value, spread) {
  return value + (Math.random() - 0.5) * spread;
}

function snapshot() {
  const quotes = BASE_QUOTES.map((quote) => ({
    ...quote,
    price: Math.max(0.01, jitter(quote.price, quote.price * 0.004)),
    changePct: jitter(quote.changePct, 0.12),
  }));

  const market = {
    ...BASE_MARKET,
    asi: jitter(BASE_MARKET.asi, 90),
    change: jitter(BASE_MARKET.change, 25),
    changePct: jitter(BASE_MARKET.changePct, 0.08),
    ytdChangePct: jitter(BASE_MARKET.ytdChangePct, 0.04),
    volume: Math.round(jitter(BASE_MARKET.volume, 9000000)),
    valueTraded: Math.round(jitter(BASE_MARKET.valueTraded, 250000000)),
    deals: Math.round(jitter(BASE_MARKET.deals, 120)),
    breadth: {
      advancers: Math.round(jitter(BASE_MARKET.breadth.advancers, 3)),
      decliners: Math.round(jitter(BASE_MARKET.breadth.decliners, 3)),
      unchanged: Math.round(jitter(BASE_MARKET.breadth.unchanged, 4)),
    },
    asOf: new Date().toISOString(),
  };

  return { quotes, market };
}

function renderTicker(quotes) {
  if (!ticker) return;
  ticker.replaceChildren();

  for (let pass = 0; pass < 2; pass += 1) {
    for (const quote of quotes) {
      const item = document.createElement("span");
      item.append(`${quote.symbol}  `);
      const change = document.createElement("b");
      change.className = toneFor(quote.changePct);
      change.textContent = formatPercent(quote.changePct);
      item.append(change);
      ticker.append(item);
    }
  }
}

function renderWatchlist(quotes) {
  if (!watchlist) return;
  const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
  watchlist.replaceChildren();

  for (const symbol of WATCHLIST) {
    const quote = bySymbol.get(symbol);
    const row = document.createElement("li");
    const name = document.createElement("span");
    const change = document.createElement("span");

    name.textContent = symbol;
    change.className = toneFor(quote && quote.changePct);
    change.textContent = quote ? formatPercent(quote.changePct) : "—";
    if (quote) name.title = `${formatPrice(quote.price)} · ${quote.name}`;

    row.append(name, change);
    watchlist.append(row);
  }
}

function renderBreadth(breadth) {
  const adv = asNumber(breadth && breadth.advancers);
  const dec = asNumber(breadth && breadth.decliners);
  const flat = asNumber(breadth && breadth.unchanged);
  const total = (adv || 0) + (dec || 0) + (flat || 0);

  byId("breadth-adv-count").textContent = adv === null ? "—" : number.format(adv);
  byId("breadth-flat-count").textContent = flat === null ? "—" : number.format(flat);
  byId("breadth-dec-count").textContent = dec === null ? "—" : number.format(dec);

  const advBar = byId("breadth-adv");
  const flatBar = byId("breadth-flat");
  const decBar = byId("breadth-dec");

  if (!total) {
    advBar.style.width = "0";
    flatBar.style.width = "0";
    decBar.style.width = "0";
    return;
  }

  advBar.style.width = `${((adv || 0) / total) * 100}%`;
  flatBar.style.width = `${((flat || 0) / total) * 100}%`;
  decBar.style.width = `${((dec || 0) / total) * 100}%`;
}

function renderMarket(market) {
  const asiValue = byId("asi-value");
  const asiChange = byId("asi-change");

  asiValue.textContent = formatNumber(market.asi);
  asiChange.textContent = `${formatPercent(market.changePct)} today`;
  applyTone(asiChange, market.changePct);
  renderBreadth(market.breadth);
}

function renderStats(market) {
  byId("stat-asi").textContent = formatNumber(market.asi);
  byId("stat-change").textContent =
    `${formatSigned(market.change)} (${formatPercent(market.changePct)})`;
  applyTone(byId("stat-change"), market.changePct);
  byId("stat-ytd").textContent = formatPercent(market.ytdChangePct);
  applyTone(byId("stat-ytd"), market.ytdChangePct);
  byId("stat-volume").textContent = formatCompact(market.volume);
  byId("stat-value").textContent = `₦${formatCompact(market.valueTraded)}`;
  byId("stat-deals").textContent = formatNumber(market.deals);
  byId("stat-adv").textContent = formatNumber(market.breadth.advancers);
  byId("stat-dec").textContent = formatNumber(market.breadth.decliners);
}

function setNotes(market) {
  if (watchNote) watchNote.textContent = "Simulated quotes. Not investment advice.";
  if (chartNote) {
    chartNote.textContent = `Simulated market data · Updated ${dateFormat.format(new Date(market.asOf))}`;
  }
}

function refresh() {
  const { quotes, market } = snapshot();
  renderTicker(quotes);
  renderWatchlist(quotes);
  renderMarket(market);
  renderStats(market);
  setNotes(market);
}

refresh();
window.setInterval(refresh, REFRESH_MS);

const reveals = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window && !reduce) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12 },
  );
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add("is-in"));
}

if (form && status) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    status.textContent = name
      ? `Thanks, ${name}. We will send an invite when a seat opens.`
      : "Thanks. We will send an invite when a seat opens.";
    form.reset();
  });
}
