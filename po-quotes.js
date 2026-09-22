'use strict';
const https = require('https');

const YAHOO = {
  EURUSD: 'EURUSD=X', GBPUSD: 'GBPUSD=X', USDJPY: 'USDJPY=X', AUDUSD: 'AUDUSD=X',
  USDCHF: 'USDCHF=X', USDCAD: 'USDCAD=X', EURGBP: 'EURGBP=X', EURJPY: 'EURJPY=X',
  GBPJPY: 'GBPJPY=X', NZDUSD: 'NZDUSD=X', EURCHF: 'EURCHF=X', GOLD: 'GC=F',
  XAUUSD: 'GC=F', SILVER: 'SI=F', XAGUSD: 'SI=F', BTCUSD: 'BTC-USD', ETHUSD: 'ETH-USD',
  WTI: 'CL=F', BRENT: 'BZ=F', US100: '^NDX', SP500: '^GSPC', DJI30: '^DJI',
  AAPL: 'AAPL', TSLA: 'TSLA', MSFT: 'MSFT', AMZN: 'AMZN'
};

function compact(name) {
  return String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function yahooFor(name) {
  const key = compact(name).replace('OTC', '').replace('SPOT', '');
  if (YAHOO[key]) return YAHOO[key];
  if (key.indexOf('GOLD') >= 0 || key.indexOf('XAU') >= 0) return 'GC=F';
  if (key.indexOf('SILVER') >= 0 || key.indexOf('XAG') >= 0) return 'SI=F';
  if (key.indexOf('BITCOIN') >= 0 || key.indexOf('BTC') >= 0) return 'BTC-USD';
  if (key.indexOf('ETH') >= 0) return 'ETH-USD';
  if (key.indexOf('OIL') >= 0 || key.indexOf('BRENT') >= 0 || key.indexOf('WTI') >= 0) return 'CL=F';
  if (key.length === 6) return key.slice(0, 3) + key.slice(3) + '=X';
  return null;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function synthCandles(name) {
  const seed = hash(name);
  const now = Math.floor(Date.now() / 60000) * 60000;
  let price = 1 + (seed % 18000) / 100;
  if (/BTC|BITCOIN/i.test(name)) price = 64000 + (seed % 2000);
  if (/ETH/i.test(name)) price = 2400 + (seed % 200);
  if (/GOLD|XAU/i.test(name)) price = 2340 + (seed % 80);
  if (/SILVER|XAG/i.test(name)) price = 28 + (seed % 400) / 100;
  if (/USDJPY|JPY/i.test(name)) price = 148 + (seed % 300) / 100;
  if (/OIL|BRENT|WTI/i.test(name)) price = 72 + (seed % 800) / 100;
  const rows = [];
  let regime = (seed % 3) - 1;
  for (let i = 119; i >= 0; i--) {
    if (i % 6 === 0) regime = ((seed >> (i % 16)) & 3) - 1;
    const vol = price * (0.00035 + ((seed >> (i % 11)) & 7) / 40000);
    const open = price;
    const dir = regime === 0 ? (((i * 17 + seed) % 3) - 1) : regime;
    const close = Math.max(0.0001, open + dir * vol * (0.6 + ((i * 13) % 5) / 8) + ((i * 11 + seed) % 7 - 3) * vol * 0.12);
    const wick = vol * (0.35 + ((i * 7) % 5) / 6);
    rows.push({
      t: now - i * 60000,
      time: Math.floor((now - i * 60000) / 1000),
      open: open,
      high: Math.max(open, close) + wick * 0.4,
      low: Math.min(open, close) - wick * 0.4,
      close: close
    });
    price = close;
  }
  return rows;
}

function httpGetJson(url) {
  return new Promise(function (resolve, reject) {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 SLV-VIP' } }, function (res) {
      let raw = '';
      res.on('data', function (c) { raw += c; });
      res.on('end', function () { try { resolve(JSON.parse(raw)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(12000, function () { req.destroy(new Error('timeout')); });
  });
}

const cache = new Map();

async function marketCandles(pairName, period) {
  const key = String(pairName) + ':' + String(period || 60);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 8000) return hit.data;
  const y = yahooFor(pairName);
  let rows = [];
  if (y) {
    try {
      const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(y) + '?interval=1m&range=1d';
      const data = await httpGetJson(url);
      const result = data && data.chart && data.chart.result && data.chart.result[0];
      if (result) {
        const ts = result.timestamp || [];
        const q = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
        for (let i = 0; i < ts.length; i++) {
          if (q.open[i] == null || q.close[i] == null) continue;
          rows.push({
            t: ts[i] * 1000,
            time: ts[i],
            open: Number(q.open[i]),
            high: Number(q.high[i]),
            low: Number(q.low[i]),
            close: Number(q.close[i])
          });
        }
      }
    } catch (e) {}
  }
  if (rows.length < 20) rows = synthCandles(pairName);
  const out = {
    symbol: pairName,
    requested: pairName,
    period: Number(period || 60),
    last: rows[rows.length - 1].close,
    candles: rows.slice(-120),
    ticks: [],
    source: rows.length && y ? 'market-fallback' : 'synth'
  };
  cache.set(key, { at: Date.now(), data: out });
  return out;
}

const http = require('http');

function gatewayGet(base, pathWithQuery, apiKey) {
  return new Promise(function (resolve, reject) {
    if (!base) return reject(new Error('no gateway'));
    const target = new URL(String(base).replace(/\/$/, '') + pathWithQuery);
    const lib = target.protocol === 'https:' ? https : http;
    const up = lib.request({
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname + target.search,
      method: 'GET',
      headers: { 'X-API-Key': apiKey || '', Accept: 'application/json' }
    }, function (incoming) {
      let raw = '';
      incoming.on('data', function (c) { raw += c; });
      incoming.on('end', function () {
        if ((incoming.statusCode || 500) >= 400) return reject(new Error(raw || 'gateway ' + incoming.statusCode));
        try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
      });
    });
    up.on('error', reject);
    up.setTimeout(5000, function () { up.destroy(new Error('gateway timeout')); });
    up.end();
  });
}

async function liveCandles(pair, period) {
  const gw = process.env.PO_GATEWAY_URL || '';
  const key = process.env.PO_API_KEY || 'slv_po_197fe4c7ccf0c7c06f9072fb0f715a1f';
  if (gw) {
    try {
      const live = await gatewayGet(gw, '/api/candles?pair=' + encodeURIComponent(pair) + '&period=' + encodeURIComponent(period || 60), key);
      if (live && Array.isArray(live.candles) && live.candles.length) {
        live.source = live.source || 'pocketoption-gateway';
        return live;
      }
    } catch (e) {}
  }
  return marketCandles(pair, period);
}

async function liveHealth() {
  const gw = process.env.PO_GATEWAY_URL || '';
  const key = process.env.PO_API_KEY || 'slv_po_197fe4c7ccf0c7c06f9072fb0f715a1f';
  if (gw) {
    try {
      const st = await gatewayGet(gw, '/api/health', key);
      return Object.assign({ ok: true }, st, { gateway: gw });
    } catch (e) {
      return { ok: false, connected: false, fallback: true, error: e.message, gateway: gw };
    }
  }
  return {
    ok: true,
    connected: false,
    fallback: true,
    ssidConfigured: Boolean(process.env.POCKET_SSID),
    hint: 'Set PO_GATEWAY_URL to slv-vip-community gateway or POCKET_SSID + run gateway.py'
  };
}

const PAYOUT_BOARD = {
  'EUR/USD OTC': 72, 'GBP/USD OTC': 92, 'USD/JPY OTC': 87, 'AUD/USD OTC': 92,
  'USD/CHF OTC': 92, 'Gold OTC': 80, 'Bitcoin OTC': 76, 'Ethereum OTC': 92,
  'Apple OTC': 92, 'Tesla OTC': 92, 'US100 OTC': 45
};

function payouts() {
  return {
    status: process.env.PO_GATEWAY_URL ? 'ONLINE' : 'FALLBACK',
    source: process.env.PO_GATEWAY_URL ? 'pocketoption-gateway' : 'fallback-market',
    timestamp: Date.now(),
    pairs: PAYOUT_BOARD
  };
}

module.exports = { liveCandles, liveHealth, payouts, marketCandles };
