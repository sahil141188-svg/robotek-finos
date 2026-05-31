# Robotek — Live Stock App

A single-page, installable (PWA) stock list your customers open from their phone home screen.
It reads products **live from your Google Sheet** and lets customers build an order that goes to
your **WhatsApp** and (optionally) gets **logged into an Orders sheet** automatically.

No server to run. Hosted free on Vercel/Netlify.

---

## 1. Set up your Google Sheet

Make a sheet (or a tab) named **`Stock`** with this layout. **Row 1 = headers**, data from row 2:

| A (Category)     | B (Product)   | C (Box Qty) | D (In Stock) | E (Fast Selling) | F (New Launch) |
|------------------|---------------|-------------|--------------|------------------|----------------|
| Data Cable       | DC 101        | 180         | Yes          | Yes              |                |
| Smart Charger    | SC 222        | 50          | Yes          |                  | Yes            |
| Power Bank       | PB 10000      | 20          | No           |                  |                |

- **Category** — groups products into sections/tabs. Add any categories you like; the app builds tabs automatically.
- **Box Qty** — units per box (shown as `Bx:180`). Leave blank if not boxed.
- **In Stock** — `Yes`/blank = available, `No`/`0`/`Out` = shown greyed out & not orderable.
- **Fast Selling / New Launch** — put `Yes` to feature it in those special sections. Leave blank otherwise.

Then **Share → General access → "Anyone with the link" → Viewer**. (The app only needs read access; customers never see the sheet itself.)

## 2. Connect the app

Open `index.html`, find the `CONFIG` block near the top of the `<script>`, and set:

```js
SHEET_ID: "...",        // the long ID from your sheet URL:  docs.google.com/spreadsheets/d/THIS_PART/edit
SHEET_NAME: "Stock",    // the tab name
WHATSAPP: "918920239953" // your order number, country code + number, no "+"
```

That's enough to go live. Until you set `SHEET_ID`, the app shows built-in **sample** products so you can preview it.

## 3. (Optional) Auto-log orders to a sheet

Follow the steps inside **`apps-script.gs`** (≈2 minutes). Copy the deployed Web-app URL into:

```js
ORDER_LOG_URL: "https://script.google.com/macros/s/..../exec"
```

Every order then appends a row to an **Orders** tab (customer, phone, date, items).

## 4. Deploy (free)

**Vercel:** `npm i -g vercel` then run `vercel` in this folder → follow prompts → you get a public URL.
**Netlify:** drag this folder onto https://app.netlify.com/drop.

Share the URL with customers. On the phone they tap **⋮ / Share → Add to Home Screen** and it installs
with the Robotek icon, opening fullscreen like an app.

---

## Files
- `index.html` — the whole app (UI + live sheet read + ordering + PWA).
- `manifest.webmanifest`, `sw.js`, `icons/` — make it installable & work offline.
- `apps-script.gs` — paste into Google Apps Script to log orders.
