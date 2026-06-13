/**
 * ROBOTEK -- Order Logger + Sheet Manager v6
 *
 * Combines:
 *   - doPost / doGet        -- stock app order & enquiry logging
 *   - handleRestockNotify   -- WhatsApp restock alerts via FinOS API
 *   - handleNewProductNotify-- WhatsApp new launch alerts to all past customers
 *   - formatSheet           -- party-wise formatting + TOTAL rows
 *   - showCopySidebar       -- click COPY cell -> sidebar opens instantly (Product + Total Qty only)
 *   - onOpen / setupTriggers-- menu & auto-format triggers
 *
 * TO UPDATE:
 * 1. Sheet -> Extensions -> Apps Script -> select all -> delete -> paste -> Save
 * 2. Deploy -> Manage Deployments -> Edit -> Version: New version -> Deploy
 *    (Same URL -- no changes needed in the stock app)
 * 3. Run setupTriggers() once to install the onSelectionChange trigger
 */

// ===== CONFIG =================================================================
var FINOS_RESTOCK_URL    = "https://robotek-project.vercel.app/api/stock/restock-notify";
var FINOS_RESTOCK_SECRET = "7d_HfL-9zv2u_EQkL3J64FUQ97R0kIm9EzNubQbqU_s";

// Set to false to disable all WhatsApp stock alerts (restock + new product)
var WA_ALERTS_ENABLED = false;

var HEADER     = ["Timestamp","Order ID","Customer","Phone","Order Date",
                  "Product","Total Qty (pcs)","Box Size","Boxes"];
var ENQ_HEADER = ["Timestamp","Order ID","Customer","Phone","Date","Product Enquired","Source"];

var SC_DIR = [
  { ref:"HO",       name:"Robotek Head Office",            wa:"918851403037", tag:"Orders"       },
  { ref:"Store",    name:"Robotek Experience Store",       wa:"917678596456", tag:"Store Orders" }, // customer link
  { ref:"StoreCRM", name:"Robotek Experience Store (CRM)", wa:"917678596456", tag:"Orders"       }, // CRM link
  { ref:"GKP",      name:"Robotek Gorakhpur",              wa:"919839454510", tag:"Orders"       },
];
var BASE_URL = "https://robotekstock.vercel.app/stock";

// ===== ON OPEN ================================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Robotek')
    .addItem('Copy Selected Party Order', 'copySelectedParty')
    .addSeparator()
    .addItem('Format All Sheets', 'formatOrdersPartyWise')
    .addSeparator()
    .addItem('Step 1 — Rename Images in Drive (1.jpg, 2.jpg, 3.jpg)', 'renameProductImages')
    .addItem('Step 2 — Map Product Images to Sheet', 'mapProductImages')
    .addToUi();
}

// ===== RENAME PRODUCT IMAGES IN DRIVE =========================================
// Renames all image files in every product folder to 1.jpg, 2.jpg, 3.jpg...
// in alphabetical order of their CURRENT name.
// Run this ONCE before mapProductImages() to set the correct order.
// To change priority: in Drive, rename the file you want FIRST to start with "1",
// the second image to "2", third to "3", then run this again.
function renameProductImages() {
  var DRIVE_FOLDER_ID = "1cVvpk5xezTic9t2PXDLzLNHf0NXpSoGH";
  var mainFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  var catFolders = mainFolder.getFolders();
  var totalRenamed = 0;
  var errors = [];

  while (catFolders.hasNext()) {
    var catFolder = catFolders.next();
    var prodFolders = catFolder.getFolders();

    while (prodFolders.hasNext()) {
      var prodFolder = prodFolders.next();

      // Collect all image files
      var allFiles = [];
      var jpgs = prodFolder.getFilesByType(MimeType.JPEG);
      while (jpgs.hasNext()) allFiles.push(jpgs.next());
      var pngs = prodFolder.getFilesByType(MimeType.PNG);
      while (pngs.hasNext()) allFiles.push(pngs.next());

      if (allFiles.length === 0) continue;

      // Sort by current filename alphabetically
      allFiles.sort(function(a, b) {
        return a.getName().toLowerCase().localeCompare(b.getName().toLowerCase());
      });

      // Rename to 1.jpg, 2.jpg, 3.jpg ... (only first 5 max)
      var limit = Math.min(allFiles.length, 5);
      for (var i = 0; i < limit; i++) {
        try {
          var ext = allFiles[i].getMimeType() === MimeType.PNG ? ".png" : ".jpg";
          var newName = (i + 1) + ext;
          allFiles[i].setName(newName);
          totalRenamed++;
        } catch(e) {
          errors.push(prodFolder.getName() + ": " + e.message);
        }
      }
    }
  }

  var msg = "✅ Done! Renamed " + totalRenamed + " images across all product folders.\n\n";
  msg += "Files are now: 1.jpg (first/main), 2.jpg, 3.jpg...\n\n";
  msg += "Now run Step 2 — Map Product Images to Sheet.";
  if (errors.length) msg += "\n\n⚠️ Errors (" + errors.length + "):\n" + errors.slice(0,5).join("\n");
  SpreadsheetApp.getUi().alert(msg);
}

// ===== MAP PRODUCT IMAGES FROM DRIVE ==========================================
// Scans the Stock Images Drive folder, matches product names to image files,
// and fills column K (Image URL) in the Stock List sheet automatically.
// Run once from Robotek menu → Map Product Images from Drive.
function mapProductImages() {
  var ss         = SpreadsheetApp.getActiveSpreadsheet();
  var sheet      = ss.getSheetByName("Stock List");
  if (!sheet) { SpreadsheetApp.getUi().alert("Stock List sheet not found."); return; }

  var DRIVE_FOLDER_ID = "1cVvpk5xezTic9t2PXDLzLNHf0NXpSoGH";

  // Ensure col K header
  sheet.getRange(1, 11).setValue("Image URL")
       .setBackground("#1F1B20").setFontColor("#F7DA11").setFontWeight("bold");

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { SpreadsheetApp.getUi().alert("No products found in Stock List."); return; }

  var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues(); // cols A (category) + B (product name)

  // Build map: normalised folder name → pipe-separated list of ALL image URLs
  // Structure: Main Folder → Category Folders → Product Folders → Image files
  var imageMap = {}; // { "cc 104": "url1|url2|url3", ... }
  var mainFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  var catFolders = mainFolder.getFolders();

  while (catFolders.hasNext()) {
    var catFolder = catFolders.next();
    var prodFolders = catFolder.getFolders();
    while (prodFolders.hasNext()) {
      var prodFolder = prodFolders.next();
      var prodKey    = prodFolder.getName().toLowerCase().trim();
      var urls       = [];

      // Collect JPEG + PNG files — sort by filename so 1.jpg, 2.jpg, 3.jpg come first
      var MAX_IMAGES = 3; // max images per product shown in carousel
      var allFiles = [];
      var jpgs = prodFolder.getFilesByType(MimeType.JPEG);
      while (jpgs.hasNext()) allFiles.push(jpgs.next());
      var pngs = prodFolder.getFilesByType(MimeType.PNG);
      while (pngs.hasNext()) allFiles.push(pngs.next());

      // Sort alphabetically by filename — name files 1.jpg, 2.jpg, 3.jpg to control order
      allFiles.sort(function(a, b) {
        return a.getName().toLowerCase().localeCompare(b.getName().toLowerCase());
      });

      // Take only first MAX_IMAGES files
      var selected = allFiles.slice(0, MAX_IMAGES);

      for (var f = 0; f < selected.length; f++) {
        var imgFile = selected[f];
        // Make each file publicly accessible (no Google login needed)
        try { imgFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {}
        urls.push("https://drive.google.com/thumbnail?id=" + imgFile.getId() + "&sz=w800");
      }

      if (urls.length > 0) {
        imageMap[prodKey] = urls.join("|");
      }
    }
  }

  // Match each product row — EXACT match first, then fuzzy (longer key wins to avoid CC 104 stealing CC 104-C)
  var count   = 0;
  var noMatch = [];

  for (var i = 0; i < data.length; i++) {
    var prodName = String(data[i][1] || "").trim();
    if (!prodName) continue;

    var key = prodName.toLowerCase().trim();
    var urls = imageMap[key]; // exact match

    // Fuzzy match only if no exact match found
    // Strategy: folder key must be a prefix/full match of product name (not the other way)
    // e.g. "dc 101" folder matches "dc 101" product — but NOT "dc 101 super"
    // Only fallback to contained match if absolutely no other option
    if (!urls) {
      var bestKey = "", bestScore = -1;
      for (var k in imageMap) {
        if (k === key) continue;
        // Prefer: folder name is contained in product name AND is longer (more specific)
        if (key.indexOf(k) === 0) {
          // k is a prefix of the product key — only match if remaining chars are short (≤3)
          var remaining = key.length - k.length;
          var score = k.length - remaining * 10; // penalise short folder matching long product
          if (score > bestScore) { bestScore = score; bestKey = k; }
        }
      }
      // Only use prefix match if penalty not too high (remaining chars ≤ 3)
      if (bestKey && (key.length - bestKey.length) <= 3) {
        urls = imageMap[bestKey];
      }
    }

    if (urls) {
      sheet.getRange(i + 2, 11).setValue(urls); // pipe-separated URLs
      count++;
    } else {
      noMatch.push(prodName);
    }
  }

  var msg = "✅ Done! " + count + " products mapped with images.\n";
  if (noMatch.length) {
    msg += "\n⚠️ No image found for " + noMatch.length + " products:\n" + noMatch.slice(0,15).join(", ");
    if (noMatch.length > 15) msg += "... +" + (noMatch.length - 15) + " more";
  }
  SpreadsheetApp.getUi().alert(msg);
}

// ===== PROTECT SHEET =========================================================
function protectSheetTab(sheet) {
  try {
    var existing = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (existing.length > 0) return;
    var protection = sheet.protect();
    protection.setDescription("Order data -- admin only. Do not delete rows.");
    var me = Session.getEffectiveUser();
    protection.addEditor(me);
    var editors = protection.getEditors();
    editors.forEach(function(e) {
      if (e.getEmail() !== me.getEmail()) protection.removeEditor(e);
    });
    protection.setWarningOnly(true);
  } catch(e) {}
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

// ===== FORMAT SHEET ===========================================================
function formatSheet(sheetName) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return;

  var COL_CUSTOMER = 3;
  var COL_QTY      = 7;   // col G = Total Qty (pcs)
  var COL_BUTTON   = 10;

  // Clear all formatting
  sheet.getRange(1, 1, lastRow, lastCol + 1)
       .setBackground(null).setFontColor('#000000')
       .setFontWeight('normal').setFontSize(10);

  // Remove old TOTAL / NEW ORDER rows (bottom to top)
  var allC = sheet.getRange(2, COL_CUSTOMER, lastRow - 1, 1).getValues();
  for (var r = allC.length - 1; r >= 0; r--) {
    var v = allC[r][0];
    if (typeof v === 'string' && (v.indexOf('TOTAL') !== -1 || v.indexOf('NEW ORDER') !== -1)) {
      sheet.deleteRow(r + 2);
    }
  }

  lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  // Build party groups -- one group per Order ID per customer (skip blank rows)
  var groups = [];
  var curGroupKey = null, curGroup = null;
  for (var i = 0; i < data.length; i++) {
    var cust    = data[i][COL_CUSTOMER - 1];
    var orderId = data[i][1]; // col B = Order ID
    if (!cust || String(cust).trim() === '') continue; // skip blank rows
    var groupKey = String(cust).trim() + '|' + String(orderId).trim();
    if (groupKey !== curGroupKey) {
      curGroup = { customer: String(cust).trim(), orderId: String(orderId).trim(), startRow: i + 2, count: 0 };
      groups.push(curGroup);
      curGroupKey = groupKey;
    }
    curGroup.count++;
  }

  // Detect repeat orders: same customer + same date appearing more than once
  var custDayCount = {};
  for (var g2 = 0; g2 < groups.length; g2++) {
    var grp     = groups[g2];
    var dataIdx = grp.startRow - 2; // sheet row → data array index
    var dateVal = (dataIdx >= 0 && dataIdx < data.length) ? data[dataIdx][4] : ""; // col E = index 4
    var dateStr = "";
    if (dateVal instanceof Date) {
      dateStr = dateVal.getFullYear() + "-" + (dateVal.getMonth()+1) + "-" + dateVal.getDate();
    } else {
      dateStr = String(dateVal || "").substring(0, 10);
    }
    var cdKey = String(grp.customer).trim().toLowerCase() + "|" + dateStr;
    custDayCount[cdKey] = (custDayCount[cdKey] || 0) + 1;
    grp.occurrence = custDayCount[cdKey];
  }

  // Insert TOTAL rows bottom to top
  for (var g = groups.length - 1; g >= 0; g--) {
    var info      = groups[g];
    var insertAt  = info.startRow + info.count;
    var isRepeat  = info.occurrence > 1; // 2nd, 3rd... order from same customer same day
    sheet.insertRowBefore(insertAt);

    var qtyVals  = sheet.getRange(info.startRow, COL_QTY, info.count, 1).getValues();
    var totalQty = 0;
    for (var k = 0; k < qtyVals.length; k++) {
      if (typeof qtyVals[k][0] === 'number') totalQty += qtyVals[k][0];
    }

    var label    = isRepeat
      ? '🆕 NEW ORDER -- TOTAL: ' + info.customer + ' --'
      : '-- TOTAL: ' + info.customer + ' --';
    var rowColor = isRepeat ? '#E65100' : '#FFF176'; // dark orange for repeat, yellow for first
    var txtColor = isRepeat ? '#FFFFFF' : '#000000';

    sheet.getRange(insertAt, COL_CUSTOMER).setValue(label);
    sheet.getRange(insertAt, COL_QTY).setValue(totalQty);
    sheet.getRange(insertAt, 1, 1, lastCol + 1)
         .setBackground(rowColor).setFontWeight('bold')
         .setFontSize(10).setFontColor(txtColor);
    sheet.getRange(insertAt, COL_BUTTON)
         .setValue('COPY')
         .setBackground('#1565C0').setFontColor('#FFFFFF')
         .setFontWeight('bold').setFontSize(9)
         .setHorizontalAlignment('center')
         .setNote('COPY|' + sheetName + '|' + info.customer);
  }

  // Apply alternating party colors in bulk
  var newLastRow   = sheet.getLastRow();
  var allCNew      = sheet.getRange(2, COL_CUSTOMER, newLastRow - 1, 1).getValues();
  var colors       = ['#E8F5E9', '#E3F2FD'];
  var colorIdx     = -1;
  var prevParty    = null;
  var colorBatches = [[], []];

  for (var r2 = 0; r2 < allCNew.length; r2++) {
    var cv      = allCNew[r2][0];
    var isTotal = (typeof cv === 'string' && cv.indexOf('TOTAL') !== -1);
    if (!isTotal) {
      if (cv !== prevParty) { colorIdx = (colorIdx + 1) % 2; prevParty = cv; }
      colorBatches[colorIdx].push(r2 + 2);
    }
  }

  if (colorBatches[0].length > 0) {
    sheet.getRangeList(colorBatches[0].map(function(row) {
      return sheet.getRange(row, 1, 1, lastCol).getA1Notation();
    })).setBackground(colors[0]);
  }
  if (colorBatches[1].length > 0) {
    sheet.getRangeList(colorBatches[1].map(function(row) {
      return sheet.getRange(row, 1, 1, lastCol).getA1Notation();
    })).setBackground(colors[1]);
  }

  // Header for COPY column
  sheet.getRange(1, COL_BUTTON).setValue('Copy')
       .setFontWeight('bold').setBackground('#E3F2FD').setFontColor('#000000');
  sheet.setColumnWidth(COL_BUTTON, 90);
}

function formatOrdersPartyWise() {
  formatSheet('Orders');
  formatSheet('Store Orders');
  formatSheet('Dealer Demand');
  SpreadsheetApp.getUi().alert('Done! All 3 sheets formatted.');
}

// ===== ONE-TIME FIX -- recalculate col I (Boxes) from Total Qty / Box Size =====
// Run once from Apps Script editor. For rows where box size exists: Boxes = Total / BoxSize.
function fixBoxesColumn() {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var tabNames = ['Orders', 'Store Orders', 'Dealer Demand'];
  var count    = 0;

  tabNames.forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet || sheet.getLastRow() < 2) return;

    var lastRow = sheet.getLastRow();
    var data    = sheet.getRange(2, 1, lastRow - 1, 9).getValues();

    for (var i = 0; i < data.length; i++) {
      var custVal = data[i][2];
      var isTotal = (typeof custVal === 'string' && custVal.indexOf('TOTAL') !== -1);
      if (isTotal) continue;

      var totalQty = data[i][6]; // col G = Total Qty
      var boxSize  = data[i][7]; // col H = Box Size

      var boxes = "";
      if (boxSize && Number(boxSize) > 0 && totalQty) {
        boxes = Math.round(Number(totalQty) / Number(boxSize));
      }

      sheet.getRange(i + 2, 9).setValue(boxes); // col I = Boxes
      count++;
    }

    // Update col I header to "Boxes"
    sheet.getRange(1, 9).setValue('Boxes')
         .setFontWeight('bold').setBackground('#1F1B20').setFontColor('#F7DA11');
  });

  SpreadsheetApp.getUi().alert('Done! ' + count + ' rows updated. Col I now shows No. of Boxes.');
}

// ===== ONE-TIME MIGRATION -- swap col G (Boxes) and col I (Total Qty) in existing data =====
// Run this ONCE from Apps Script editor after updating the script.
// After running, delete or ignore this function.
function migrateSwapGandI() {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var tabNames = ['Orders', 'Store Orders', 'Dealer Demand'];
  var count    = 0;

  tabNames.forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet || sheet.getLastRow() < 2) return;

    var lastRow = sheet.getLastRow();
    var data    = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
    var updates = [];

    for (var i = 0; i < data.length; i++) {
      var custVal = data[i][2]; // col C
      var isTotal = (typeof custVal === 'string' && custVal.indexOf('TOTAL') !== -1);
      if (isTotal) continue;

      var gVal = data[i][6]; // col G (currently Boxes)
      var iVal = data[i][8]; // col I (currently Total Qty)

      // Only swap if they look like old layout (G has small number = boxes, I has larger = total)
      updates.push({ row: i + 2, g: iVal, i: gVal });
    }

    updates.forEach(function(u) {
      sheet.getRange(u.row, 7).setValue(u.g); // col G = Total Qty
      sheet.getRange(u.row, 9).setValue(u.i); // col I = Boxes
      count++;
    });
  });

  formatSheet('Orders');
  formatSheet('Store Orders');
  formatSheet('Dealer Demand');
  SpreadsheetApp.getUi().alert('Migration done! ' + count + ' rows updated. G = Total Qty, I = Boxes.');
}

// ===== COPY SIDEBAR ===========================================================
// Core function -- builds and shows the sidebar with Product + Total Qty only.
// Called both from the menu (copySelectedParty) and from the click trigger.
function showCopySidebar(sheetName, partyName) {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var srcSheet = ss.getSheetByName(sheetName);
  if (!srcSheet) return;

  var lastRow = srcSheet.getLastRow();
  if (lastRow < 2) return;

  // Read columns A-I (9 cols). We only use col F (index 5) = Product, col I (index 8) = Total Qty
  var allData = srcSheet.getRange(2, 1, lastRow - 1, 9).getValues();
  var lines   = [];

  for (var i = 0; i < allData.length; i++) {
    var cust    = allData[i][2];  // col C = Customer
    var isTotal = (typeof cust === 'string' && cust.indexOf('TOTAL') !== -1);
    if (!isTotal && String(cust).trim() === String(partyName).trim()) {
      var product = allData[i][5];  // col F = Product name
      var qty     = allData[i][6];  // col G = Total Qty (pcs)
      if (product !== '' && product !== null && product !== undefined) {
        lines.push(product + '\t' + (qty || 0));
      }
    }
  }

  if (!lines.length) return;

  var copyText = lines.join('\n');
  var escaped  = copyText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var partyEsc = partyName.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var sheetEsc = sheetName.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  var html = HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><style>' +
    'body{font-family:Arial,sans-serif;padding:14px;margin:0;font-size:13px}' +
    'h3{color:#1565C0;margin:0 0 2px;font-size:14px;word-break:break-word}' +
    '.sub{color:#666;font-size:11px;margin:0 0 10px}' +
    'textarea{width:100%;height:300px;font-size:12px;font-family:monospace;' +
    'border:2px solid #1565C0;padding:6px;box-sizing:border-box;resize:none;background:#f8f9fa}' +
    '.btn{width:100%;background:#1565C0;color:#fff;border:none;padding:12px;' +
    'font-size:13px;font-weight:bold;border-radius:5px;cursor:pointer;margin-top:10px;display:block}' +
    '.ok{display:none;color:#2e7d32;font-weight:bold;text-align:center;' +
    'margin-top:10px;padding:8px;background:#e8f5e9;border-radius:4px}' +
    '.hint{color:#999;font-size:10px;text-align:center;margin-top:6px}' +
    '</style></head><body>' +
    '<h3>' + partyEsc + '</h3>' +
    '<p class="sub">' + sheetEsc + ' &nbsp;·&nbsp; <b>' + lines.length + ' items</b></p>' +
    '<textarea id="t" readonly>' + escaped + '</textarea>' +
    '<button class="btn" onclick="doCopy()">Copy All -- then Ctrl+V in ERP</button>' +
    '<div class="ok" id="ok">Copied! Go to ERP and press Ctrl+V</div>' +
    '<p class="hint">Format: Product Name [Tab] Total Qty</p>' +
    '<script>' +
    'function doCopy(){' +
    'var t=document.getElementById("t");t.select();' +
    'document.execCommand("copy");' +
    'document.querySelector(".btn").style.background="#2e7d32";' +
    'document.querySelector(".btn").textContent="Copied! Paste in ERP with Ctrl+V";' +
    'document.getElementById("ok").style.display="block";}' +
    'window.onload=function(){document.getElementById("t").focus();document.getElementById("t").select();};' +
    '<\/script></body></html>'
  ).setTitle(partyName).setWidth(340);

  SpreadsheetApp.getUi().showSidebar(html);
}

// Menu entry point -- validates that a COPY cell is selected, then opens sidebar
function copySelectedParty() {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var cell = ss.getActiveSheet().getActiveCell();
  if (cell.getColumn() !== 10) {
    SpreadsheetApp.getUi().alert('First click the blue COPY cell on a yellow TOTAL row.');
    return;
  }
  var note = cell.getNote();
  if (!note || note.indexOf('COPY|') !== 0) {
    SpreadsheetApp.getUi().alert('Please click a blue COPY cell on a yellow TOTAL row.');
    return;
  }
  var parts = note.split('|');
  showCopySidebar(parts[1], parts[2]);
}

// ===== ON SELECTION CHANGE ====================================================
// Clicking a COPY cell directly opens the sidebar -- no menu needed.
// Installed as a trigger via setupTriggers().
function onSelectionChangeTrigger(e) {
  try {
    var sheet = e.range.getSheet();
    var name  = sheet.getName();
    if (name !== 'Orders' && name !== 'Store Orders' && name !== 'Dealer Demand') return;
    // Only single cell in col J
    if (e.range.getColumn() !== 10 || e.range.getNumRows() > 1 || e.range.getNumColumns() > 1) return;
    var note = e.range.getNote();
    if (!note || note.indexOf('COPY|') !== 0) return;
    var parts = note.split('|');
    showCopySidebar(parts[1], parts[2]);
  } catch(err) {}
}

// ===== AUTO FORMAT on order submission ========================================
function onFormSubmitTrigger(e) {
  var sheetName = e.range.getSheet().getName();
  if (sheetName === 'Orders' || sheetName === 'Store Orders' || sheetName === 'Dealer Demand') {
    formatSheet(sheetName);
  }
}

// ===== SETUP TRIGGERS -- run once =============================================
function setupTriggers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var fn = t.getHandlerFunction();
    if (fn === 'onFormSubmitTrigger' || fn === 'onSelectionChangeTrigger') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('onFormSubmitTrigger').forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger('onSelectionChangeTrigger').forSpreadsheet(ss).onSelectionChange().create();
  SpreadsheetApp.getUi().alert('Triggers installed! Click any COPY cell to copy order instantly.');
}

// ===== ORDER LOGGER ===========================================================
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
    .setValue("ROBOTEK -- Sales Contact Directory")
    .setBackground("#E52D31").setFontColor("#FFFFFF")
    .setFontWeight("bold").setFontSize(13).setHorizontalAlignment("center");
}

function setupAnalytics(ss) {
  var name = "Demand Analytics";
  if (ss.getSheetByName(name)) return;
  var a = ss.insertSheet(name);
  a.getRange("A1").setValue("YOUR TEAM ORDERS -- Top Products");
  a.getRange("A1:C1").merge().setBackground("#E52D31").setFontColor("#fff").setFontWeight("bold");
  a.getRange("A2:C2").setValues([["Product","Times Ordered","Total Boxes"]]);
  a.getRange("A2:C2").setBackground("#1F1B20").setFontColor("#F7DA11").setFontWeight("bold");
  a.getRange("A3").setValue("Run a few orders first, then use Data -> Pivot Table on the Orders tab");
  a.getRange("A3:C3").merge().setFontColor("#999").setFontStyle("italic");
  a.getRange("E1").setValue("DEALER DEMAND -- Top Products");
  a.getRange("E1:G1").merge().setBackground("#1a237e").setFontColor("#fff").setFontWeight("bold");
  a.getRange("E2:G2").setValues([["Product","Times Ordered","Total Boxes"]]);
  a.getRange("E2:G2").setBackground("#1F1B20").setFontColor("#F7DA11").setFontWeight("bold");
  a.getRange("E3").setValue("Run a few dealer orders, then pivot on 'Dealer Demand' tab");
  a.getRange("E3:G3").merge().setFontColor("#999").setFontStyle("italic");
  a.getRange("A7").setValue("QUICK COUNTS").setFontWeight("bold");
  a.getRange("A8:B8").setValues([["Total HO orders:",      '=COUNTA(Orders!B2:B)']]);
  a.getRange("A9:B9").setValues([["Total Dealer orders:",  '=COUNTA(\'Dealer Demand\'!B2:B)']]);
  a.getRange("A10:B10").setValues([["Total Store orders:", '=COUNTA(\'Store Orders\'!B2:B)']]);
  [1,2,3,4,5,6,7].forEach(function(w,i){a.setColumnWidth(i+1,i<3||i===4?220:i===3?30:140);});
  a.setFrozenRows(2);
}

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
  var source = data.tag || "Orders";
  var rows = enqs.map(function(p) {
    return [ts, orderId, data.customer||"", "'"+(data.phone||""), data.date||"", p, source];
  });
  sheet.getRange(sheet.getLastRow()+1, 1, rows.length, ENQ_HEADER.length).setValues(rows);
}

// ===== RESTOCK NOTIFY =========================================================
function handleRestockNotify(products) {
  if (!products || !products.length) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var enqSheet = ss.getSheetByName("Enquiries");
  if (!enqSheet || enqSheet.getLastRow() < 2) {
    Logger.log("Restock notify: Enquiries tab empty -- nothing to do");
    return;
  }

  var data = enqSheet.getRange(2, 1, enqSheet.getLastRow()-1, 7).getValues();
  var scByTag = {};
  SC_DIR.forEach(function(sc) { scByTag[sc.tag] = sc; });

  // Build category lookup -- products can be strings (old) or {name, category} objects (new)
  var catByName = {};
  products.forEach(function(p) {
    if (typeof p === "object") catByName[p.name] = p.category || "";
    else catByName[p] = "";
  });

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
      var pName = typeof p === "object" ? p.name : p;
      return pName.toLowerCase() === product.toLowerCase();
    });
    if (!isRestocked) continue;

    var key = phone + "|" + product;
    if (seen[key]) continue;
    seen[key] = true;

    if (!byTag[source]) byTag[source] = [];
    byTag[source].push({ customer: customer, phone: phone, product: product, enqDate: enqDate, category: catByName[product] || "" });
  }

  var tags = Object.keys(byTag);
  if (!tags.length) {
    Logger.log("Restock notify: no matching enquiries for: " + products.join(", "));
    return;
  }

  tags.forEach(function(tag) {
    var groupEnquiries = byTag[tag];
    var sc             = scByTag[tag];
    var crmContact     = sc || scByTag["Orders"];
    var crmRecipients  = crmContact ? [{ name: crmContact.name, phone: crmContact.wa }] : [];

    Logger.log("Restock notify [" + tag + "]: " + groupEnquiries.length + " customer(s)");

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

// ===== NEW PRODUCT NOTIFY =====================================================
function handleNewProductNotify(products) {
  if (!products || !products.length) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- Dedup: skip products already notified within the last 24 hours ---
  // Prevents multiple devices triggering the same notification.
  var dedupSheet = ss.getSheetByName("Restock Alerts");
  var alreadySent = {};
  if (dedupSheet && dedupSheet.getLastRow() > 1) {
    var dedupData = dedupSheet.getRange(2, 1, dedupSheet.getLastRow() - 1, 6).getValues();
    var now = new Date().getTime();
    var H24 = 24 * 60 * 60 * 1000;
    dedupData.forEach(function(row) {
      var ts     = row[0]; // Timestamp col
      var prod   = String(row[1] || "").trim();
      var status = String(row[5] || "").trim();
      if (status === "new_product_sent" && ts && (now - new Date(ts).getTime()) < H24) {
        alreadySent[prod.toLowerCase()] = true;
      }
    });
  }
  var freshProducts = products.filter(function(p) {
    var pName = typeof p === "object" ? p.name : p;
    return !alreadySent[pName.toLowerCase()];
  });
  if (!freshProducts.length) {
    Logger.log("New product notify: all products already notified in last 24h -- skipping");
    return;
  }
  products = freshProducts;
  // --- End dedup ---

  var tabToTag = {
    "Orders":        "Orders",
    "Store Orders":  "Store Orders",
    "Dealer Demand": "Dealer Demand"
  };

  var scByTag = {};
  SC_DIR.forEach(function(sc) { scByTag[sc.tag] = sc; });

  var seen  = {};
  var byTag = {};

  Object.keys(tabToTag).forEach(function(tabName) {
    var tag   = tabToTag[tabName];
    var sheet = ss.getSheetByName(tabName);
    if (!sheet || sheet.getLastRow() < 2) return;

    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
    rows.forEach(function(row) {
      var customer = String(row[2] || "").trim();
      var phone    = String(row[3] || "").trim().replace(/^'/, "");
      if (!phone) return;

      // Global dedup by phone -- same customer across multiple sheets gets only ONE message
      var key = phone;
      if (seen[key]) return;
      seen[key] = true;

      if (!byTag[tag]) byTag[tag] = [];
      products.forEach(function(p) {
        var pName = typeof p === "object" ? p.name : p;
        var pCat  = typeof p === "object" ? (p.category || "") : "";
        byTag[tag].push({ customer: customer, phone: phone, product: pName, enqDate: "", category: pCat });
      });
    });
  });

  var tags = Object.keys(byTag);
  if (!tags.length) {
    Logger.log("New product notify: no past customers found");
    return;
  }

  tags.forEach(function(tag) {
    var groupEnquiries = byTag[tag];
    var sc             = scByTag[tag];
    var crmContact     = sc || scByTag["Orders"];
    var crmRecipients  = crmContact ? [{ name: crmContact.name, phone: crmContact.wa }] : [];

    Logger.log("New product notify [" + tag + "]: " + groupEnquiries.length + " notification(s)");

    try {
      var payload = JSON.stringify({
        notifyType:    "new_product",
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
      Logger.log("FinOS new-product [" + tag + "] response " + code + ": " + result);
      logRestockAlert(ss, products, groupEnquiries, code === 200 ? "new_product_sent" : "error:" + code);
    } catch(err) {
      Logger.log("New product notify [" + tag + "] error: " + String(err));
    }
  });
}

// ===== doPost =================================================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss   = SpreadsheetApp.getActiveSpreadsheet();

    if (data.type === "restock_notify") {
      if (WA_ALERTS_ENABLED) handleRestockNotify(data.products || []);
      return json({ ok: true, type: "restock_notify", alerts_enabled: WA_ALERTS_ENABLED });
    }

    if (data.type === "new_product_notify") {
      if (WA_ALERTS_ENABLED) handleNewProductNotify(data.products || []);
      return json({ ok: true, type: "new_product_notify", alerts_enabled: WA_ALERTS_ENABLED });
    }

    var tabName = (data.tag && data.tag.trim()) ? data.tag.trim() : "Orders";
    var sheet   = getSheet(ss, tabName);

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
              it.name||"", total, boxSize, boxes];  // G=Total Qty, H=Box Size, I=Boxes
    });

    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow()+1, 1, rows.length, HEADER.length).setValues(rows);
    }

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

// ===== doGet ==================================================================
function doGet(e) {
  if (e && e.parameter && e.parameter.setup === "1") {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    setupDirectory(ss);
    getSheet(ss, "Orders");
    getSheet(ss, "Store Orders");
    getSheet(ss, "Dealer Demand");
    setupAnalytics(ss);
    return ContentService.createTextOutput(
      "All tabs ready: SC Directory, Orders, Store Orders, Dealer Demand, Enquiries, Demand Analytics"
    );
  }
  return ContentService.createTextOutput("Robotek order logger v6 -- running.");
}
