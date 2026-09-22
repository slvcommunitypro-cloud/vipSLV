require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const poQuotes = require("./po-quotes");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8787);
const ADMIN_ID = String(process.env.ADMIN_TELEGRAM_ID || "").trim();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(path.join(ROOT, file), JSON.stringify(data, null, 2));
}

function loadUsers() {
  const data = readJson("users.json", { allowed: [], admins: [] });
  data.allowed = Array.isArray(data.allowed) ? data.allowed.map(String) : [];
  data.admins = Array.isArray(data.admins) ? data.admins.map(String) : [];
  if (ADMIN_ID && !data.admins.includes(ADMIN_ID)) data.admins.push(ADMIN_ID);
  if (ADMIN_ID && !data.allowed.includes(ADMIN_ID)) data.allowed.push(ADMIN_ID);
  return data;
}

function isAdmin(id) {
  const users = loadUsers();
  return Boolean(id && (id === ADMIN_ID || users.admins.includes(String(id))));
}

function createSupabase() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_KEY || "";
  if (!url || !key) return null;
  try {
    const { createClient } = require("@supabase/supabase-js");
    return createClient(url, key);
  } catch {
    return null;
  }
}

function sendIndex(res) {
  try {
    let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    if (html.indexOf("slv-po-patch.js") === -1) {
      html = html.replace("</body>", '<script src="slv-po-patch.js"></script>\n</body>');
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (e) {
    return res.status(500).send("index.html not found");
  }
}

app.get("/", sendIndex);
app.get("/index.html", sendIndex);

app.get("/api/health", async (_req, res) => {
  const po = await poQuotes.liveHealth().catch(() => ({ connected: false }));
  res.json({
    ok: true,
    supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY),
    adminConfigured: Boolean(ADMIN_ID),
    pocket: po
  });
});

app.get("/api/config-public", (_req, res) => {
  const cfg = readJson("config.json", {});
  res.json({
    appName: cfg.appName || "PO Desk",
    serverUrl: cfg.serverUrl || "",
    supabaseUrl: cfg.supabaseUrl || "",
    supabaseAnonKey: cfg.supabaseAnonKey || "",
    defaultLocale: cfg.defaultLocale || "ru"
  });
});

app.get("/api/check-access", async (req, res) => {
  const userId = String(req.query.userId || "").trim();
  if (!userId) return res.status(400).json({ ok: false, allowed: false });

  const db = createSupabase();
  if (db) {
    const { data, error } = await db
      .from("app_users")
      .select("telegram_id, role")
      .eq("telegram_id", userId)
      .maybeSingle();
    if (!error && data) {
      return res.json({ ok: true, allowed: true, role: data.role || "member" });
    }
  }

  const users = loadUsers();
  const allowed = users.allowed.includes(userId) || isAdmin(userId);
  res.json({ ok: true, allowed, role: isAdmin(userId) ? "admin" : "member" });
});

app.get("/api/allowed-users", (req, res) => {
  const adminId = String(req.query.adminId || req.headers["x-admin-id"] || "");
  if (!isAdmin(adminId)) return res.status(403).json({ ok: false, error: "admin only" });
  res.json({ ok: true, users: loadUsers() });
});

app.post("/api/admin/add-user", async (req, res) => {
  const adminId = String(req.body.adminId || "");
  const userId = String(req.body.userId || "").trim();
  if (!isAdmin(adminId)) return res.status(403).json({ ok: false, error: "admin only" });
  if (!userId) return res.status(400).json({ ok: false, error: "userId required" });

  const db = createSupabase();
  if (db) {
    const { error } = await db.from("app_users").upsert({ telegram_id: userId, role: "member" });
    if (error) return res.status(500).json({ ok: false, error: error.message });
  }

  const users = loadUsers();
  if (!users.allowed.includes(userId)) users.allowed.push(userId);
  writeJson("users.json", users);
  res.json({ ok: true, users });
});

app.post("/api/admin/remove-user", async (req, res) => {
  const adminId = String(req.body.adminId || "");
  const userId = String(req.body.userId || "").trim();
  if (!isAdmin(adminId)) return res.status(403).json({ ok: false, error: "admin only" });
  if (!userId || userId === ADMIN_ID) {
    return res.status(400).json({ ok: false, error: "cannot remove this user" });
  }

  const db = createSupabase();
  if (db) {
    const { error } = await db.from("app_users").delete().eq("telegram_id", userId);
    if (error) return res.status(500).json({ ok: false, error: error.message });
  }

  const users = loadUsers();
  users.allowed = users.allowed.filter((id) => id !== userId);
  users.admins = users.admins.filter((id) => id !== userId);
  writeJson("users.json", users);
  res.json({ ok: true, users });
});

app.get("/api/payouts", async (_req, res) => {
  try {
    const live = poQuotes.payouts();
    return res.json(Object.assign({
      EURUSD: 82, GBPUSD: 80, BTCUSD: 85, XAUUSD: 81
    }, live.pairs || {}, live));
  } catch (e) {
    res.json({ EURUSD: 82, GBPUSD: 80, BTCUSD: 85, XAUUSD: 81 });
  }
});

app.get("/api/candles", async (req, res) => {
  const pair = req.query.pair || req.query.symbol || "EURUSD_otc";
  const period = req.query.period || req.query.tf || "60";
  try {
    const data = await poQuotes.liveCandles(pair, period);
    res.json(data);
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

app.get("/api/po/health", async (_req, res) => {
  try {
    res.json(await poQuotes.liveHealth());
  } catch (e) {
    res.json({ ok: false, connected: false, fallback: true, error: e.message });
  }
});

app.use(express.static(ROOT));

app.listen(PORT, () => {
  console.log("[po-desk] http://localhost:" + PORT);
  console.log("[po-desk] PO_GATEWAY_URL=" + (process.env.PO_GATEWAY_URL || "(empty, using market fallback)"));
});
