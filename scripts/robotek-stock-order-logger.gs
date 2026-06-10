/**
 * ROBOTEK — Order Logger + Sheet Manager v6
 *
 * Combines:
 *   • doPost / doGet  — stock app order & enquiry logging
 *   • handleRestockNotify — WhatsApp restock alerts via FinOS API
 *   • formatSheet / copySelectedParty — party-wise formatting + copy UI
 *   • onOpen / setupTriggers — menu & auto-format triggers
 *
 * TO UPDATE:
 * 1. Sheet → Extensions → Apps Script → select all → delete → paste → Save
 * 2. Deploy → Manage Deployments → ✎ Edit → Version: New version → Deploy
 *    (Same URL — no changes needed in the stock app)
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

// ============================================================
// ON OPEN — adds Robotek menu to toolbar
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📋 Robotek')
    .addItem('Copy Selected Party Order', 'copySelectedParty')
    .addSeparator()
    .addItem('Format All Sheets', 'formatOrdersPartyWise')
    .addToUi();
}

// ============================================================
// PROTECT SHEET — two flavours:
//   protectSheetTab(sheet) — used internally by getSheet()
//   protectSheet()         — menu-callable, works on active sheet
// ============================================================
function protectSheetTab(sheet) {
  try {
    var existing = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (existing.length > 0) return; // already protected
    var protection = sheet.protect();
    protection.setDescription("Order data — admin only. Do not delete rows.");
    var me = Session.getEffectiveUser();
    protection.addEditor(me);
    var editors = protection.getEditors();
    editors.forEach(function(e) {
      if (e.getEmail() !== me.getEmail()) protection.removeEditor(e);
    });
    protection.setWarningOnly(true);
  } catch(e) {
    // Protection may not be supported in all plans — silently skip
  }
}

function protectSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var protection = sheet.protect().setDescription('Protected Sheet');
  var me = Session.getEffectiveUser();
  protection.addEditor(me);
  protection.removeEditors(protection.getEditors());
  if (protection.canDomainEdit()) { protection.setDomainEdit(false); }
}

// ============================================================
// FORMAT SHEET — fast batch version, no timeouts
// ============================================================
function formatSheet(sheetName) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return;

  var COL_CUSTOMER = 3;
  var COL_QTY      = 9;
  var COL_BUTTON   = 10;

  // ── Step 1: Clear ALL formatting in one batch call ──
  sheet.getRange(1, 1, lastRow, lastCol + 1)
       .setBackground(null)
       .setFontColor('#000000')
       .setFontWeight('normal')
       .setFontSize(10);

  // ── Step 2: Remove old TOTAL rows (bottom to top) ──
  var allC = sheet.getRange(2, COL_CUSTOMER, lastRow - 1, 1).getValues();
  for (var r = allC.length - 1; r >= 0; r--) {
    var v = allC[r][0];
    if (typeof v === 'string' && v.indexOf('TOTAL') !== -1) {
      sheet.deleteRow(r + 2);
    }
  }

  // ── Step 3: Read all clean data in ONE batch call ──
  lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  // ── Step 4: Build party groups ──
  var groups = [];
  var curCustomer = null, curGroup = null;
  for (var i = 0; i < data.length; i++) {
    var cust = data[i][COL_CUSTOMER - 1];
    if (cust !== curCustomer) {
      curGroup = { customer: cust, startRow: i + 2, count: 0 };
      groups.push(curGroup);
      curCustomer = cust;
    }
    curGroup.count++;
  }

  // ── Step 5: Insert TOTAL rows bottom to top ──
  for (var g = groups.length - 1; g >= 0; g--) {
    var info    = groups[g];
    var insertAt = info.startRow + info.count;
    sheet.insertRowBefore(insertAt);

    var qtyVals  = sheet.getRange(info.startRow, COL_QTY, info.count, 1).getValues();
    var totalQty = 0;
    for (var k = 0; k < qtyVals.length; k++) {
      if (typeof qtyVals[k][0] === 'number') totalQty += qtyVals[k][0];
    }

    sheet.getRange(insertAt, COL_CUSTOMER).setValue('── TOTAL: ' + info.customer + ' ──');
    sheet.getRange(insertAt, COL_QTY).setValue(totalQty);

    sheet.getRange(insertAt, 1, 1, lastCol + 1)
         .setBackground('#FFF176')
         .setFontWeight('bold')
         .setFontSize(10)
         .setFontColor('#000000');

    sheet.getRange(insertAt, COL_BUTTON)
         .setValue('📋 COPY')
         .setBackground('#1565C0')
         .setFontColor('#FFFFFF')
         .setFontWeight('bold')
         .setFontSize(9)
         .setHorizontalAlignment('center')
         .setNote('COPY|' + sheetName + '|' + info.customer);
  }

  // ── Step 6: Apply party colors in BULK ──
  var newLastRow = sheet.getLastRow();
  var allCNew    = sheet.getRange(2, COL_CUSTOMER, newLastRow - 1, 1).getValues();
  var colors     = ['#E8F5E9', '#E3F2FD'];
  var colorIdx   = -1;
  var prevParty  = null;
  var colorBatches = [[], []];

  for (var r2 = 0; r2 < allCNew.length; r2++) {
    var cv      = allCNew[r2][0];
    var isTotal = (typeof cv === 'string' && cv.indexOf('TOTAL') !== -1);
    if (!isTotal) {
      if (cv !== prevParty) {
        colorIdx  = (colorIdx + 1) % 2;
        prevParty = cv;
      }
      colorBatches[colorIdx].push(r2 + 2);
    }
  }

  if (colorBatches[0].length > 0) {
    var greenRanges = colorBatches[0].map(function(row) {
      return sheet.getRange(row, 1, 1, lastCol).getA1Notation();
    });
    sheet.getRangeList(greenRanges).setBackground(colors[0]);
  }
  if (colorBatches[1].length > 0) {
    var blueRanges = colorBatches[1].map(function(row) {
      return sheet.getRange(row, 1, 1, lastCol).getA1Notation();
    });
    sheet.getRangeList(blueRanges).setBackground(colors[1]);
  }

  // ── Step 7: Header for col J ──
  sheet.getRange(1, COL_BUTTON)
       .setValue('📋 Copy')
       .setFontWeight('bold')
       .setBackground('#E3F2FD')
       .setFontColor('#000000');
  sheet.setColumnWidth(COL_BUTTON, 90);
}

function formatOrdersPartyWise() {
  formatSheet('Orders');
  formatSheet('Store Orders');
  formatSheet('Dealer Demand');
  SpreadsheetApp.getUi().alert('✅ Done! All 3 sheets formatted.');
}

// ============================================================
// COPY SELECTED PARTY
// ============================================================
function copySelectedParty() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  var cell  = sheet.getActiveCell();

  if (cell.getColumn() !== 10) {
    SpreadsheetApp.getUi().alert('⚠️ First click the blue 📋 COPY cell on a yellow TOTAL row, then use this menu.');
    return;
  }

  var note = cell.getNote();
  if (!note || note.indexOf('COPY|') !== 0) {
    SpreadsheetApp.getUi().alert('⚠️ Please click a blue 📋 COPY cell on a yellow TOTAL row and try again.');
    return;
  }

  var parts     = note.split('|');
  var sheetName = parts[1];
  var partyName = parts[2];

  var srcSheet  = ss.getSheetByName(sheetName);
  if (!srcSheet) { SpreadsheetApp.getUi().alert('Sheet not found: ' + sheetName); return; }

  var lastRow = srcSheet.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert('No data found.'); return; }

  var allData = srcSheet.getRange(2, 1, lastRow - 1, 9).getValues();
  var lines   = [];

  for (var i = 0; i < allData.length; i++) {
    var cust    = allData[i][2];
    var isTotal = (typeof cust === 'string' && cust.indexOf('TOTAL') !== -1);
    if (!isTotal && String(cust).trim() === String(partyName).trim()) {
      var product = allData[i][5];
      var qty     = allData[i][8];
      if (product !== '' && product !== null && product !== undefined) {
        lines.push(product + '\t' + (qty || 0));
      }
    }
  }

  if (lines.length === 0) {
    SpreadsheetApp.getUi().alert('No items found for: ' + partyName);
    return;
  }

  var copyText   = lines.join('\n');
  var escaped    = copyText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var partyEsc   = partyName.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var sheetEsc   = sheetName.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  var html = HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><style>' +
    'body{font-family:Arial,sans-serif;padding:14px;margin:0;font-size:13px}' +
    'h3{color:#1565C0;margin:0 0 2px;font-size:14px;word-break:break-word}' +
    '.sub{color:#666;font-size:11px;margin:0 0 10px}' +
    'textarea{width:100%;height:280px;font-size:12px;font-family:monospace;' +
    'border:2px solid #1565C0;padding:6px;box-sizing:border-box;resize:none;background:#f8f9fa}' +
    '.btn{width:100%;background:#1565C0;color:#fff;border:none;padding:12px;' +
    'font-size:13px;font-weight:bold;border-radius:5px;cursor:pointer;margin-top:10px;display:block}' +
    '.ok{display:none;color:#2e7d32;font-weight:bold;text-align:center;' +
    'margin-top:10px;padding:8px;background:#e8f5e9;border-radius:4px}' +
    '.hint{color:#999;font-size:10px;text-align:center;margin-top:6px}' +
    '</style></head><body>' +
    '<h3>📋 ' + partyEsc + '</h3>' +
    '<p class="sub">' + sheetEsc + ' &nbsp;·&nbsp; <b>' + lines.length + ' items</b></p>' +
    '<textarea id="t" readonly>' + escaped + '</textarea>' +
    '<button class="btn" onclick="doCopy()">⚡ Copy All — then Ctrl+V in ERP</button>' +
    '<div class="ok" id="ok">✅ Copied! Go to ERP and press Ctrl+V</div>' +
    '<p class="hint">Format: Product Name [Tab] Qty</p>' +
    '<script>' +
    'function doCopy(){' +
    'var t=document.getElementById("t");t.select();' +
    'document.execCommand("copy");' +
    'document.querySelector(".btn").style.background="#2e7d32";' +
    'document.querySelector(".btn").textContent="✅ Copied! Paste in ERP with Ctrl+V";' +
    'document.getElementById("ok").style.display="block";}' +
    'window.onload=function(){document.getElementById("t").focus();document.getElementById("t").select();};' +
    '<\/script></body></html>'
  ).setTitle('📋 ' + partyName).setWidth(340);

  SpreadsheetApp.getUi().showSidebar(html);
}

// ============================================================
// AUTO FORMAT on new form submission
// ============================================================
function onFormSubmitTrigger(e) {
  var sheetName = e.range.getSheet().getName();
  if (sheetName === 'Orders' ||
      sheetName === 'Store Orders' ||
      sheetName === 'Dealer Demand') {
    formatSheet(sheetName);
  }
}

// ============================================================
// SETUP TRIGGERS — run once
// ============================================================
function setupTriggers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'onFormSubmitTrigger') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('onFormSubmitTrigger')
    .forSpreadsheet(ss).onFormSubmit().create();
  SpreadsheetApp.getUi().alert('✅ Triggers installed! New orders will auto-format.');
}

// ============================================================
// ORDER LOGGER — get or create a tab, never clears data
// ============================================================
function getSheet(ss, tabName) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADER.length)
      .setBackground("#1F1B20").setFontColor("#F7DA11").setFontWeight("bold");
    protectSheetTab(sheet);
    return sheet;
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADER.length)
      .setBackground("#1F1B20").setFontColor("#F7DA11").setFontWeight("bold");
  }
  protectSheetTab(sheet);
  return sheet;
}

// ── SC Directory tab — only create once ──
function setupDirectory(ss) {
  var tabName = "SC Directory";
  if (ss.getSheetByName(tabName)) return;
  var sheet = ss.insertSheet(tabName, 0);

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

// ── Analytics tab — only create once ──
function setupAnalytics(ss) {
  var name = "Demand Analytics";
  if (ss.getSheetByName(name)) return;
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

// ── Log enquiries (out-of-stock products customer asked about) ──
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

// ============================================================
// RESTOCK NOTIFY — scan Enquiries tab, call FinOS API per CRM
// ============================================================
function handleRestockNotify(products) {
  if (!products || !products.length) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var enqSheet = ss.getSheetByName("Enquiries");
  if (!enqSheet || enqSheet.getLastRow() < 2) {
    Logger.log("Restock notify: Enquiries tab empty — nothing to do");
    return;
  }

  // Col 7 (index 6) = Source tag. Older rows without it default to "Orders" (HO).
  var data = enqSheet.getRange(2, 1, enqSheet.getLastRow()-1, 7).getValues();

  var scByTag = {};
  SC_DIR.forEach(function(sc) { scByTag[sc.tag] = sc; });

  // Group matching enquiries by source CRM tag, de-duplicate per (phone + product)
  var seen  = {};
  var byTag = {};

  for (var i = 0; i < data.length; i++) {
    var row      = data[i];
    var customer = String(row[2] || "").trim();
    var phone    = String(row[3] || "").trim().replace(/^'/, "");
    var enqDate  = String(row[4] || "").trim();
    var product  = String(row[5] || "").trim();
    var source   = String(row[6] || "Orders").trim() || "Orders";

    if (!phone || !product) continue;

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

  // One FinOS API call per CRM — each CRM only sees their own customers
  tags.forEach(function(tag) {
    var groupEnquiries = byTag[tag];
    var sc = scByTag[tag];
    var crmContact   = sc || scByTag["Orders"]; // fallback to HO
    var crmRecipients = crmContact ? [{ name: crmContact.name, phone: crmContact.wa }] : [];

    Logger.log("Restock notify [" + tag + "]: " + groupEnquiries.length + " customer(s), CRM: " + (crmContact ? crmContact.name : "none"));

    try {
      var payload = JSON.stringify({
        products:      products,
        enquiries:     groupEnquiries,
        crmRecipients: crmRecipients
      });
      var response = UrlFetchApp.fetch(FINOS_RESTOCK_URL, {
        method:             "post",
        contentType:        "application/json",
        headers:            { "Authorization": "Bearer " + FINOS_RESTOCK_SECRET },
        payload:            payload,
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

// ── Log restock alerts to sheet ──
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

// ============================================================
// doPost — main entry point for stock app orders
// ============================================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss   = SpreadsheetApp.getActiveSpreadsheet();

    // Restock notification — called by stock app's checkStockChanges
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
    if (!items.length && !hasEnq) return json({ ok: false, error: "no items" });

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

    // Auto-format the sheet after each new order
    formatSheet(tabName);

    return json({ ok: true, orderId: orderId, lines: rows.length,
                  enquiries: (data.enquiries||[]).length, tab: tabName });
  } catch(err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// doGet — ?setup=1 creates all tabs at once
// ============================================================
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
  return ContentService.createTextOutput("Robotek order logger v6 — running.");
}
