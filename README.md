# PO Desk

Чистая пересборка Mini App. Старые ключи, Render URL и Supabase-проект в код не входят.

## Состав

- `index.html` — разметка (не переписывался, все разделы как были)
- `style.css` — оформление в духе Pocket Option
- `script.js` — клиент (Telegram ID, сканер, заметки, калькулятор)
- `slv-po-patch.js` — подключение сканера к котировкам Pocket Option, без правки разметки
- `po-quotes.js` — прокси свечей: живой шлюз slv-vip-community, иначе рыночный fallback
- `server.js` — бэкенд + `/api/candles` + `/api/po/health`
- `config.json` — URL и ключи, которые вы подставите сами
- `users.json` — allowlist Telegram ID
- `ru.json` / `en.json` / `translations.js` — тексты
- `candles.json` — заготовка кэша
- `package.json` — зависимости сервера

## Запуск

```bash
cp env.example .env
npm install
npm start
```

Сервер: `http://localhost:8787`

## Сканер котировок (как в slv-vip-community)

`index.html` не менялся. Сервер перед `</body>` подключает `slv-po-patch.js`: сканер больше не ходит напрямую в Binance/Yahoo, а берёт свечи с `/api/candles`.

Чтобы это были **реальные котировки Pocket Option**, укажите в `.env` шлюз из `slv-vip-community`:

```
PO_GATEWAY_URL=http://127.0.0.1:8765
PO_API_KEY=slv_po_197fe4c7ccf0c7c06f9072fb0f715a1f
POCKET_SSID=42["auth",{...}]
```

На машине, где крутится `slv-vip-community`, оставьте `gateway.py` запущенным. Если шлюз недоступен, сканер покажет рыночный fallback, чтобы раздел не был пустым.

Проверка:

- `GET /api/po/health` — статус шлюза
- `GET /api/candles?pair=EUR/USD%20OTC&period=60` — свечи
