(function () {
  if (window.__SLV_PO_PATCH__) return;
  window.__SLV_PO_PATCH__ = true;

  var rawFetch = window.fetch.bind(window);
  var RawWS = window.WebSocket;
  var lastPairHint = '';

  function apiBase() {
    try {
      if (typeof SERVER_URL === 'string' && SERVER_URL) return String(SERVER_URL).replace(/\/$/, '');
    } catch (e) {}
    return '';
  }

  function api(path) {
    return apiBase() + path;
  }

  function tfFromInterval(iv) {
    var s = String(iv || '1m');
    if (s === '3m') return 3;
    if (s === '5m') return 5;
    if (s === '15m') return 15;
    return 1;
  }

  function binanceToPair(symbol) {
    var map = {
      BTCUSDT: 'Bitcoin OTC', ETHUSDT: 'Ethereum OTC', SOLUSDT: 'Solana OTC',
      LTCUSDT: 'Litecoin OTC', DOGEUSDT: 'Dogecoin OTC', ADAUSDT: 'Cardano OTC',
      MATICUSDT: 'Polygon OTC', AVAXUSDT: 'Avalanche OTC', DOTUSDT: 'Polkadot OTC',
      LINKUSDT: 'Chainlink OTC', TONUSDT: 'Toncoin OTC', TRXUSDT: 'TRON OTC',
      BNBUSDT: 'BNB OTC', DASHUSDT: 'Dash', BCHUSDT: 'Bitcoin OTC'
    };
    return map[String(symbol || '').toUpperCase()] || lastPairHint || 'EUR/USD OTC';
  }

  function yahooToPair(symbol) {
    var s = decodeURIComponent(String(symbol || ''));
    var map = {
      'EURUSD=X': 'EUR/USD OTC', 'GBPUSD=X': 'GBP/USD OTC', 'USDJPY=X': 'USD/JPY OTC',
      'USDCHF=X': 'USD/CHF OTC', 'USDCAD=X': 'USD/CAD OTC', 'AUDUSD=X': 'AUD/USD OTC',
      'NZDUSD=X': 'NZD/USD OTC', 'EURGBP=X': 'EUR/GBP OTC', 'EURJPY=X': 'EUR/JPY OTC',
      'GBPJPY=X': 'GBP/JPY OTC', 'AUDJPY=X': 'AUD/JPY OTC', 'EURAUD=X': 'EUR/AUD',
      'EURCAD=X': 'EUR/CAD', 'EURCHF=X': 'EUR/CHF OTC', 'GBPAUD=X': 'GBP/AUD OTC',
      'GBPCHF=X': 'GBP/CHF', 'CADJPY=X': 'CAD/JPY OTC', 'CHFJPY=X': 'CHF/JPY OTC',
      'AUDCAD=X': 'AUD/CAD OTC', 'AUDCHF=X': 'AUD/CHF OTC', 'AUDNZD=X': 'AUD/NZD OTC',
      'NZDJPY=X': 'NZD/JPY OTC', 'GC=F': 'Gold OTC', 'SI=F': 'Silver OTC',
      'BZ=F': 'Brent Oil OTC', 'CL=F': 'WTI Crude Oil OTC', 'NG=F': 'Natural Gas OTC',
      AAPL: 'Apple OTC', TSLA: 'Tesla OTC', MSFT: 'Microsoft OTC', AMZN: 'Amazon OTC',
      NFLX: 'Netflix OTC', INTC: 'Intel OTC', CSCO: 'Cisco OTC', V: 'VISA OTC',
      META: 'FACEBOOK INC OTC', BABA: 'Alibaba OTC', BA: 'Boeing Company OTC',
      MCD: "McDonald's OTC", JNJ: 'Johnson & Johnson OTC', AXP: 'American Express OTC',
      JPM: 'JPMorgan Chase & Co', C: 'Citigroup Inc OTC', XOM: 'ExxonMobil OTC',
      PFE: 'Pfizer Inc OTC', AMD: 'Advanced Micro Devices OTC', COIN: 'Coinbase Global OTC',
      PLTR: 'Palantir Technologies OTC', GME: 'GameStop Corp OTC',
      '^IXIC': 'US100 OTC', '^GSPC': 'SP500 OTC', '^DJI': 'DJI30 OTC', '^N225': 'JPN225 OTC'
    };
    if (map[s]) return map[s];
    if (/^[A-Z]{6}=X$/.test(s)) return s.slice(0, 3) + '/' + s.slice(3, 6) + ' OTC';
    return lastPairHint || s;
  }

  function jsonResponse(obj) {
    return new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  async function loadPoCandles(pair, tf) {
    var period = Math.max(60, Number(tf || 1) * 60);
    var res = await rawFetch(api('/api/candles?pair=' + encodeURIComponent(pair) + '&period=' + period), { cache: 'no-store' });
    var data = await res.json();
    var rows = (data && data.candles) || [];
    if (!rows.length) throw new Error('empty po candles');
    return { data: data, rows: rows };
  }

  function toBinanceKlines(rows) {
    return rows.map(function (c) {
      var t = c.t || (c.time ? c.time * 1000 : 0);
      return [t, String(c.open), String(c.high), String(c.low), String(c.close), '0', t + 60000, '0', 0, '0', '0', '0'];
    });
  }

  function toYahooChart(rows, symbol) {
    return {
      chart: {
        result: [{
          meta: { symbol: symbol },
          timestamp: rows.map(function (c) { return Math.floor((c.t || (c.time * 1000)) / 1000); }),
          indicators: {
            quote: [{
              open: rows.map(function (c) { return +c.open; }),
              high: rows.map(function (c) { return +c.high; }),
              low: rows.map(function (c) { return +c.low; }),
              close: rows.map(function (c) { return +c.close; }),
              volume: rows.map(function () { return 0; })
            }]
          }
        }],
        error: null
      }
    };
  }

  window.fetch = function (input, init) {
    var url = '';
    try { url = typeof input === 'string' ? input : (input && input.url) || ''; } catch (e) { url = String(input || ''); }
    if (/api\.binance\.com\/api\/v3\/klines/.test(url)) {
      return (async function () {
        var u = new URL(url, location.origin);
        var pair = binanceToPair(u.searchParams.get('symbol'));
        var tf = tfFromInterval(u.searchParams.get('interval'));
        var pack = await loadPoCandles(pair, tf);
        return jsonResponse(toBinanceKlines(pack.rows));
      })();
    }
    if (/query1\.finance\.yahoo\.com\/v8\/finance\/chart\//.test(url)) {
      return (async function () {
        var m = url.match(/chart\/([^?]+)/);
        var symbol = m ? decodeURIComponent(m[1]) : 'EURUSD=X';
        var u = new URL(url, location.origin);
        var pair = yahooToPair(symbol);
        var tf = tfFromInterval(u.searchParams.get('interval'));
        var pack = await loadPoCandles(pair, tf);
        return jsonResponse(toYahooChart(pack.rows, symbol));
      })();
    }
    return rawFetch(input, init);
  };

  function FakePOSocket(pair, tf) {
    this.readyState = 1;
    this.onmessage = null;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    var self = this;
    this._timer = setInterval(async function () {
      try {
        var pack = await loadPoCandles(pair, tf);
        var last = pack.rows[pack.rows.length - 1];
        if (!last || typeof self.onmessage !== 'function') return;
        self.onmessage({
          data: JSON.stringify({
            k: {
              t: last.t || Date.now(),
              o: String(last.open),
              h: String(last.high),
              l: String(last.low),
              c: String(last.close),
              x: false
            }
          })
        });
      } catch (e) {}
    }, 2000);
    setTimeout(function () { if (typeof self.onopen === 'function') self.onopen(); }, 0);
  }
  FakePOSocket.prototype.close = function () {
    if (this._timer) clearInterval(this._timer);
    this.readyState = 3;
  };
  FakePOSocket.prototype.send = function () {};

  window.WebSocket = function (url, protocols) {
    var href = String(url || '');
    if (/stream\.binance\.com/.test(href)) {
      var m = href.match(/\/ws\/([a-z0-9]+)@kline_([0-9]+[mh])/i);
      var symbol = m ? m[1].toUpperCase() : 'BTCUSDT';
      var iv = m ? m[2] : '1m';
      return new FakePOSocket(binanceToPair(symbol), tfFromInterval(iv));
    }
    return protocols !== undefined ? new RawWS(url, protocols) : new RawWS(url);
  };
  window.WebSocket.OPEN = 1;
  window.WebSocket.CLOSED = 3;
  window.WebSocket.CONNECTING = 0;
  window.WebSocket.CLOSING = 2;

  document.addEventListener('click', function (ev) {
    var node = ev.target;
    for (var i = 0; i < 6 && node; i++) {
      var txt = (node.innerText || node.textContent || '').trim();
      if (txt && txt.length < 42 && /(OTC|USD|EUR|GBP|BTC|Gold|Apple|Tesla)/i.test(txt)) {
        lastPairHint = txt.split('\n')[0].trim();
        break;
      }
      node = node.parentElement;
    }
  }, true);

  function markStatus(text) {
    var el = document.getElementById('radar-status-text');
    if (el && text) el.innerText = text;
  }

  var tries = 0;
  var hook = setInterval(function () {
    tries += 1;
    if (typeof window.launchFullscreenAnalysis === 'function' && !window.launchFullscreenAnalysis.__poWrapped) {
      var orig = window.launchFullscreenAnalysis;
      window.launchFullscreenAnalysis = function (pairName) {
        lastPairHint = pairName;
        markStatus('POCKET OPTION • ЖИВОЙ ПОТОК');
        return orig.apply(this, arguments);
      };
      window.launchFullscreenAnalysis.__poWrapped = true;
    }
    if (typeof window.startScan === 'function' && !window.startScan.__poWrapped) {
      var origScan = window.startScan;
      window.startScan = function (pair) {
        lastPairHint = pair;
        return origScan.apply(this, arguments);
      };
      window.startScan.__poWrapped = true;
    }
    if (tries > 40) clearInterval(hook);
  }, 250);

  rawFetch(api('/api/po/health')).then(function (r) { return r.json(); }).then(function (st) {
    window.__SLV_PO_STATUS__ = st;
    if (st && st.connected) markStatus('POCKET OPTION • LIVE');
  }).catch(function () {});
})();
