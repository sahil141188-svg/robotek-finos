/**
 * ROBOTEK — Order Logger v5
 * - Orders append-only (no auto-delete ever)
 * - Order sheets protected on creation (only owner can delete rows)
 * - setupDirectory / setupAnalytics run only once (not on every order)
 * - Restock notify: when stock app detects restocked items, scans Enquiries
 *   tab and calls FinOS API to send WhatsApp to each waiting customer
 *
 * TO UPDATE:
 * 1. Sheet → Extensions → Apps Script → select all → delete → paste → Save
 * 2. Deploy → Manage Deployments → ✎ Edit → Version: New version → Deploy
 *    (Same URL — no changes needed in the app)
 */

// ── CONFIG — paste your values here ─────────────────────────────────────────
var FINOS_RESTOCK_URL    = "https://robotek-project.vercel.app/api/stock/restock-notify";
var FINOS_RESTOCK_SECRET = "7d_HfL-9zv2u_EQkL3J64FUQ97R0kIm9EzNubQbqU_s";

var HEADER     = ["Timestamp","Order ID","Customer","Phone","Order Date",
                  "Product","Boxes","Box Size","Total Qty (pcs)"];
var ENQ_HEADER = ["Timestamp","Order ID","Customer","Phone","Date","Product Enquired","Source"];

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
  var source = data.tag || "Orders"; // which CRM this customer belongs to
  var rows = enqs.map(function(p) {
    return [ts, orderId, data.customer||"", "'"+(data.phone||""), data.date||"", p, source];
  });
  sheet.getRange(sheet.getLastRow()+1, 1, rows.length, ENQ_HEADER.length).setValues(rows);
}

/* ── Restock notify — scan Enquiries tab, call FinOS API per CRM ───────────── */
function handleRestockNotify(products) {
  if (!products || !products.length) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var enqSheet = ss.getSheetByName("Enquiries");
  if (!enqSheet || enqSheet.getLastRow() < 2) {
    Logger.log("Restock notify: Enquiries tab empty — nothing to do");
    return;
  }

  // Read all enquiry rows: [Timestamp, OrderID, Customer, Phone, Date, Product, Source]
  // Col 7 (index 6) = Source tag — added in v6. Older rows without it default to "Orders" (HO).
  var data = enqSheet.getRange(2, 1, enqSheet.getLastRow()-1, 7).getValues();

  // Build a lookup: SC tag → SC_DIR entry  e.g. "Orders" → HO, "Store Orders" → Store
  var scByTag = {};
  SC_DIR.forEach(function(sc) { scByTag[sc.tag] = sc; });

  // Group matching enquiries by their source CRM tag
  // De-duplicate: one notification per (phone + product)
  var seen    = {};
  var byTag   = {}; // tag → [{customer, phone, product, enqDate}]

  for (var i = 0; i < data.length; i++) {
    var row      = data[i];
    var customer = String(row[2] || "").trim();
    var phone    = String(row[3] || "").trim().replace(/^'/, "");
    var enqDate  = String(row[4] || "").trim();
    var product  = String(row[5] || "").trim();
    var source   = String(row[6] || "Orders").trim() || "Orders"; // default HO

    if (!phone || !product) continue;

    // Only process if product is in the restocked list
    var isRestocked = products.some(function(p) {
      return p.toLowerCase() === product.toLowerCase();
    });
    if (!isRestocked) continue;

    var key = phone + "|" + product;
    if (seen[key]) continue;
    seen[key] = true;

    if (!byTag[source]) byTag[source] = [];
    byTag[source].push({ customer: customer, phone: phone, product: product, enqDate: enqDate });
  }

  var tags = Object.keys(byTag);
  if (!tags.length) {
    Logger.log("Restock notify: no matching enquiries for: " + products.join(", "));
    return;
  }

  // Send one FinOS API call per CRM group — each CRM only sees their own customers
  tags.forEach(function(tag) {
    var groupEnquiries = byTag[tag];
    var sc = scByTag[tag];

    // crmRecipient: the one CRM for this group. If source tag not in SC_DIR, fall back to HO.
    var crmContact = sc || scByTag["Orders"];
    var crmRecipients = crmContact ? [{ name: crmContact.name, phone: crmContact.wa }] : [];

    Logger.log("Restock notify [" + tag + "]: " + groupEnquiries.length + " customer(s), CRM: " + (crmContact ? crmContact.name : "none"));

    try {
      var payload = JSON.stringify({
        products:      products,
        enquiries:     groupEnquiries,
        crmRecipients: crmRecipients
      });
      var response = UrlFetchApp.fetch(FINOS_RESTOCK_URL, {
        method:      "post",
        contentType: "application/json",
        headers:     { "Authorization": "Bearer " + FINOS_RESTOCK_SECRET },
        payload:     payload,
        muteHttpExceptions: true
      });
      var code   = response.getResponseCode();
      var result = response.getContentText();
      Logger.log("FinOS [" + tag + "] response " + code + ": " + result);

      logRestockAlert(ss, products, groupEnquiries, code === 200 ? "sent" : "error:" + code);

    } catch(err) {
      Logger.log("Restock notify [" + tag + "] error: " + String(err));
      logRestockAlert(ss, products, groupEnquiries, "script_error");
    }
  });
}

/* ── Log restock alerts to a tab so sales team can see history ─────────────── */
function logRestockAlert(ss, products, notify, status) {
  var tabName = "Restock Alerts";
  var sheet   = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    var hdr = ["Timestamp","Product","Customer","Phone","Enquiry Date","WA Status"];
    sheet.appendRow(hdr);
    sheet.getRange(1, 1, 1, hdr.length)
      .setBackground("#1F1B20").setFontColor("#F7DA11").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  var ts = new Date();
  for (var i = 0; i < notify.length; i++) {
    var n = notify[i];
    sheet.appendRow([ts, n.product, n.customer, n.phone, n.enqDate, status]);
  }
}

/* ── Main: receive order POST ──────────────────────────────────────────────── */
function doPost(e) {
  try {
    var data    = JSON.parse(e.postData.contents);
    var ss      = SpreadsheetApp.getActiveSpreadsheet();

    // ── Handle restock notification (called by stock app checkStockChanges) ──
    if (data.type === "restock_notify") {
      handleRestockNotify(data.products || []);
      return json({ ok: true, type: "restock_notify" });
    }

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
