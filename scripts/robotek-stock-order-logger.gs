/**
 * ROBOTEK — Order Logger (Google Apps Script web app)
 * Logs every order placed in the app into an "Orders" tab of your spreadsheet.
 *
 * SETUP (one time, ~2 min):
 * 1. Open your stock Google Sheet → Extensions → Apps Script.
 * 2. Delete anything there, paste THIS whole file, click Save.
 * 3. Click Deploy → New deployment → type "Web app".
 *      - Description: Robotek order logger
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    Click Deploy, authorize when asked, then COPY the Web app URL.
 * 4. Paste that URL into index.html CONFIG.ORDER_LOG_URL.
 * Re-deploy (Deploy → Manage deployments → Edit → New version) whenever you change this file.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Orders");
    if (!sheet) {
      sheet = ss.insertSheet("Orders");
      sheet.appendRow(["Timestamp", "Customer", "Phone", "Order Date", "Items", "Item Count"]);
    }
    var items = (data.items || []).map(function (it) {
      return it.name + " — " + it.qty + (it.boxSize ? " (Bx:" + it.boxSize + "/box)" : "");
    });
    sheet.appendRow([
      new Date(),
      data.customer || "",
      data.phone || "",
      data.date || "",
      items.join("\n"),
      items.length
    ]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput("Robotek order logger is running.");
}
