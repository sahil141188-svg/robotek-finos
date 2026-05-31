/**
 * ROBOTEK — Order Logger v3 (Google Apps Script web app)
 * Routes orders to different tabs based on the "tag" field:
 *   - No tag         → "Orders" tab       (your HO team's orders)
 *   - tag="Dealer Demand" → "Dealer Demand" tab  (SS / dealer orders)
 *
 * Also maintains a "Demand Analytics" tab with auto-summary formulas.
 *
 * TO UPDATE from v2:
 * 1. Sheet → Extensions → Apps Script → select all, delete, paste this → Save
 * 2. Deploy → Manage deployments → ✎ edit → Version: "New version" → Deploy
 *    (Same URL stays — no need to re-send it anywhere)
 *
 * Columns: Timestamp | Order ID | Customer | Phone | Order Date | Product | Boxes | Box Size | Total Qty (pcs)
 */

var HEADER = ["Timestamp", "Order ID", "Customer", "Phone", "Order Date",
              "Product", "Boxes", "Box Size", "Total Qty (pcs)"];

// ── SC Directory ────────────────────────────────────────────────────────────
var SC_DIR = [
  { ref:"HO1",   name:"Robotek Orders HO1",       wa:"918920239953", tag:"Orders"        },
  { ref:"HO2",   name:"Robotek Orders HO2",        wa:"917217613621", tag:"Orders"        },
  { ref:"Store", name:"Robotek Experience Store",  wa:"917678596456", tag:"Store Orders"  },
  { ref:"GKP",   name:"Robotek Gorakhpur",         wa:"919839454510", tag:"Dealer Demand" },
];
var BASE_URL = "https://robotekstock.vercel.app/stock";

function setupDirectory(ss) {
  var tabName = "SC Directory";
  var sheet   = ss.getSheetByName(tabName);
  if (sheet) sheet.clear(); else sheet = ss.insertSheet(tabName, 0); // first tab

  // Header
  var hdr = ["Ref Code", "Name", "Link", "WhatsApp", "Orders Tab"];
  sheet.appendRow(hdr);
  var hRange = sheet.getRange(1, 1, 1, hdr.length);
  hRange.setBackground("#1F1B20").setFontColor("#F7DA11").setFontWeight("bold").setFontSize(11);

  // Data rows
  SC_DIR.forEach(function(sc, i) {
    var link = BASE_URL + "?ref=" + sc.ref;
    var row  = [sc.ref, sc.name, link, "+" + sc.wa, sc.tag];
    sheet.appendRow(row);
    var bg = (i % 2 === 0) ? "#F7F5F6" : "#FFFFFF";
    sheet.getRange(i + 2, 1, 1, hdr.length).setBackground(bg);
    // make link clickable
    sheet.getRange(i + 2, 3).setFontColor("#1155CC").setFontLine("underline");
  });

  // Column widths
  sheet.setColumnWidth(1, 90);
  sheet.setColumnWidth(2, 240);
  sheet.setColumnWidth(3, 340);
  sheet.setColumnWidth(4, 140);
  sheet.setColumnWidth(5, 130);
  sheet.setFrozenRows(1);

  // Title above header
  sheet.insertRowBefore(1);
  sheet.getRange("A1:E1").merge()
    .setValue("🔴 ROBOTEK — Sales Contact Directory")
    .setBackground("#E52D31").setFontColor("#FFFFFF")
    .setFontWeight("bold").setFontSize(13)
    .setHorizontalAlignment("center");
}

function getSheet(ss, tabName) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
    // Style header row
    var hRange = sheet.getRange(1, 1, 1, HEADER.length);
    hRange.setBackground("#1F1B20").setFontColor("#F7DA11").setFontWeight("bold");
    return sheet;
  }
  // Ensure header is v3 format
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
  } else {
    var first = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (first.length !== HEADER.length || String(first[1]) !== "Order ID") {
      sheet.clear();
      sheet.appendRow(HEADER);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function setupAnalytics(ss) {
  var name = "Demand Analytics";
  var a = ss.getSheetByName(name);
  if (a) return;   // already exists, don't overwrite

  a = ss.insertSheet(name);

  // ── Section 1: YOUR ORDERS (from "Orders" tab) ──────────────────────────
  a.getRange("A1").setValue("YOUR TEAM ORDERS — Top Products");
  a.getRange("A1:C1").merge().setBackground("#E52D31").setFontColor("#fff").setFontWeight("bold");
  a.getRange("A2:C2").setValues([["Product", "Times Ordered", "Total Boxes"]]);
  a.getRange("A2:C2").setBackground("#1F1B20").setFontColor("#F7DA11").setFontWeight("bold");
  // Formulas populated dynamically — placeholder note
  a.getRange("A3").setValue("← Run a few orders first, then use Data → Pivot Table on the Orders tab for live charts");
  a.getRange("A3:C3").merge().setFontColor("#999").setFontStyle("italic");

  // ── Section 2: DEALER DEMAND ─────────────────────────────────────────────
  a.getRange("E1").setValue("DEALER DEMAND — Top Products");
  a.getRange("E1:G1").merge().setBackground("#1a237e").setFontColor("#fff").setFontWeight("bold");
  a.getRange("E2:G2").setValues([["Product", "Times Ordered", "Total Boxes"]]);
  a.getRange("E2:G2").setBackground("#1F1B20").setFontColor("#F7DA11").setFontWeight("bold");
  a.getRange("E3").setValue("← Run a few dealer orders, then pivot on 'Dealer Demand' tab");
  a.getRange("E3:G3").merge().setFontColor("#999").setFontStyle("italic");

  // ── Quick-count formulas (auto-update as orders come in) ─────────────────
  a.getRange("A7").setValue("QUICK COUNTS");
  a.getRange("A7").setFontWeight("bold");
  a.getRange("A8:B8").setValues([["Total HO orders:", '=COUNTA(Orders!B2:B)-1']]);
  a.getRange("A9:B9").setValues([["Total Dealer orders:", '=COUNTA(\'Dealer Demand\'!B2:B)-1']]);
  a.getRange("A10:B10").setValues([["Unique HO products:", '=SUMPRODUCT(1/COUNTIF(Orders!F2:F,Orders!F2:F))']]);
  a.getRange("A11:B11").setValues([["Unique Dealer products:", '=SUMPRODUCT(1/COUNTIF(\'Dealer Demand\'!F2:F,\'Dealer Demand\'!F2:F))']]);

  // Column widths
  a.setColumnWidth(1, 220);
  a.setColumnWidth(2, 140);
  a.setColumnWidth(3, 120);
  a.setColumnWidth(4, 30);
  a.setColumnWidth(5, 220);
  a.setColumnWidth(6, 140);
  a.setColumnWidth(7, 120);

  a.setFrozenRows(2);
}

function doPost(e) {
  try {
    var data    = JSON.parse(e.postData.contents);
    var ss      = SpreadsheetApp.getActiveSpreadsheet();
    var tabName = (data.tag && data.tag.trim()) ? data.tag.trim() : "Orders";
    var sheet   = getSheet(ss, tabName);

    // Ensure SC Directory + Demand Analytics tabs exist
    setupDirectory(ss);
    setupAnalytics(ss);

    var ts      = new Date();
    var orderId = "ORD-" + ts.getTime().toString(36).toUpperCase();
    var items   = data.items || [];
    if (!items.length) return json({ ok: false, error: "no items" });

    var rows = items.map(function(it) {
      var boxes   = Number(it.boxes) || 0;
      var boxSize = (it.boxSize === "" || it.boxSize == null) ? "" : Number(it.boxSize);
      var total   = (boxSize && boxes) ? boxes * boxSize : (it.totalQty || "");
      return [ts, orderId, data.customer || "", "'" + (data.phone || ""), data.date || "",
              it.name || "", boxes, boxSize, total];
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADER.length).setValues(rows);
    return json({ ok: true, orderId: orderId, lines: rows.length, tab: tabName });
  } catch(err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  // ?setup=1 → instantly create ALL tabs (no need to wait for first order)
  if (e && e.parameter && e.parameter.setup === "1") {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    setupDirectory(ss);
    getSheet(ss, "Orders");
    getSheet(ss, "Store Orders");
    getSheet(ss, "Dealer Demand");
    setupAnalytics(ss);
    return ContentService.createTextOutput(
      "✅ All tabs created:\n" +
      "• SC Directory\n" +
      "• Orders (HO team)\n" +
      "• Store Orders (Experience Store)\n" +
      "• Dealer Demand (Gorakhpur SS)\n" +
      "• Demand Analytics\n\n" +
      "Open your Google Sheet to see them."
    );
  }
  return ContentService.createTextOutput("Robotek order logger v3 is running.");
}
