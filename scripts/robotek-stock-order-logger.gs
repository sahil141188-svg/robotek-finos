/**
 * ROBOTEK — Order Logger v4
 * - Orders append-only (no auto-delete ever)
 * - Order sheets protected on creation (only owner can delete rows)
 * - setupDirectory / setupAnalytics run only once (not on every order)
 *
 * TO UPDATE:
 * 1. Sheet → Extensions → Apps Script → select all → delete → paste → Save
 * 2. Deploy → Manage Deployments → ✎ Edit → Version: New version → Deploy
 *    (Same URL — no changes needed in the app)
 */

var HEADER     = ["Timestamp","Order ID","Customer","Phone","Order Date",
                  "Product","Boxes","Box Size","Total Qty (pcs)"];
var ENQ_HEADER = ["Timestamp","Order ID","Customer","Phone","Date","Product Enquired"];

var SC_DIR = [
  { ref:"HO",    name:"Robotek Head Office",       wa:"918851403037", tag:"Orders"        },
  { ref:"Store", name:"Robotek Experience Store",  wa:"917678596456", tag:"Store Orders"  },
  { ref:"GKP",   name:"Robotek Gorakhpur",         wa:"919839454510", tag:"Dealer Demand" },
];
var BASE_URL = "https://robotekstock.vercel.app/stock";

/* ── Protect a sheet so only the owner (you) can edit ─────────────────────── */
function protectSheet(sheet) {
  try {
    var existing = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (existing.length > 0) return; // already protected
    var protection = sheet.protect();
    protection.setDescription("Order data — admin only. Do not delete rows.");
    // Remove all editors except the owner
    var me = Session.getEffectiveUser();
    protection.addEditor(me);
    var editors = protection.getEditors();
    editors.forEach(function(e) {
      if (e.getEmail() !== me.getEmail()) protection.removeEditor(e);
    });
    protection.setWarningOnly(true); // shows warning before editing — doesn't fully lock
  } catch(e) {
    // Protection may not be supported in all plans — silently skip
  }
}

/* ── Get or create an order sheet — NEVER clears existing data ─────────────── */
function getSheet(ss, tabName) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADER.length)
      .setBackground("#1F1B20").setFontColor("#F7DA11").setFontWeight("bold");
    protectSheet(sheet);
    return sheet;
  }
  // Only add header if sheet is completely empty — NEVER clear existing data
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADER.length)
      .setBackground("#1F1B20").setFontColor("#F7DA11").setFontWeight("bold");
  }
  // Ensure protection is applied
  protectSheet(sheet);
  return sheet;
}

/* ── SC Directory — only rebuild if tab doesn't exist ─────────────────────── */
function setupDirectory(ss) {
  var tabName = "SC Directory";
  var sheet   = ss.getSheetByName(tabName);
  if (sheet) return; // already exists — don't touch it
  sheet = ss.insertSheet(tabName, 0);

  var hdr = ["Ref Code","Name","Link","WhatsApp","Orders Tab"];
  sheet.appendRow(hdr);
  sheet.getRange(1, 1, 1, hdr.length)
    .setBackground("#1F1B20").setFontColor("#F7DA11").setFontWeight("bold").setFontSize(11);

  SC_DIR.forEach(function(sc, i) {
    var link = BASE_URL + "?ref=" + sc.ref;
    sheet.appendRow([sc.ref, sc.name, link, "+" + sc.wa, sc.tag]);
    sheet.getRange(i + 2, 1, 1, hdr.length).setBackground(i % 2 === 0 ? "#F7F5F6" : "#FFFFFF");
    sheet.getRange(i + 2, 3).setFontColor("#1155CC").setFontLine("underline");
  });

  sheet.setColumnWidth(1, 90);  sheet.setColumnWidth(2, 240);
  sheet.setColumnWidth(3, 340); sheet.setColumnWidth(4, 140);
  sheet.setColumnWidth(5, 130); sheet.setFrozenRows(1);

  sheet.insertRowBefore(1);
  sheet.getRange("A1:E1").merge()
    .setValue("🔴 ROBOTEK — Sales Contact Directory")
    .setBackground("#E52D31").setFontColor("#FFFFFF")
    .setFontWeight("bold").setFontSize(13)
    .setHorizontalAlignment("center");
}

/* ── Analytics tab — only create once ─────────────────────────────────────── */
function setupAnalytics(ss) {
  var name = "Demand Analytics";
  if (ss.getSheetByName(name)) return; // already exists
  var a = ss.insertSheet(name);

  a.getRange("A1").setValue("YOUR TEAM ORDERS — Top Products");
  a.getRange("A1:C1").merge().setBackground("#E52D31").setFontColor("#fff").setFontWeight("bold");
  a.getRange("A2:C2").setValues([["Product","Times Ordered","Total Boxes"]]);
  a.getRange("A2:C2").setBackground("#1F1B20").setFontColor("#F7DA11").setFontWeight("bold");
  a.getRange("A3").setValue("← Run a few orders first, then use Data → Pivot Table on the Orders tab");
  a.getRange("A3:C3").merge().setFontColor("#999").setFontStyle("italic");

  a.getRange("E1").setValue("DEALER DEMAND — Top Products");
  a.getRange("E1:G1").merge().setBackground("#1a237e").setFontColor("#fff").setFontWeight("bold");
  a.getRange("E2:G2").setValues([["Product","Times Ordered","Total Boxes"]]);
  a.getRange("E2:G2").setBackground("#1F1B20").setFontColor("#F7DA11").setFontWeight("bold");
  a.getRange("E3").setValue("← Run a few dealer orders, then pivot on 'Dealer Demand' tab");
  a.getRange("E3:G3").merge().setFontColor("#999").setFontStyle("italic");

  a.getRange("A7").setValue("QUICK COUNTS").setFontWeight("bold");
  a.getRange("A8:B8").setValues([["Total HO orders:",        '=COUNTA(Orders!B2:B)']]);
  a.getRange("A9:B9").setValues([["Total Dealer orders:",    '=COUNTA(\'Dealer Demand\'!B2:B)']]);
  a.getRange("A10:B10").setValues([["Total Store orders:",   '=COUNTA(\'Store Orders\'!B2:B)']]);

  [1,2,3,4,5,6,7].forEach(function(w,i){a.setColumnWidth(i+1,i<3||i===4?220:i===3?30:140);});
  a.setFrozenRows(2);
}

/* ── Log enquiries ─────────────────────────────────────────────────────────── */
function logEnquiries(ss, data, orderId, ts) {
  var enqs = data.enquiries || [];
  if (!enqs.length) return;
  var sheet = ss.getSheetByName("Enquiries");
  if (!sheet) {
    sheet = ss.insertSheet("Enquiries");
    sheet.appendRow(ENQ_HEADER);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, ENQ_HEADER.length)
      .setBackground("#1a237e").setFontColor("#F7DA11").setFontWeight("bold");
  }
  var rows = enqs.map(function(p) {
    return [ts, orderId, data.customer||"", "'"+(data.phone||""), data.date||"", p];
  });
  sheet.getRange(sheet.getLastRow()+1, 1, rows.length, ENQ_HEADER.length).setValues(rows);
}

/* ── Main: receive order POST ──────────────────────────────────────────────── */
function doPost(e) {
  try {
    var data    = JSON.parse(e.postData.contents);
    var ss      = SpreadsheetApp.getActiveSpreadsheet();
    var tabName = (data.tag && data.tag.trim()) ? data.tag.trim() : "Orders";
    var sheet   = getSheet(ss, tabName);

    // One-time setup — only runs if tabs don't exist yet
    setupDirectory(ss);
    setupAnalytics(ss);

    var ts      = new Date();
    var orderId = "ORD-" + ts.getTime().toString(36).toUpperCase();
    var items   = data.items || [];
    var hasEnq  = (data.enquiries || []).length > 0;
    if (!items.length && !hasEnq) return json({ ok:false, error:"no items" });

    logEnquiries(ss, data, orderId, ts);

    var rows = items.map(function(it) {
      var boxes   = Number(it.boxes) || 0;
      var boxSize = (it.boxSize===""||it.boxSize==null) ? "" : Number(it.boxSize);
      var total   = (boxSize && boxes) ? boxes*boxSize : (it.totalQty||"");
      return [ts, orderId, data.customer||"", "'"+(data.phone||""), data.date||"",
              it.name||"", boxes, boxSize, total];
    });

    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow()+1, 1, rows.length, HEADER.length).setValues(rows);
    }

    return json({ ok:true, orderId:orderId, lines:rows.length,
                  enquiries:(data.enquiries||[]).length, tab:tabName });
  } catch(err) {
    return json({ ok:false, error:String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ── GET: ?setup=1 creates all tabs at once ────────────────────────────────── */
function doGet(e) {
  if (e && e.parameter && e.parameter.setup === "1") {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    setupDirectory(ss);
    getSheet(ss, "Orders");
    getSheet(ss, "Store Orders");
    getSheet(ss, "Dealer Demand");
    setupAnalytics(ss);
    return ContentService.createTextOutput(
      "✅ All tabs ready:\n• SC Directory\n• Orders\n• Store Orders\n• Dealer Demand\n• Enquiries\n• Demand Analytics\n\nAll order tabs are now protected."
    );
  }
  return ContentService.createTextOutput("Robotek order logger v4 — running.");
}
