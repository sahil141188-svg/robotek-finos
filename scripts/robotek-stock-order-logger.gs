/**
 * ROBOTEK — Order Logger (Google Apps Script web app)  — v2
 * Logs every order into an "Orders" tab, ONE ROW PER ITEM, with separate
 * Boxes / Box Size / Total Qty columns so it's easy to copy into Busy.
 *
 * TO UPDATE (you already deployed v1):
 * 1. Sheet → Extensions → Apps Script. Select all, delete, paste THIS, Save.
 * 2. Deploy → Manage deployments → ✎ (edit) → Version: "New version" → Deploy.
 *    (The web-app URL stays the same — no need to re-send it.)
 *
 * Columns: Timestamp | Order ID | Customer | Phone | Order Date | Product | Boxes | Box Size | Total Qty (pcs)
 */

var HEADER = ["Timestamp", "Order ID", "Customer", "Phone", "Order Date",
              "Product", "Boxes", "Box Size", "Total Qty (pcs)"];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Orders");
    if (!sheet) sheet = ss.insertSheet("Orders");

    // Ensure the header matches v2; if it's empty or the old layout, reset it.
    var needHeader = sheet.getLastRow() === 0;
    if (!needHeader) {
      var first = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (first.length !== HEADER.length || first[1] !== "Order ID") {
        sheet.clear();        // clears the old v1 test data + header
        needHeader = true;
      }
    }
    if (needHeader) {
      sheet.appendRow(HEADER);
      sheet.setFrozenRows(1);
    }

    var ts = new Date();
    var orderId = "ORD-" + ts.getTime().toString(36).toUpperCase();
    var items = data.items || [];
    if (!items.length) {
      return json({ ok: false, error: "no items" });
    }

    var rows = items.map(function (it) {
      var boxes = Number(it.boxes) || 0;
      var boxSize = (it.boxSize === "" || it.boxSize == null) ? "" : Number(it.boxSize);
      var total = (boxSize && boxes) ? boxes * boxSize : (it.totalQty || "");
      return [ts, orderId, data.customer || "", "'" + (data.phone || ""), data.date || "",
              it.name || "", boxes, boxSize, total];
    });

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADER.length).setValues(rows);
    return json({ ok: true, orderId: orderId, lines: rows.length });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput("Robotek order logger v2 is running.");
}
