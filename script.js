const ASSET_CATEGORIES = {
  forex: [
    "AED/CNY OTC","AUD/CHF OTC","AUD/CAD OTC","AUD/JPY","AUD/JPY OTC","AUD/NZD OTC","AUD/USD","AUD/USD OTC",
    "BHD/CNY OTC","CAD/CHF OTC","CAD/JPY","CAD/JPY OTC","CHF/JPY","CHF/JPY OTC","CHF/NOK OTC",
    "EUR/AUD","EUR/CAD","EUR/CHF","EUR/CHF OTC","EUR/GBP","EUR/GBP OTC","EUR/HUF OTC","EUR/JPY","EUR/JPY OTC",
    "EUR/NZD OTC","EUR/TRY OTC","EUR/USD","EUR/USD OTC",
    "GBP/AUD","GBP/AUD OTC","GBP/CHF","GBP/JPY","GBP/JPY OTC","GBP/USD","GBP/USD OTC",
    "JOD/CNY OTC","KES/USD OTC","LBP/USD OTC","MAD/USD OTC","NGN/USD OTC",
    "NZD/JPY OTC","NZD/USD OTC",
    "OMR/CNY OTC","QAR/CNY OTC","SAR/CNY OTC","UAH/USD OTC","YER/USD OTC","ZAR/USD OTC",
    "USD/ARS OTC","USD/BDT OTC","USD/BRL OTC","USD/CAD","USD/CAD OTC","USD/CHF","USD/CHF OTC",
    "USD/CLP OTC","USD/CNH OTC","USD/COP OTC","USD/DZD OTC","USD/EGP OTC","USD/IDR OTC",
    "USD/INR OTC","USD/JPY","USD/JPY OTC","USD/MXN OTC","USD/MYR OTC","USD/PHP OTC",
    "USD/PKR OTC","USD/RUB OTC","USD/SGD OTC","USD/THB OTC","USD/VND OTC"
  ],
  crypto: [
    "Avalanche OTC","Bitcoin ETF OTC","Bitcoin OTC","Polygon OTC","Cardano OTC","BNB OTC",
    "Polkadot OTC","Chainlink OTC","Solana OTC","Litecoin OTC","Toncoin OTC","Dogecoin OTC",
    "TRON OTC","Ethereum OTC","Bitcoin","Ethereum","Dash","BCH/EUR","BCH/GBP","BCH/JPY",
    "BTC/GBP","BTC/JPY","Chainlink"
  ],
  commodities: [
    "Brent Oil OTC","Silver OTC","Gold OTC","Natural Gas OTC","Palladium spot OTC",
    "Platinum spot OTC","WTI Crude Oil OTC","Brent Oil","WTI Crude Oil","XAG/EUR","Silver",
    "XAU/EUR","Gold","Natural Gas","Palladium spot","Platinum spot"
  ],
  stocks: [
    "Cisco OTC","FACEBOOK INC OTC","McDonald's OTC","Microsoft OTC","Advanced Micro Devices OTC",
    "Amazon OTC","Coinbase Global OTC","FedEx OTC","Netflix OTC","VISA OTC","Pfizer Inc OTC",
    "VIX OTC","Palantir Technologies OTC","Alibaba OTC","Apple OTC","Boeing Company OTC",
    "Intel OTC","Johnson & Johnson OTC","American Express OTC","Marathon Digital Holdings OTC",
    "Boeing Company","FACEBOOK INC","Johnson & Johnson","JPMorgan Chase & Co","McDonald's",
    "Microsoft","Tesla","Alibaba","Citigroup Inc","Citigroup Inc OTC","Netflix","Cisco",
    "ExxonMobil","Tesla OTC","ExxonMobil OTC","Intel","GameStop Corp OTC","Apple",
    "American Express","Pfizer Inc"
  ],
  indices: [
    "AUS 200 OTC","100GBP OTC","DJI30 OTC","E35EUR OTC","F40EUR OTC","JPN225 OTC",
    "US100 OTC","SP500 OTC","100GBP","AEX 25","CAC 40","D30/EUR","D30EUR OTC","DJI30",
    "E35EUR","E50/EUR","E50EUR OTC","F40/EUR","HONG KONG 33","JPN225","US100","SMI 20",
    "SP500","AUS 200"
  ]
};

const BOOKS = [
  { title: "Добавьте свои PDF в репозиторий", file: "" }
];

const state = {
  config: { serverUrl: "", supabaseUrl: "", supabaseAnonKey: "", adminTelegramId: "" },
  user: { id: "", name: "Trader", role: "member" },
  category: "forex",
  tf: 1,
  scan: null
};

function $(id) { return document.getElementById(id); }

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  const target = $(id);
  if (target) target.classList.add("active");
  if (id === "scanner") renderPairs();
  if (id === "notes") renderNotes();
  if (id === "calc") calcPlan();
  if (id === "knowledge") renderBooks();
}

function apiUrl(path) {
  const base = (state.config.serverUrl || "").replace(/\/$/, "");
  return base ? base + path : path;
}

async function loadConfig() {
  try {
    const local = await fetch("config.json", { cache: "no-store" }).then((r) => r.json());
    state.config = Object.assign(state.config, local || {});
  } catch {}
  try {
    const pub = await fetch(apiUrl("/api/config-public")).then((r) => r.json());
    state.config = Object.assign(state.config, pub || {});
  } catch {}
}

function tgUser() {
  try {
    return window.Telegram && Telegram.WebApp && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.user;
  } catch {
    return null;
  }
}

async function checkAccess(userId) {
  try {
    const res = await fetch(apiUrl("/api/check-access?userId=" + encodeURIComponent(userId)));
    if (res.ok) return res.json();
  } catch {}
  return { allowed: false };
}

function fillProfile() {
  $("home-name").textContent = state.user.name;
  $("home-id").textContent = state.user.id || "—";
  $("pf-name").textContent = state.user.name;
  $("pf-id").textContent = state.user.id || "—";
  $("pf-role").textContent = state.user.role;
  $("admin-box").style.display = state.user.role === "admin" ? "block" : "none";
}

function openScanner() {
  showScreen("scanner");
  buildScannerTabs();
  renderPairs();
}

function buildScannerTabs() {
  $("tf-tabs").innerHTML = [1, 2, 3, 5, 15].map((m) =>
    `<button class="tab ${state.tf === m ? "on" : ""}" onclick="setTf(${m})">M${m}</button>`
  ).join("");
  const cats = [
    ["forex", "Валюты"],
    ["crypto", "Крипта"],
    ["commodities", "Сырьё"],
    ["stocks", "Акции"],
    ["indices", "Индексы"]
  ];
  $("cat-tabs").innerHTML = cats.map(([id, label]) =>
    `<button class="tab ${state.category === id ? "on" : ""}" onclick="setCat('${id}')">${label}</button>`
  ).join("");
}

function setTf(v) { state.tf = v; buildScannerTabs(); }
function setCat(v) { state.category = v; buildScannerTabs(); renderPairs(); }

function renderPairs() {
  const q = ($("pair-search").value || "").toUpperCase();
  const list = (ASSET_CATEGORIES[state.category] || []).filter((p) => p.toUpperCase().includes(q));
  $("pair-list").innerHTML = list.map((p) =>
    `<div class="pair" onclick='startScan(${JSON.stringify(p)})'><span>${p}</span><em>график</em></div>`
  ).join("");
}
function filterPairs() { renderPairs(); }

function cleanName(pair) {
  return String(pair).replace(/\s+OTC$/i, "").replace(/\s+spot$/i, "").trim();
}

function feedFor(pair) {
  const n = cleanName(pair).toUpperCase();
  const binance = {
    BITCOIN: "BTCUSDT", "BITCOIN ETF": "BTCUSDT", ETHEREUM: "ETHUSDT", SOLANA: "SOLUSDT",
    LITECOIN: "LTCUSDT", DOGECOIN: "DOGEUSDT", CARDANO: "ADAUSDT", POLYGON: "MATICUSDT",
    AVALANCHE: "AVAXUSDT", POLKADOT: "DOTUSDT", CHAINLINK: "LINKUSDT", TONCOIN: "TONUSDT",
    TRON: "TRXUSDT", BNB: "BNBUSDT", DASH: "DASHUSDT"
  };
  if (binance[n]) return { kind: "binance", symbol: binance[n], label: "BINANCE WS" };
  const yahoo = {
    "EUR/USD": "EURUSD=X", "GBP/USD": "GBPUSD=X", "USD/JPY": "USDJPY=X", "USD/CHF": "USDCHF=X",
    "USD/CAD": "USDCAD=X", "AUD/USD": "AUDUSD=X", "NZD/USD": "NZDUSD=X", "EUR/GBP": "EURGBP=X",
    "EUR/JPY": "EURJPY=X", "GBP/JPY": "GBPJPY=X", GOLD: "GC=F", SILVER: "SI=F",
    "BRENT OIL": "BZ=F", "WTI CRUDE OIL": "CL=F", APPLE: "AAPL", TESLA: "TSLA",
    MICROSOFT: "MSFT", AMAZON: "AMZN", US100: "^IXIC", SP500: "^GSPC", DJI30: "^DJI"
  };
  if (yahoo[n]) return { kind: "yahoo", symbol: yahoo[n], label: "MARKET" };
  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(n)) return { kind: "yahoo", symbol: n.replace("/", "") + "=X", label: "FX" };
  return { kind: "yahoo", symbol: "EURUSD=X", label: "FX" };
}

function tfBinance(m) { return m <= 1 ? "1m" : m <= 3 ? "3m" : m <= 5 ? "5m" : "15m"; }
function tfYahoo(m) { return m <= 2 ? "1m" : m <= 5 ? "5m" : "15m"; }

function sma(arr, n) {
  const s = arr.slice(-Math.min(n, arr.length));
  return s.reduce((a, b) => a + b, 0) / (s.length || 1);
}

function rsi(closes, period) {
  period = period || 14;
  if (closes.length < period + 1) return 50;
  let g = 0, l = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) g += d; else l -= d;
  }
  if (l === 0) return 100;
  const rs = (g / period) / (l / period);
  return 100 - 100 / (1 + rs);
}

function patternOf(c) {
  if (!c || c.length < 3) return { name: "Нет данных", bias: 0, note: "Ждём свечи" };
  const a = c[c.length - 2], b = c[c.length - 1];
  const bodyA = Math.abs(a.close - a.open);
  const bodyB = Math.abs(b.close - b.open);
  const rng = Math.max(b.high - b.low, 1e-9);
  const up = b.high - Math.max(b.open, b.close);
  const dn = Math.min(b.open, b.close) - b.low;
  const bullA = a.close >= a.open, bullB = b.close >= b.open;
  if (!bullA && bullB && b.close > a.open && b.open < a.close && bodyB > bodyA * 0.9) {
    return { name: "Бычье поглощение", bias: 2, note: "CALL после закрытия свечи." };
  }
  if (bullA && !bullB && b.close < a.open && b.open > a.close && bodyB > bodyA * 0.9) {
    return { name: "Медвежье поглощение", bias: -2, note: "PUT после закрытия свечи." };
  }
  if (dn > bodyB * 2 && up < bodyB * 0.6) return { name: "Молот", bias: 2, note: "Отскок от поддержки." };
  if (up > bodyB * 2 && dn < bodyB * 0.6) return { name: "Падающая звезда", bias: -2, note: "Отбой от сопротивления." };
  if (bodyB / rng < 0.18) return { name: "Доджи", bias: 0, note: "Пауза, ждём подтверждение." };
  return { name: "Без формации", bias: 0, note: "Смотрим SMA и уровень." };
}

function analyze(c) {
  const closes = c.map((x) => x.close);
  const last = closes[closes.length - 1];
  const sma9 = sma(closes, 9);
  const sma20 = sma(closes, 20);
  const r = rsi(closes, 14);
  const p = patternOf(c);
  const support = Math.min.apply(null, c.slice(-24).map((x) => x.low));
  const resistance = Math.max.apply(null, c.slice(-24).map((x) => x.high));
  let score = 0;
  if (last > sma9) score += 1; else score -= 1;
  if (sma9 > sma20) score += 1; else score -= 1;
  if (r < 32) score += 2; else if (r > 68) score -= 2;
  score += p.bias;
  const isUp = score >= 0;
  const acc = Math.max(54, Math.min(78, 56 + Math.min(3, Math.abs(score)) * 6));
  return { last, sma9, sma20, rsi: r, pattern: p, support, resistance, isUp, acc, score };
}

async function fetchCandles(feed, tf) {
  if (feed.kind === "binance") {
    const res = await fetch("https://api.binance.com/api/v3/klines?symbol=" + feed.symbol + "&interval=" + tfBinance(tf) + "&limit=80");
    const rows = await res.json();
    return rows.map((r) => ({ t: r[0], open: +r[1], high: +r[2], low: +r[3], close: +r[4] }));
  }
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(feed.symbol) + "?interval=" + tfYahoo(tf) + "&range=1d";
  const res = await fetch(url);
  const data = await res.json();
  const result = data.chart.result[0];
  const q = result.indicators.quote[0];
  const out = [];
  (result.timestamp || []).forEach((ts, i) => {
    if (q.close[i] == null) return;
    out.push({ t: ts * 1000, open: +q.open[i], high: +q.high[i], low: +q.low[i], close: +q.close[i] });
  });
  return out.slice(-80);
}

function drawChart(candles, info) {
  const canvas = $("scan-canvas");
  const box = canvas.parentElement;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = box.clientWidth, h = box.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#0e1318";
  ctx.fillRect(0, 0, w, h);
  if (!candles.length) return;
  const padL = 6, padR = 52, padT = 10, padB = 12;
  let max = Math.max.apply(null, candles.map((c) => c.high));
  let min = Math.min.apply(null, candles.map((c) => c.low));
  const span = (max - min) || 1;
  max += span * 0.08; min -= span * 0.08;
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (h - padT - padB);
  const step = (w - padL - padR) / candles.length;
  const cw = Math.max(3, step * 0.62);
  ctx.strokeStyle = "#24303a";
  for (let i = 0; i < 4; i++) {
    const gy = padT + i * ((h - padT - padB) / 3);
    ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
  }
  if (info) {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#3d8bff";
    ctx.beginPath(); ctx.moveTo(padL, y(info.resistance)); ctx.lineTo(w - padR, y(info.resistance)); ctx.stroke();
    ctx.strokeStyle = "#1fd47a";
    ctx.beginPath(); ctx.moveTo(padL, y(info.support)); ctx.lineTo(w - padR, y(info.support)); ctx.stroke();
    ctx.setLineDash([]);
  }
  candles.forEach((c, i) => {
    const x = padL + i * step + (step - cw) / 2;
    const bull = c.close >= c.open;
    ctx.strokeStyle = ctx.fillStyle = bull ? "#1fd47a" : "#ff4d4f";
    ctx.beginPath(); ctx.moveTo(x + cw / 2, y(c.high)); ctx.lineTo(x + cw / 2, y(c.low)); ctx.stroke();
    const top = y(Math.max(c.open, c.close));
    const bot = y(Math.min(c.open, c.close));
    ctx.fillRect(x, top, cw, Math.max(1.4, bot - top));
  });
  const last = candles[candles.length - 1].close;
  ctx.fillStyle = last >= candles[candles.length - 1].open ? "#1fd47a" : "#ff4d4f";
  ctx.fillRect(w - padR + 2, y(last) - 8, padR - 6, 16);
  ctx.fillStyle = "#0b0e12";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(last.toFixed(last > 50 ? 2 : 5), w - padR / 2, y(last) + 3);
}

function paintScan(info) {
  const first = state.scan.first;
  const last = info.last;
  $("scan-price").textContent = last.toFixed(last > 50 ? 2 : 5);
  $("scan-price").className = "price " + (last >= first ? "up" : "down");
  const pct = ((last - first) / first) * 100;
  $("scan-chg").textContent = (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
  $("scan-chg").style.color = pct >= 0 ? "#1fd47a" : "#ff4d4f";
  $("scan-note").textContent = state.scan.feed.label + " · " + info.pattern.name + ". " + info.pattern.note;
  $("scan-verdict").textContent = (info.isUp ? "CALL / LONG" : "PUT / SHORT") + " · " + info.acc + "%";
  $("scan-verdict").className = "verdict " + (info.isUp ? "buy" : "sell");
  $("btn-call").style.opacity = info.isUp ? "1" : ".45";
  $("btn-put").style.opacity = info.isUp ? ".45" : "1";
  $("scan-stats").innerHTML =
    `<div>RSI 14 <b>${info.rsi.toFixed(1)}</b></div>` +
    `<div>SMA 9 <b>${info.sma9.toFixed(last > 50 ? 2 : 5)}</b></div>` +
    `<div>SMA 20 <b>${info.sma20.toFixed(last > 50 ? 2 : 5)}</b></div>` +
    `<div>Support <b>${info.support.toFixed(last > 50 ? 2 : 5)}</b></div>` +
    `<div>Resistance <b>${info.resistance.toFixed(last > 50 ? 2 : 5)}</b></div>`;
}

function stopScan() {
  if (state.scan && state.scan.timer) clearInterval(state.scan.timer);
  if (state.scan && state.scan.ws) try { state.scan.ws.close(); } catch {}
  state.scan = null;
}

async function startScan(pair) {
  stopScan();
  $("scan-stage").classList.add("open");
  $("scan-pair").textContent = pair;
  $("scan-meta").textContent = "M" + state.tf + " · загрузка";
  $("scan-note").textContent = "Загрузка свечей…";
  const feed = feedFor(pair);
  try {
    const candles = await fetchCandles(feed, state.tf);
    if (!candles.length) throw new Error("empty");
    const info = analyze(candles);
    state.scan = { pair, feed, candles, first: candles[0].close, ws: null, timer: null };
    $("scan-meta").textContent = "M" + state.tf + " · " + feed.label;
    drawChart(candles, info);
    paintScan(info);
    if (feed.kind === "binance") {
      const ws = new WebSocket("wss://stream.binance.com:9443/ws/" + feed.symbol.toLowerCase() + "@kline_" + tfBinance(state.tf));
      ws.onmessage = (ev) => {
        if (!state.scan) return;
        const k = JSON.parse(ev.data).k;
        if (!k) return;
        const candle = { t: k.t, open: +k.o, high: +k.h, low: +k.l, close: +k.c };
        const list = state.scan.candles;
        if (list[list.length - 1] && list[list.length - 1].t === candle.t) list[list.length - 1] = candle;
        else { list.push(candle); if (list.length > 80) list.shift(); }
        const next = analyze(list);
        drawChart(list, next);
        paintScan(next);
      };
      state.scan.ws = ws;
    } else {
      state.scan.timer = setInterval(async () => {
        try {
          const fresh = await fetchCandles(feed, state.tf);
          if (!state.scan || !fresh.length) return;
          state.scan.candles = fresh;
          const next = analyze(fresh);
          drawChart(fresh, next);
          paintScan(next);
        } catch {}
      }, 5000);
    }
  } catch (e) {
    $("scan-note").textContent = "Нет котировок по этой паре. Крипта обычно открывается через Binance WS.";
  }
}

function closeScanner() {
  stopScan();
  $("scan-stage").classList.remove("open");
}

function calcPlan() {
  const dep = Number($("c-dep").value || 0);
  const risk = Number($("c-risk").value || 2);
  const pay = Number($("c-pay").value || 85);
  $("c-risk-l").textContent = risk.toFixed(1) + "%";
  $("c-pay-l").textContent = pay + "%";
  const stake = dep * risk / 100;
  $("c-stake").textContent = "$" + stake.toFixed(2);
  $("c-win").textContent = "$" + (stake * pay / 100).toFixed(2);
}

function renderBooks() {
  $("book-list").innerHTML = BOOKS.map((b) =>
    `<div class="card"><b>${b.title}</b>${b.file ? `<div style="margin-top:8px;color:var(--muted);font-size:12px;">${b.file}</div>` : ""}</div>`
  ).join("");
}

function loadNotes() {
  try { return JSON.parse(localStorage.getItem("po_desk_notes") || "[]"); } catch { return []; }
}
function saveNote() {
  const text = $("note-text").value.trim();
  if (!text) return;
  const all = loadNotes();
  all.unshift({ id: Date.now(), text });
  localStorage.setItem("po_desk_notes", JSON.stringify(all));
  $("note-text").value = "";
  renderNotes();
}
function renderNotes() {
  const all = loadNotes();
  $("note-list").innerHTML = all.length
    ? all.map((n) => `<div class="note">${n.text}</div>`).join("")
    : '<div class="card" style="color:var(--muted);">Пусто</div>';
}

async function addUser() {
  const id = $("new-user-id").value.trim();
  if (!id) return;
  await fetch(apiUrl("/api/admin/add-user"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminId: state.user.id, userId: id })
  });
  $("new-user-id").value = "";
  loadAdminList();
}

async function loadAdminList() {
  if (state.user.role !== "admin") return;
  try {
    const res = await fetch(apiUrl("/api/allowed-users?adminId=" + encodeURIComponent(state.user.id)));
    const data = await res.json();
    const allowed = (data.users && data.users.allowed) || [];
    $("user-list").innerHTML = allowed.map((id) => `<div class="row"><span>${id}</span></div>`).join("");
  } catch {}
}

async function boot() {
  if (window.Telegram && Telegram.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
    Telegram.WebApp.setBackgroundColor("#12151a");
    Telegram.WebApp.setHeaderColor("#0e1116");
  }
  await loadConfig();
  const u = tgUser();
  if (u) {
    state.user.id = String(u.id);
    state.user.name = (u.first_name || "Trader") + (u.last_name ? " " + u.last_name : "");
  }
  $("denied-id").textContent = state.user.id || "Откройте в Telegram";
  if (!state.user.id) {
    showScreen("denied");
    return;
  }
  const access = await checkAccess(state.user.id);
  if (!access.allowed) {
    showScreen("denied");
    return;
  }
  state.user.role = access.role || "member";
  fillProfile();
  showScreen("home");
  loadAdminList();
}

window.showScreen = showScreen;
window.openScanner = openScanner;
window.setTf = setTf;
window.setCat = setCat;
window.filterPairs = filterPairs;
window.startScan = startScan;
window.closeScanner = closeScanner;
window.calcPlan = calcPlan;
window.saveNote = saveNote;
window.addUser = addUser;
boot();
