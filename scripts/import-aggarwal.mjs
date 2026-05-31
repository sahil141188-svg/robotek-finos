/**
 * Import Aggarwal Enterprise files:
 *   1. DayBook.xlsx (1 Apr - 31 May 2026) - Busy Accounting Day Book
 *   2. agg april.xls - IDBI bank statement Apr 2026
 *   3. agg may.xls   - IDBI bank statement May 2026
 *
 * Data is inlined as parsed structures (sourced from Drive MCP tool).
 *
 * Company: Aggarwal Enterprise (3593c0c5-2406-4ed2-9cf5-aa13ddb7cec9)
 * Bank: IDBI Bank 1009102000012050 (AGGARWAL ENTERPRISE)
 *
 * Run: node --env-file=.env.local scripts/import-aggarwal.mjs
 */

import { createClient } from "@supabase/supabase-js";

const COMPANY_ID = "3593c0c5-2406-4ed2-9cf5-aa13ddb7cec9";
const UPLOADER   = "4779e17f-3e47-4fdd-ac44-90f0df13c16e";
const FY         = "2026-27";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const inPaisa = (n) => Math.round(Number(n || 0) * 100);

async function createImport(file_name, file_type, module_name) {
  const { data, error } = await db.from("file_imports").insert({
    file_name, file_type, module: module_name,
    uploaded_by: UPLOADER, company_id: COMPANY_ID,
    status: "processing", financial_year: FY,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function finishImport(id, rows_imported) {
  await db.from("file_imports").update({
    status: "completed", rows_imported,
    completed_at: new Date().toISOString(),
  }).eq("id", id);
}

async function insertBatched(table, rows, size = 500) {
  if (!rows.length) return 0;
  let n = 0;
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size);
    const { error } = await db.from(table).insert(batch);
    if (error) throw new Error(`${table}: ${error.message}`);
    n += batch.length;
  }
  return n;
}

// ─── BANK STATEMENT DATA ────────────────────────────────────────────────────
// IDBI Bank 1009102000012050 — AGGARWAL ENTERPRISE
// Format: [srl, txnDate, valueDate, description, chequeNo|null, "Cr"|"Dr", amount, balance]
// Source is reverse-chronological; sorted ascending by srl DESC for chronological order.

const IDBI_APRIL = [
  [1,  "2026-04-30", "2026-04-30", "IPAY/INST/RTGS/0077216054310/9810504008/ROBOTEK LLP",          null, "Dr", 200000.00,    511956.77],
  [2,  "2026-04-29", "2026-04-29", "NEFT-DEUTH026119A2226-FLIPKART INTERNET PRIVATE LI",            null, "Cr",   3531.67,    711956.77],
  [3,  "2026-04-29", "2026-04-29", "NEFT-DEUTH026119A1QU2-FLIPKART INTERNET PRIVATE LI",            null, "Cr",   1606.07,    708425.10],
  [4,  "2026-04-28", "2026-04-28", "NEFT-AXISP00791532816-DELHIVERY  LIMITED",                       null, "Cr",    788.00,    706819.03],
  [5,  "2026-04-28", "2026-04-28", "IPAY/ESHP//772057713/260428001493351/CBDT",                      null, "Dr",    500.00,    706031.03],
  [6,  "2026-04-27", "2026-04-27", "UPI/611717109505/Y R ELECTRICALS",                              null, "Cr",  16992.00,    706531.03],
  [7,  "2026-04-27", "2026-04-27", "NEFT-DEUTH026117195200-FLIPKART INTERNET PRIVATE LI",           null, "Cr",    971.18,    689539.03],
  [8,  "2026-04-27", "2026-04-27", "NEFT-DEUTH026117202270-FLIPKART INTERNET PRIVATE LI",           null, "Cr",   4674.49,    688567.85],
  [9,  "2026-04-26", "2026-04-26", "NEFT-KVBLH0026016049000-RAJENDRA MOBILE ACC",                   null, "Cr",   6443.00,    683893.36],
  [10, "2026-04-25", "2026-04-25", "UPI/197472930886/HOLLYWOOD ENTERPRISES",                        null, "Cr",  17039.00,    677450.36],
  [11, "2026-04-24", "2026-04-24", "NEFT-DEUTH026114603830-FLIPKART INTERNET PRIVATE LI",           null, "Cr",   3144.09,    660411.36],
  [12, "2026-04-24", "2026-04-24", "NEFT-DEUTH026114585520-FLIPKART INTERNET PRIVATE LI",           null, "Cr",   1852.35,    657267.27],
  [13, "2026-04-23", "2026-04-23", "SBINR12026042325333128 M S MODERN TECH",                        null, "Cr", 264964.00,    655414.92],
  [14, "2026-04-23", "2026-04-23", "IPAY/ESHP/BILLDESK PGI-C/803452583/YIDC269213218",              null, "Dr",  13162.12,    390450.92],
  [15, "2026-04-22", "2026-04-22", "NEFT-DEUTH026112328320-FLIPKART INTERNET PRIVATE LI",           null, "Cr",   1578.45,    403613.04],
  [16, "2026-04-22", "2026-04-22", "NEFT-DEUTH026112287020-FLIPKART INTERNET PRIVATE LI",           null, "Cr",   2205.61,    402034.59],
  [17, "2026-04-20", "2026-04-20", "UPI/078361675923/HOLLYWOOD ENTERPRISES",                        null, "Cr",  85000.00,    399828.98],
  [18, "2026-04-20", "2026-04-20", "NEFT-AXISP00789805906-DELHIVERY  LIMITED",                      null, "Cr",   2228.00,    314828.98],
  [19, "2026-04-20", "2026-04-20", "IPAY/ESHP//771747125/260407002900390/GSTN",                     null, "Dr", 1575652.00,   312600.98],
  [20, "2026-04-20", "2026-04-20", "INET/1009102000011811To1009102000012050/",                      null, "Cr", 1500000.00,  1888252.98],
  [21, "2026-04-20", "2026-04-20", "SMS_CHARGE_FOR_JAN26_TO_MAR26",                                  null, "Dr",     82.02,    388252.98],
  [22, "2026-04-20", "2026-04-20", "NEFT-DEUTH026110475140-FLIPKART INTERNET PRIVATE LI",           null, "Cr",   5335.80,    388335.00],
  [23, "2026-04-20", "2026-04-20", "NEFT-DEUTH026110417800-FLIPKART INTERNET PRIVATE LI",           null, "Cr",    631.38,    382999.20],
  [24, "2026-04-17", "2026-04-17", "NEFT-AXISP00789177423-DELHIVERY  LIMITED",                      null, "Cr",    378.00,    382367.82],
  [25, "2026-04-16", "2026-04-16", "NEFT-HDFCH009381560011-IERA INDUSTRY",                          null, "Cr",  20650.00,    381989.82],
  [26, "2026-04-16", "2026-04-16", "NEFT-BARBS261068899050-SWASTIK MOBILE ACCESSORIES",             null, "Cr",  49000.00,    361339.82],
  [27, "2026-04-16", "2026-04-16", "NEFT-HDFCH009373681420-BURHAN COMMUNICATION",                   null, "Cr",  32500.00,    312339.82],
  [28, "2026-04-16", "2026-04-16", "NEFT-AXISP00788871992-DELHIVERY  LIMITED",                      null, "Cr",    328.00,    279839.82],
  [29, "2026-04-16", "2026-04-16", "UPI/109614736559/MANICKARAJ P",                                 null, "Cr",      1.00,    279511.82],
  [30, "2026-04-15", "2026-04-15", "NEFT-DEUTH026105340430-FLIPKART INTERNET PRIVATE LI",           null, "Cr",   4322.39,    279510.82],
  [31, "2026-04-13", "2026-04-13", "NEFT-AXISP00787905602-DELHIVERY  LIMITED",                      null, "Cr",    229.00,    275188.43],
  [32, "2026-04-13", "2026-04-13", "NEFT-DEUTH026103A1EO6-FLIPKART INTERNET PRIVATE LI",            null, "Cr",   2995.10,    274959.43],
  [33, "2026-04-10", "2026-04-10", "NEFT-KVBLH00259228943-RAJENDRA MOBILE ACC",                     null, "Cr",   6160.00,    271964.33],
  [34, "2026-04-08", "2026-04-08", "NEFT-AXISP00786976182-DELHIVERY  LIMITED",                      null, "Cr",    360.00,    265804.33],
  [35, "2026-04-08", "2026-04-08", "NEFT-DEUTH026098402230-FLIPKART INTERNET PRIVATE LI",           null, "Cr",   1112.00,    265444.33],
  [36, "2026-04-08", "2026-04-08", "NEFT-DEUTH026098373580-FLIPKART INTERNET PRIVATE LI",           null, "Cr",    658.45,    264332.33],
  [37, "2026-04-07", "2026-04-07", "IPAY/ESHP//771184033/260407000406270/CBDT",                     null, "Dr",   4334.00,    263673.88],
  [38, "2026-04-07", "2026-04-07", "IPAY/ESHP//771183803/260407000383260/CBDT",                     null, "Dr",  10000.00,    268007.88],
  [39, "2026-04-06", "2026-04-06", "INET/1009102000012050To1009102000011811/",                      null, "Dr", 500000.00,    278007.88],
  [40, "2026-04-06", "2026-04-06", "NEFT-DEUTH026096264660-FLIPKART INTERNET PRIVATE LI",           null, "Cr",   4909.28,    778007.88],
  [41, "2026-04-06", "2026-04-06", "NEFT-DEUTH026096239290-FLIPKART INTERNET PRIVATE LI",           null, "Cr",    683.93,    773098.60],
  [42, "2026-04-02", "2026-04-02", "NEFT-AXISP00784773619-DELHIVERY  LIMITED",                      null, "Cr",    328.00,    772414.67],
];

const IDBI_MAY = [
  [1,  "2026-05-27", "2026-05-27", "NEFT-IN426147569499260-MITTAL ENTERPRISE",                       null, "Cr",   1164.00,     71821.87],
  [2,  "2026-05-27", "2026-05-27", "NEFT-IDIBH1474368475 3-JAMIDARA AUTO ELECTRIC SERVI",            null, "Cr",   8549.00,     70657.87],
  [3,  "2026-05-27", "2026-05-27", "NEFT-DEUTH026147488530-FLIPKART INTERNET PRIVATE LI",            null, "Cr",   5950.11,     62108.87],
  [4,  "2026-05-25", "2026-05-25", "NEFT-DEUTH026145A0QKJ-FLIPKART INTERNET PRIVATE LI",             null, "Cr",   5050.83,     56158.76],
  [5,  "2026-05-25", "2026-05-25", "NEFT-DEUTH026145A0EUF-FLIPKART INTERNET PRIVATE LI",             null, "Cr",   2912.52,     51107.93],
  [6,  "2026-05-23", "2026-05-23", "INET/1009102000012050To1009102000011811/",                       null, "Dr",  50000.00,     48195.41],
  [7,  "2026-05-22", "2026-05-22", "NEFT-DEUTH026142863410-FLIPKART INTERNET PRIVATE LI",            null, "Cr",    143.81,     98195.41],
  [8,  "2026-05-22", "2026-05-22", "NEFT-DEUTH026142767940-FLIPKART INTERNET PRIVATE LI",            null, "Cr",    157.66,     98051.60],
  [9,  "2026-05-21", "2026-05-21", "NEFT-AXISP00800237447-DELHIVERY  LIMITED",                       null, "Cr",   1234.00,     97893.94],
  [10, "2026-05-21", "2026-05-21", "NEFT-BARBY26141094212-PARKASH DISTRIBUTORS",                     null, "Cr",  27398.00,     96659.94],
  [11, "2026-05-20", "2026-05-20", "NEFT-AXISP00799941914-DELHIVERY  LIMITED",                       null, "Cr",    831.00,     69261.94],
  [12, "2026-05-20", "2026-05-20", "NEFT-DEUTH026140A18AR-FLIPKART INTERNET PRIVATE LI",             null, "Cr",   3030.61,     68430.94],
  [13, "2026-05-20", "2026-05-20", "NEFT-DEUTH026140A13C3-FLIPKART INTERNET PRIVATE LI",             null, "Cr",   1007.41,     65400.33],
  [14, "2026-05-20", "2026-05-20", "IPAY/ESHP//773016303/260507002413870/GSTN",                      null, "Dr", 199586.00,     64392.92],
  [15, "2026-05-20", "2026-05-20", "INET/1009102000011811To1009102000012050/",                       null, "Cr", 150000.00,    263978.92],
  [16, "2026-05-19", "2026-05-19", "IPAY/ESHP/PayU Payments /804867705/286646238893",                null, "Dr",   5123.00,    113978.92],
  [17, "2026-05-18", "2026-05-18", "NEFT-DEUTH026138538650-FLIPKART INTERNET PRIVATE LI",            null, "Cr",   2136.23,    119101.92],
  [18, "2026-05-18", "2026-05-18", "NEFT-DEUTH026138484390-FLIPKART INTERNET PRIVATE LI",            null, "Cr",   1085.87,    116965.69],
  [19, "2026-05-17", "2026-05-17", "UPI/306310828871/MS PANKAJ KUMAR",                               null, "Cr",   6880.00,    115879.82],
  [20, "2026-05-16", "2026-05-16", "NEFT-AXISP00799266525-DELHIVERY  LIMITED",                       null, "Cr",    228.00,    108999.82],
  [21, "2026-05-15", "2026-05-15", "NEFT-HDFCH01002739020-A S ELECTRONICS",                          null, "Cr",  27000.00,    108771.82],
  [22, "2026-05-15", "2026-05-15", "INET/1009102000012050To1009102000011811/",                       null, "Dr", 600000.00,     81771.82],
  [23, "2026-05-15", "2026-05-15", "NEFT-DEUTH026135536440-FLIPKART INTERNET PRIVATE LI",            null, "Cr",   1554.68,    681771.82],
  [24, "2026-05-15", "2026-05-15", "NEFT-DEUTH026135487160-FLIPKART INTERNET PRIVATE LI",            null, "Cr",    866.73,    680217.14],
  [25, "2026-05-14", "2026-05-14", "YESBR1202605140004549 RALAVA MOBILE CARE PROP C L",              null, "Cr", 250000.00,    679350.41],
  [26, "2026-05-13", "2026-05-13", "YESBR12026051300047900 RALAVA MOBILE CARE PROP C L",             null, "Cr", 350000.00,    429350.41],
  [27, "2026-05-13", "2026-05-13", "NEFT-DEUTH026133357220-FLIPKART INTERNET PRIVATE LI",            null, "Cr",   5996.34,     79350.41],
  [28, "2026-05-13", "2026-05-13", "NEFT-DEUTH026133309890-FLIPKART INTERNET PRIVATE LI",            null, "Cr",   1088.52,     73354.07],
  [29, "2026-05-12", "2026-05-12", "NEFT-AXISP00797979538-DELHIVERY  LIMITED",                       null, "Cr",   1234.00,     72265.55],
  [30, "2026-05-11", "2026-05-11", "NEFT-DEUTH026131321690-FLIPKART INTERNET PRIVATE LI",            null, "Cr",   4443.09,     71031.55],
  [31, "2026-05-08", "2026-05-08", "NEFT-DEUTH026128381780-FLIPKART INTERNET PRIVATE LI",            null, "Cr",   2033.30,     66588.46],
  [32, "2026-05-07", "2026-05-07", "INET/1009102000012050To1009102000011811/",                       null, "Dr", 1000000.00,    64555.16],
  [33, "2026-05-06", "2026-05-06", "NEFT-AXISP00795931459-DELHIVERY  LIMITED",                       null, "Cr",   1406.00,   1064555.16],
  [34, "2026-05-06", "2026-05-06", "ICICR42026050600570989 YATI INFOTECH SOLUTION PRIV",             null, "Cr", 1000000.00,   1063149.16],
  [35, "2026-05-06", "2026-05-06", "INET/1009102000012050To1009102000011811/",                       null, "Dr", 500000.00,     63149.16],
  [36, "2026-05-06", "2026-05-06", "NEFT-DEUTH026126370360-FLIPKART INTERNET PRIVATE LI",            null, "Cr",   1387.14,    563149.16],
  [37, "2026-05-06", "2026-05-06", "NEFT-DEUTH026126383080-FLIPKART INTERNET PRIVATE LI",            null, "Cr",   3485.35,    561762.02],
  [38, "2026-05-04", "2026-05-04", "NEFT-DEUTH026124231050-FLIPKART INTERNET PRIVATE LI",            null, "Cr",   4213.54,    558276.67],
  [39, "2026-05-04", "2026-05-04", "NEFT-DEUTH026124207440-FLIPKART INTERNET PRIVATE LI",            null, "Cr",   1062.36,    554063.13],
  [40, "2026-05-01", "2026-05-01", "NEFT-IN426121563402 61-MITTAL ENTERPRISE",                       null, "Cr",  41044.00,    553000.77],
];

// ─── DAY BOOK DATA ──────────────────────────────────────────────────────────
// Each voucher → multiple ledger lines (header line + GST/Purchase/Sales/RoundedOff).
// Format: [date, vchType, vchNo, ledgerName, debit, credit, narration]

const DAYBOOK = [
  // 01-Apr  Rcpt 6
  ["2026-04-01","Rcpt","6","Rajendra Mobile Accessories",0,3847,null],
  ["2026-04-01","Rcpt","6","IDBI BANK",3847,0,null],
  // 02-Apr  SupI GST/12
  ["2026-04-02","SupI","GST/12/2026-27","Robotek LLP (HR)",0,89995,null],
  ["2026-04-02","SupI","GST/12/2026-27","Purchase",76470,0,null],
  ["2026-04-02","SupI","GST/12/2026-27","Rounded Off",0,0.40,null],
  ["2026-04-02","SupI","GST/12/2026-27","IGST",13525.40,0,null],
  // SupI GST/18
  ["2026-04-02","SupI","GST/18/2026-27","Robotek LLP (HR)",0,10325,null],
  ["2026-04-02","SupI","GST/18/2026-27","Purchase",8750,0,null],
  ["2026-04-02","SupI","GST/18/2026-27","IGST",1575,0,null],
  // Rcpt 1
  ["2026-04-02","Rcpt","1","Unregisterd Dealer",0,328,"DELHIVERY LIMITED"],
  ["2026-04-02","Rcpt","1","IDBI BANK",328,0,null],
  // 03-Apr  SupI GST/30
  ["2026-04-03","SupI","GST/30/2026-27","Robotek LLP (HR)",0,98578,null],
  ["2026-04-03","SupI","GST/30/2026-27","Purchase",84626,0,null],
  ["2026-04-03","SupI","GST/30/2026-27","Rounded Off",0,0.31,null],
  ["2026-04-03","SupI","GST/30/2026-27","IGST",13952.31,0,null],
  // SupO GST/001
  ["2026-04-03","SupO","GST/001/2026-27","M/S Jay Amey Electronics",4375,0,null],
  ["2026-04-03","SupO","GST/001/2026-27","Sales",0,3707.88,null],
  ["2026-04-03","SupO","GST/001/2026-27","IGST",0,667.42,null],
  ["2026-04-03","SupO","GST/001/2026-27","Rounded Off",0.30,0,null],
  // SupO GST/002
  ["2026-04-03","SupO","GST/002/2026-27","KISHORE MOBILE",11437,0,null],
  ["2026-04-03","SupO","GST/002/2026-27","Sales",0,9692.16,null],
  ["2026-04-03","SupO","GST/002/2026-27","IGST",0,1744.59,null],
  ["2026-04-03","SupO","GST/002/2026-27","Rounded Off",0,0.25,null],
  // 04-Apr  SupI GST/42
  ["2026-04-04","SupI","GST/42/2026-27","Robotek LLP (HR)",0,23329,null],
  ["2026-04-04","SupI","GST/42/2026-27","Purchase",19770,0,null],
  ["2026-04-04","SupI","GST/42/2026-27","Rounded Off",0.40,0,null],
  ["2026-04-04","SupI","GST/42/2026-27","IGST",3558.60,0,null],
  // 06-Apr  SupI GST/58
  ["2026-04-06","SupI","GST/58/2026-27","Robotek LLP (HR)",0,51135,null],
  ["2026-04-06","SupI","GST/58/2026-27","Purchase",44128,0,null],
  ["2026-04-06","SupI","GST/58/2026-27","Rounded Off",0,0.05,null],
  ["2026-04-06","SupI","GST/58/2026-27","IGST",7007.05,0,null],
  ["2026-04-06","Rcpt","2","FLIPKART INTERNET PVT LTD",0,683.93,null],
  ["2026-04-06","Rcpt","2","IDBI BANK",683.93,0,null],
  ["2026-04-06","Rcpt","3","FLIPKART INTERNET PVT LTD",0,4909.28,null],
  ["2026-04-06","Rcpt","3","IDBI BANK",4909.28,0,null],
  ["2026-04-06","Pymt","1","Robotek LLP (HR)",500000,0,null],
  ["2026-04-06","Pymt","1","IDBI BANK",0,500000,null],
  // 07-Apr
  ["2026-04-07","Pymt","2","TDS (Rent of Land)",10000,0,null],
  ["2026-04-07","Pymt","2","IDBI BANK",0,10000,null],
  ["2026-04-07","Pymt","3","TDS (on Purc. of Goods)",4334,0,null],
  ["2026-04-07","Pymt","3","IDBI BANK",0,4334,null],
  // 08-Apr
  ["2026-04-08","SupI","GST/73/2026-27","Robotek LLP (HR)",0,66732,null],
  ["2026-04-08","SupI","GST/73/2026-27","Purchase",56991,0,null],
  ["2026-04-08","SupI","GST/73/2026-27","Rounded Off",0.02,0,null],
  ["2026-04-08","SupI","GST/73/2026-27","IGST",9740.98,0,null],
  ["2026-04-08","SupI","GST/86/2026-27","Robotek LLP (HR)",0,47013,null],
  ["2026-04-08","SupI","GST/86/2026-27","Purchase",39879,0,null],
  ["2026-04-08","SupI","GST/86/2026-27","Rounded Off",0,0.15,null],
  ["2026-04-08","SupI","GST/86/2026-27","IGST",7134.15,0,null],
  ["2026-04-08","SupI","GST/87/2026-27","Robotek LLP (HR)",0,21058,null],
  ["2026-04-08","SupI","GST/87/2026-27","Purchase",18172.50,0,null],
  ["2026-04-08","SupI","GST/87/2026-27","Rounded Off",0.04,0,null],
  ["2026-04-08","SupI","GST/87/2026-27","IGST",2885.46,0,null],
  ["2026-04-08","SupO","GST/003/2026-27","A.S ELECTRONICS",11945,0,null],
  ["2026-04-08","SupO","GST/003/2026-27","Sales",0,10123,null],
  ["2026-04-08","SupO","GST/003/2026-27","IGST",0,1822.14,null],
  ["2026-04-08","SupO","GST/003/2026-27","Rounded Off",0.14,0,null],
  ["2026-04-08","Rcpt","4","FLIPKART INTERNET PVT LTD",0,658.45,null],
  ["2026-04-08","Rcpt","4","IDBI BANK",658.45,0,null],
  ["2026-04-08","Rcpt","5","FLIPKART INTERNET PVT LTD",0,1112,null],
  ["2026-04-08","Rcpt","5","IDBI BANK",1112,0,null],
  ["2026-04-08","Rcpt","7","Unregisterd Dealer",0,360,"DELHIVERY LIMITED"],
  ["2026-04-08","Rcpt","7","IDBI BANK",360,0,null],
  // 09-Apr
  ["2026-04-09","SupI","GST/99/2026-27","Robotek LLP (HR)",0,68809,null],
  ["2026-04-09","SupI","GST/99/2026-27","Purchase",58480,0,null],
  ["2026-04-09","SupI","GST/99/2026-27","Rounded Off",0.20,0,null],
  ["2026-04-09","SupI","GST/99/2026-27","IGST",10328.80,0,null],
  // 10-Apr
  ["2026-04-10","SupI","GST/106/2026-27","Robotek LLP (HR)",0,12056,null],
  ["2026-04-10","SupI","GST/106/2026-27","Purchase",10266.50,0,null],
  ["2026-04-10","SupI","GST/106/2026-27","Rounded Off",0.03,0,null],
  ["2026-04-10","SupI","GST/106/2026-27","IGST",1789.47,0,null],
  ["2026-04-10","SupI","GST/120/2026-27","Robotek LLP (HR)",0,27900,null],
  ["2026-04-10","SupI","GST/120/2026-27","Purchase",23644,0,null],
  ["2026-04-10","SupI","GST/120/2026-27","Rounded Off",0.08,0,null],
  ["2026-04-10","SupI","GST/120/2026-27","IGST",4255.92,0,null],
  ["2026-04-10","Rcpt","8","Rajendra Mobile Accessories",0,6160,null],
  ["2026-04-10","Rcpt","8","IDBI BANK",6160,0,null],
  // 11-Apr
  ["2026-04-11","SupI","GST/138/2026-27","Robotek LLP (HR)",0,63658,null],
  ["2026-04-11","SupI","GST/138/2026-27","Purchase",54150,0,null],
  ["2026-04-11","SupI","GST/138/2026-27","Rounded Off",0.20,0,null],
  ["2026-04-11","SupI","GST/138/2026-27","IGST",9507.80,0,null],
  ["2026-04-11","SupI","GST/139/2026-27","Robotek LLP (HR)",0,5102,null],
  ["2026-04-11","SupI","GST/139/2026-27","Purchase",4351,0,null],
  ["2026-04-11","SupI","GST/139/2026-27","Rounded Off",0.32,0,null],
  ["2026-04-11","SupI","GST/139/2026-27","IGST",750.68,0,null],
  ["2026-04-11","SupO","GST/004/2026-27","Hello Telecom",24284,0,null],
  ["2026-04-11","SupO","GST/004/2026-27","Sales",0,20580,null],
  ["2026-04-11","SupO","GST/004/2026-27","IGST",0,3704.40,null],
  ["2026-04-11","SupO","GST/004/2026-27","Rounded Off",0.40,0,null],
  // 13-Apr
  ["2026-04-13","SupI","GST/156/2026-27","Robotek LLP (HR)",0,130522,null],
  ["2026-04-13","SupI","GST/156/2026-27","Purchase",111220,0,null],
  ["2026-04-13","SupI","GST/156/2026-27","IGST",19302,0,null],
  ["2026-04-13","SupI","GST/158/2026-27","Robotek LLP (HR)",0,21948,null],
  ["2026-04-13","SupI","GST/158/2026-27","Purchase",18600,0,null],
  ["2026-04-13","SupI","GST/158/2026-27","IGST",3348,0,null],
  ["2026-04-13","SupI","GST/159/2026-27","Robotek LLP (HR)",0,840,null],
  ["2026-04-13","SupI","GST/159/2026-27","Purchase",800,0,null],
  ["2026-04-13","SupI","GST/159/2026-27","IGST",40,0,null],
  ["2026-04-13","Rcpt","9","FLIPKART INTERNET PVT LTD",0,2995.10,null],
  ["2026-04-13","Rcpt","9","IDBI BANK",2995.10,0,null],
  ["2026-04-13","Rcpt","10","Unregisterd Dealer",0,229,"DELHIVERY LIMITED"],
  ["2026-04-13","Rcpt","10","IDBI BANK",229,0,null],
  // 14-Apr
  ["2026-04-14","SupI","GST/163/2026-27","Robotek LLP (HR)",0,91020,null],
  ["2026-04-14","SupI","GST/163/2026-27","Purchase",78960,0,null],
  ["2026-04-14","SupI","GST/163/2026-27","IGST",12060,0,null],
  ["2026-04-14","SupI","GST/171/2026-27","Robotek LLP (HR)",0,127538,null],
  ["2026-04-14","SupI","GST/171/2026-27","Purchase",108899.10,0,null],
  ["2026-04-14","SupI","GST/171/2026-27","Rounded Off",0,0.02,null],
  ["2026-04-14","SupI","GST/171/2026-27","IGST",18638.92,0,null],
  ["2026-04-14","SupI","GST/172/2026-27","Robotek LLP (HR)",0,4341,null],
  ["2026-04-14","SupI","GST/172/2026-27","Purchase",3678.75,0,null],
  ["2026-04-14","SupI","GST/172/2026-27","Rounded Off",0.07,0,null],
  ["2026-04-14","SupI","GST/172/2026-27","IGST",662.18,0,null],
  ["2026-04-14","SupI","GST/173/2026-27","Robotek LLP (HR)",0,525,null],
  ["2026-04-14","SupI","GST/173/2026-27","Purchase",500,0,null],
  ["2026-04-14","SupI","GST/173/2026-27","IGST",25,0,null],
  ["2026-04-14","SupO","GST/005/2026-27","IERA INDUSTRY",20650,0,null],
  ["2026-04-14","SupO","GST/005/2026-27","Sales",0,17500,null],
  ["2026-04-14","SupO","GST/005/2026-27","IGST",0,3150,null],
  ["2026-04-14","SupO","GST/006/2026-27","ANKIT AUTOMOBILE",12390,0,null],
  ["2026-04-14","SupO","GST/006/2026-27","Sales",0,10500,null],
  ["2026-04-14","SupO","GST/006/2026-27","IGST",0,1890,null],
  // 15-Apr
  ["2026-04-15","SupI","GST/191/2026-27","Robotek LLP (HR)",0,64003,null],
  ["2026-04-15","SupI","GST/191/2026-27","Purchase",54240,0,null],
  ["2026-04-15","SupI","GST/191/2026-27","Rounded Off",0,0.20,null],
  ["2026-04-15","SupI","GST/191/2026-27","IGST",9763.20,0,null],
  ["2026-04-15","SupO","GST/007/2026-27","MADHUSUDAN TELECOM",20210,0,null],
  ["2026-04-15","SupO","GST/007/2026-27","Sales",0,17127.50,null],
  ["2026-04-15","SupO","GST/007/2026-27","IGST",0,3082.95,null],
  ["2026-04-15","SupO","GST/007/2026-27","Rounded Off",0.45,0,null],
  ["2026-04-15","SupO","GST/008/2026-27","A.S ELECTRONICS",4996,0,null],
  ["2026-04-15","SupO","GST/008/2026-27","Sales",0,4234.16,null],
  ["2026-04-15","SupO","GST/008/2026-27","IGST",0,762.15,null],
  ["2026-04-15","SupO","GST/008/2026-27","Rounded Off",0.31,0,null],
  ["2026-04-15","Rcpt","11","FLIPKART INTERNET PVT LTD",0,4322.39,null],
  ["2026-04-15","Rcpt","11","IDBI BANK",4322.39,0,null],
  // 16-Apr
  ["2026-04-16","SupI","GST/205/2026-27","Robotek LLP (HR)",0,64976,null],
  ["2026-04-16","SupI","GST/205/2026-27","Purchase",55064,0,null],
  ["2026-04-16","SupI","GST/205/2026-27","Rounded Off",0.48,0,null],
  ["2026-04-16","SupI","GST/205/2026-27","IGST",9911.52,0,null],
  ["2026-04-16","SupO","GST/009/2026-27","Burhan Communication",32500,0,null],
  ["2026-04-16","SupO","GST/009/2026-27","Sales",0,27542.81,null],
  ["2026-04-16","SupO","GST/009/2026-27","IGST",0,4957.71,null],
  ["2026-04-16","SupO","GST/009/2026-27","Rounded Off",0.52,0,null],
  ["2026-04-16","Rcpt","12","Unregisterd Dealer",0,1,"MANICKARAJ P"],
  ["2026-04-16","Rcpt","12","IDBI BANK",1,0,null],
  ["2026-04-16","Rcpt","13","Unregisterd Dealer",0,328,"DELHIVERY LIMITED"],
  ["2026-04-16","Rcpt","13","IDBI BANK",328,0,null],
  ["2026-04-16","Rcpt","14","Burhan Communication",0,32500,null],
  ["2026-04-16","Rcpt","14","IDBI BANK",32500,0,null],
  ["2026-04-16","Rcpt","15","M/S SWASTIK COMMUNICATION",0,49000,null],
  ["2026-04-16","Rcpt","15","IDBI BANK",49000,0,null],
  ["2026-04-16","Rcpt","16","IERA INDUSTRY",0,20650,null],
  ["2026-04-16","Rcpt","16","IDBI BANK",20650,0,null],
  // 17-Apr
  ["2026-04-17","SupI","GST/216/2026-27","Robotek LLP (HR)",0,50674,null],
  ["2026-04-17","SupI","GST/216/2026-27","Purchase",42944,0,null],
  ["2026-04-17","SupI","GST/216/2026-27","Rounded Off",0.08,0,null],
  ["2026-04-17","SupI","GST/216/2026-27","IGST",7729.92,0,null],
  ["2026-04-17","SupI","GST/221/2026-27","Robotek LLP (HR)",0,34351,null],
  ["2026-04-17","SupI","GST/221/2026-27","Purchase",29111,0,null],
  ["2026-04-17","SupI","GST/221/2026-27","Rounded Off",0.02,0,null],
  ["2026-04-17","SupI","GST/221/2026-27","IGST",5239.98,0,null],
  ["2026-04-17","Rcpt","17","Unregisterd Dealer",0,378,"DELHIVERY LIMITED"],
  ["2026-04-17","Rcpt","17","IDBI BANK",378,0,null],
  // 18-Apr
  ["2026-04-18","SupI","GST/237/2026-27","Robotek LLP (HR)",0,57654,null],
  ["2026-04-18","SupI","GST/237/2026-27","Purchase",49346,0,null],
  ["2026-04-18","SupI","GST/237/2026-27","Rounded Off",0,0.20,null],
  ["2026-04-18","SupI","GST/237/2026-27","IGST",8308.20,0,null],
  // 20-Apr
  ["2026-04-20","Rcpt","18","FLIPKART INTERNET PVT LTD",0,631.38,null],
  ["2026-04-20","Rcpt","18","IDBI BANK",631.38,0,null],
  ["2026-04-20","Rcpt","19","FLIPKART INTERNET PVT LTD",0,5335.80,null],
  ["2026-04-20","Rcpt","19","IDBI BANK",5335.80,0,null],
  ["2026-04-20","Rcpt","20","Robotek LLP (HR)",0,1500000,null],
  ["2026-04-20","Rcpt","20","IDBI BANK",1500000,0,null],
  ["2026-04-20","Rcpt","21","Unregisterd Dealer",0,2228,"DELHIVERY LIMITED"],
  ["2026-04-20","Rcpt","21","IDBI BANK",2228,0,null],
  ["2026-04-20","Rcpt","22","Hollywood Enterprises",0,85000,null],
  ["2026-04-20","Rcpt","22","IDBI BANK",85000,0,null],
  ["2026-04-20","Pymt","4","Bank Charges",82.02,0,"SMS CHARGE FOR JAN26 TO MAR26"],
  ["2026-04-20","Pymt","4","IDBI BANK",0,82.02,null],
  ["2026-04-20","Pymt","5","IGST",1575652,0,"MARCH MONTH"],
  ["2026-04-20","Pymt","5","IDBI BANK",0,1575652,null],
  // 21-Apr
  ["2026-04-21","SupI","GST/263/2026-27","Robotek LLP (HR)",0,192343,null],
  ["2026-04-21","SupI","GST/263/2026-27","Purchase",163611,0,null],
  ["2026-04-21","SupI","GST/263/2026-27","Rounded Off",0,0.38,null],
  ["2026-04-21","SupI","GST/263/2026-27","IGST",28732.38,0,null],
  ["2026-04-21","SupO","GST/010/2026-27","Y.R. ELECTRICALS",16992,0,null],
  ["2026-04-21","SupO","GST/010/2026-27","Sales",0,14400,null],
  ["2026-04-21","SupO","GST/010/2026-27","CGST",0,1296,null],
  ["2026-04-21","SupO","GST/010/2026-27","SGST",0,1296,null],
  ["2026-04-21","SupO","GST/011/2026-27","Hollywood Enterprises",43877,0,null],
  ["2026-04-21","SupO","GST/011/2026-27","Sales",0,37184.30,null],
  ["2026-04-21","SupO","GST/011/2026-27","IGST",0,6693.17,null],
  ["2026-04-21","SupO","GST/011/2026-27","Rounded Off",0.47,0,null],
  ["2026-04-21","SupO","GST/012/2026-27","Hollywood Enterprises",9584,0,null],
  ["2026-04-21","SupO","GST/012/2026-27","Sales",0,8122.20,null],
  ["2026-04-21","SupO","GST/012/2026-27","IGST",0,1462,null],
  ["2026-04-21","SupO","GST/012/2026-27","Rounded Off",0.20,0,null],
  ["2026-04-21","SupO","GST/013/2026-27","Rajendra Mobile Accessories",2684,0,null],
  ["2026-04-21","SupO","GST/013/2026-27","Sales",0,2274.60,null],
  ["2026-04-21","SupO","GST/013/2026-27","IGST",0,409.43,null],
  ["2026-04-21","SupO","GST/013/2026-27","Rounded Off",0.03,0,null],
  // 22-Apr
  ["2026-04-22","SupI","GST/281/2026-27","Robotek LLP (HR)",0,26007,null],
  ["2026-04-22","SupI","GST/281/2026-27","Purchase",22152.37,0,null],
  ["2026-04-22","SupI","GST/281/2026-27","Rounded Off",0,0.34,null],
  ["2026-04-22","SupI","GST/281/2026-27","IGST",3854.97,0,null],
  ["2026-04-22","SupI","GST/282/2026-27","Robotek LLP (HR)",0,108590,null],
  ["2026-04-22","SupI","GST/282/2026-27","Purchase",92091.20,0,null],
  ["2026-04-22","SupI","GST/282/2026-27","Rounded Off",0.38,0,null],
  ["2026-04-22","SupI","GST/282/2026-27","IGST",16498.42,0,null],
  ["2026-04-22","SupI","GST/283/2026-27","Robotek LLP (HR)",0,1313,null],
  ["2026-04-22","SupI","GST/283/2026-27","Purchase",1250,0,null],
  ["2026-04-22","SupI","GST/283/2026-27","Rounded Off",0.50,0,null],
  ["2026-04-22","SupI","GST/283/2026-27","IGST",62.50,0,null],
  ["2026-04-22","SupI","GST/284/2026-27","Robotek LLP (HR)",0,1054,null],
  ["2026-04-22","SupI","GST/284/2026-27","Purchase",893,0,null],
  ["2026-04-22","SupI","GST/284/2026-27","Rounded Off",0.26,0,null],
  ["2026-04-22","SupI","GST/284/2026-27","IGST",160.74,0,null],
  ["2026-04-22","SupO","GST/014/2026-27","A.S ELECTRONICS",4601,0,null],
  ["2026-04-22","SupO","GST/014/2026-27","Sales",0,3899.11,null],
  ["2026-04-22","SupO","GST/014/2026-27","IGST",0,701.84,null],
  ["2026-04-22","SupO","GST/014/2026-27","Rounded Off",0,0.05,null],
  ["2026-04-22","Rcpt","23","FLIPKART INTERNET PVT LTD",0,2205.61,null],
  ["2026-04-22","Rcpt","23","IDBI BANK",2205.61,0,null],
  ["2026-04-22","Rcpt","24","FLIPKART INTERNET PVT LTD",0,1578.45,null],
  ["2026-04-22","Rcpt","24","IDBI BANK",1578.45,0,null],
  // 23-Apr
  ["2026-04-23","SupI","GST/295/2026-27","Robotek LLP (HR)",0,72981,null],
  ["2026-04-23","SupI","GST/295/2026-27","Purchase",62283.80,0,null],
  ["2026-04-23","SupI","GST/295/2026-27","Rounded Off",0.24,0,null],
  ["2026-04-23","SupI","GST/295/2026-27","IGST",10696.96,0,null],
  ["2026-04-23","SORt","1","M/s MODERN TECH",0,62340,null],
  ["2026-04-23","SORt","1","Sales",52830.60,0,null],
  ["2026-04-23","SORt","1","IGST",9509.51,0,null],
  ["2026-04-23","SORt","1","Rounded Off",0,0.11,null],
  ["2026-04-23","SupO","GST/015/2026-27","MITTAL ENTERPRISE",16125,0,null],
  ["2026-04-23","SupO","GST/015/2026-27","Sales",0,13665.45,null],
  ["2026-04-23","SupO","GST/015/2026-27","IGST",0,2459.78,null],
  ["2026-04-23","SupO","GST/015/2026-27","Rounded Off",0.23,0,null],
  ["2026-04-23","SupO","GST/016/2026-27","M/s MODERN TECH",62340,0,null],
  ["2026-04-23","SupO","GST/016/2026-27","Sales",0,52830.60,null],
  ["2026-04-23","SupO","GST/016/2026-27","IGST",0,9509.51,null],
  ["2026-04-23","SupO","GST/016/2026-27","Rounded Off",0.11,0,null],
  ["2026-04-23","SupO","GST/017/2026-27","M/s MODERN TECH",64964,0,null],
  ["2026-04-23","SupO","GST/017/2026-27","Sales",0,55054.20,null],
  ["2026-04-23","SupO","GST/017/2026-27","IGST",0,9909.76,null],
  ["2026-04-23","SupO","GST/017/2026-27","Rounded Off",0,0.04,null],
  ["2026-04-23","SupO","GST/018/2026-27","DEEPAK KUMAR",12461,0,null],
  ["2026-04-23","SupO","GST/018/2026-27","Sales",0,10560.55,null],
  ["2026-04-23","SupO","GST/018/2026-27","IGST",0,1900.90,null],
  ["2026-04-23","SupO","GST/018/2026-27","Rounded Off",0.45,0,null],
  ["2026-04-23","Rcpt","25","M/s MODERN TECH",0,264964,null],
  ["2026-04-23","Rcpt","25","IDBI BANK",264964,0,null],
  ["2026-04-23","Pymt","6","Electricity Expenses Payable",13162.12,0,"KAROL BAGH SHOP"],
  ["2026-04-23","Pymt","6","IDBI BANK",0,13162.12,null],
  // 24-Apr
  ["2026-04-24","SupI","GST/304/2026-27","Robotek LLP (HR)",0,40545,null],
  ["2026-04-24","SupI","GST/304/2026-27","Purchase",34360,0,null],
  ["2026-04-24","SupI","GST/304/2026-27","Rounded Off",0.20,0,null],
  ["2026-04-24","SupI","GST/304/2026-27","IGST",6184.80,0,null],
  ["2026-04-24","SupI","GST/309/2026-27","Robotek LLP (HR)",0,525,null],
  ["2026-04-24","SupI","GST/309/2026-27","Purchase",500,0,null],
  ["2026-04-24","SupI","GST/309/2026-27","IGST",25,0,null],
  ["2026-04-24","SupI","GST/310/2026-27","Robotek LLP (HR)",0,78810,null],
  ["2026-04-24","SupI","GST/310/2026-27","Purchase",67928.20,0,null],
  ["2026-04-24","SupI","GST/310/2026-27","Rounded Off",0,0.01,null],
  ["2026-04-24","SupI","GST/310/2026-27","IGST",10881.81,0,null],
  ["2026-04-24","SORt","2","M/S Jay Amey Electronics",0,4375,null],
  ["2026-04-24","SORt","2","Sales",3707.88,0,null],
  ["2026-04-24","SORt","2","IGST",667.42,0,null],
  ["2026-04-24","SORt","2","Rounded Off",0,0.30,null],
  ["2026-04-24","SupO","GST/019/2026-27","M/S Jay Amey Electronics",15563,0,null],
  ["2026-04-24","SupO","GST/019/2026-27","Sales",0,13188.80,null],
  ["2026-04-24","SupO","GST/019/2026-27","IGST",0,2373.98,null],
  ["2026-04-24","SupO","GST/019/2026-27","Rounded Off",0,0.22,null],
  ["2026-04-24","SupO","GST/020/2026-27","PARKASH DISTRIBUTORS",13927,0,null],
  ["2026-04-24","SupO","GST/020/2026-27","Sales",0,11802.40,null],
  ["2026-04-24","SupO","GST/020/2026-27","IGST",0,2124.43,null],
  ["2026-04-24","SupO","GST/020/2026-27","Rounded Off",0,0.17,null],
  ["2026-04-24","Rcpt","26","FLIPKART INTERNET PVT LTD",0,1852.35,null],
  ["2026-04-24","Rcpt","26","IDBI BANK",1852.35,0,null],
  ["2026-04-24","Rcpt","27","FLIPKART INTERNET PVT LTD",0,3144.09,null],
  ["2026-04-24","Rcpt","27","IDBI BANK",3144.09,0,null],
  // 25-Apr
  ["2026-04-25","SupI","GST/323/2026-27","Robotek LLP (HR)",0,18024,null],
  ["2026-04-25","SupI","GST/323/2026-27","Purchase",15680,0,null],
  ["2026-04-25","SupI","GST/323/2026-27","IGST",2344,0,null],
  ["2026-04-25","SupI","GST/327/2026-27","Robotek LLP (HR)",0,28401,null],
  ["2026-04-25","SupI","GST/327/2026-27","Purchase",24224.50,0,null],
  ["2026-04-25","SupI","GST/327/2026-27","Rounded Off",0,0.29,null],
  ["2026-04-25","SupI","GST/327/2026-27","IGST",4176.79,0,null],
  ["2026-04-25","SupO","GST/021/2026-27","Hello Telecom",7252,0,null],
  ["2026-04-25","SupO","GST/021/2026-27","Sales",0,6146,null],
  ["2026-04-25","SupO","GST/021/2026-27","IGST",0,1106.28,null],
  ["2026-04-25","SupO","GST/021/2026-27","Rounded Off",0.28,0,null],
  ["2026-04-25","SupO","GST/022/2026-27","Hollywood Enterprises",17039,0,null],
  ["2026-04-25","SupO","GST/022/2026-27","Sales",0,14440.20,null],
  ["2026-04-25","SupO","GST/022/2026-27","IGST",0,2599.24,null],
  ["2026-04-25","SupO","GST/022/2026-27","Rounded Off",0.44,0,null],
  ["2026-04-25","Rcpt","28","Hollywood Enterprises",0,17039,null],
  ["2026-04-25","Rcpt","28","IDBI BANK",17039,0,null],
  // 26-Apr
  ["2026-04-26","Rcpt","29","Rajendra Mobile Accessories",0,6443,null],
  ["2026-04-26","Rcpt","29","IDBI BANK",6443,0,null],
  // 27-Apr
  ["2026-04-27","Rcpt","30","FLIPKART INTERNET PVT LTD",0,4674.49,null],
  ["2026-04-27","Rcpt","30","IDBI BANK",4674.49,0,null],
  ["2026-04-27","Rcpt","31","FLIPKART INTERNET PVT LTD",0,971.18,null],
  ["2026-04-27","Rcpt","31","IDBI BANK",971.18,0,null],
  ["2026-04-27","Rcpt","32","Y.R. ELECTRICALS",0,16992,null],
  ["2026-04-27","Rcpt","32","IDBI BANK",16992,0,null],
  // 28-Apr
  ["2026-04-28","SupI","GST/347/2026-27","Robotek LLP (HR)",0,121047,null],
  ["2026-04-28","SupI","GST/347/2026-27","Purchase",102988,0,null],
  ["2026-04-28","SupI","GST/347/2026-27","Rounded Off",0,0.44,null],
  ["2026-04-28","SupI","GST/347/2026-27","IGST",18059.44,0,null],
  ["2026-04-28","SupO","GST/023/2026-27","GUMBER TECHWORLD",1658,0,null],
  ["2026-04-28","SupO","GST/023/2026-27","Sales",0,1404.95,null],
  ["2026-04-28","SupO","GST/023/2026-27","IGST",0,252.89,null],
  ["2026-04-28","SupO","GST/023/2026-27","Rounded Off",0,0.16,null],
  ["2026-04-28","Rcpt","33","Unregisterd Dealer",0,788,"DELHIVERY LIMITED"],
  ["2026-04-28","Rcpt","33","IDBI BANK",788,0,null],
  ["2026-04-28","Pymt","7","IGST",500,0,null],
  ["2026-04-28","Pymt","7","IDBI BANK",0,500,null],
  // 29-Apr
  ["2026-04-29","SupI","GST/357/2026-27","Robotek LLP (HR)",0,170944,null],
  ["2026-04-29","SupI","GST/357/2026-27","Purchase",145577.50,0,null],
  ["2026-04-29","SupI","GST/357/2026-27","Rounded Off",0,0.25,null],
  ["2026-04-29","SupI","GST/357/2026-27","IGST",25366.75,0,null],
  ["2026-04-29","SupI","GST/365/2026-27","Robotek LLP (HR)",0,25304,null],
  ["2026-04-29","SupI","GST/365/2026-27","Purchase",21444,0,null],
  ["2026-04-29","SupI","GST/365/2026-27","Rounded Off",0.08,0,null],
  ["2026-04-29","SupI","GST/365/2026-27","IGST",3859.92,0,null],
  ["2026-04-29","SupO","GST/024/2026-27","Yati Infotech Solution",1302720,0,null],
  ["2026-04-29","SupO","GST/024/2026-27","Sales",0,1104000,null],
  ["2026-04-29","SupO","GST/024/2026-27","CGST",0,99360,null],
  ["2026-04-29","SupO","GST/024/2026-27","SGST",0,99360,null],
  ["2026-04-29","SupO","GST/025/2026-27","DEEPAK KUMAR",36670,0,null],
  ["2026-04-29","SupO","GST/025/2026-27","Sales",0,31075.87,null],
  ["2026-04-29","SupO","GST/025/2026-27","IGST",0,5593.66,null],
  ["2026-04-29","SupO","GST/025/2026-27","Rounded Off",0,0.47,null],
  ["2026-04-29","Rcpt","34","FLIPKART INTERNET PVT LTD",0,1606.07,null],
  ["2026-04-29","Rcpt","34","IDBI BANK",1606.07,0,null],
  ["2026-04-29","Rcpt","35","FLIPKART INTERNET PVT LTD",0,3531.67,null],
  ["2026-04-29","Rcpt","35","IDBI BANK",3531.67,0,null],
  // 30-Apr
  ["2026-04-30","SupI","GST/372/2026-27","Robotek LLP (HR)",0,21240,null],
  ["2026-04-30","SupI","GST/372/2026-27","Purchase",18000,0,null],
  ["2026-04-30","SupI","GST/372/2026-27","IGST",3240,0,null],
  ["2026-04-30","SupI","GST/378/2026-27","Robotek LLP (HR)",0,4571,null],
  ["2026-04-30","SupI","GST/378/2026-27","Purchase",3874,0,null],
  ["2026-04-30","SupI","GST/378/2026-27","Rounded Off",0,0.32,null],
  ["2026-04-30","SupI","GST/378/2026-27","IGST",697.32,0,null],
  ["2026-04-30","SupI","GST/379/2026-27","Robotek LLP (HR)",0,19022,null],
  ["2026-04-30","SupI","GST/379/2026-27","Purchase",16120,0,null],
  ["2026-04-30","SupI","GST/379/2026-27","Rounded Off",0.40,0,null],
  ["2026-04-30","SupI","GST/379/2026-27","IGST",2901.60,0,null],
  ["2026-04-30","SORt","3","MITTAL ENTERPRISE",0,16125,null],
  ["2026-04-30","SORt","3","Sales",13665.45,0,null],
  ["2026-04-30","SORt","3","IGST",2459.78,0,null],
  ["2026-04-30","SORt","3","Rounded Off",0,0.23,null],
  ["2026-04-30","SupO","GST/026/2026-27","MITTAL ENTERPRISE",17289,0,null],
  ["2026-04-30","SupO","GST/026/2026-27","Sales",0,14651.95,null],
  ["2026-04-30","SupO","GST/026/2026-27","IGST",0,2637.35,null],
  ["2026-04-30","SupO","GST/026/2026-27","Rounded Off",0.30,0,null],
  ["2026-04-30","SupO","GST/028/2026-27","Yati Infotech Solution",1699200,0,null],
  ["2026-04-30","SupO","GST/028/2026-27","Sales",0,1440000,null],
  ["2026-04-30","SupO","GST/028/2026-27","CGST",0,129600,null],
  ["2026-04-30","SupO","GST/028/2026-27","SGST",0,129600,null],
  ["2026-04-30","Pymt","8","Robotek LLP (HR)",200000,0,null],
  ["2026-04-30","Pymt","8","IDBI BANK",0,200000,null],
  // 01-May
  ["2026-05-01","SupI","GST/388/2026-27","Robotek LLP (HR)",0,47483,null],
  ["2026-05-01","SupI","GST/388/2026-27","Purchase",40240,0,null],
  ["2026-05-01","SupI","GST/388/2026-27","Rounded Off",0,0.20,null],
  ["2026-05-01","SupI","GST/388/2026-27","IGST",7243.20,0,null],
  ["2026-05-01","Rcpt","36","MITTAL ENTERPRISE",0,41044,null],
  ["2026-05-01","Rcpt","36","IDBI BANK",41044,0,null],
  ["2026-05-01","Jrnl","1","Office Rent",100000,0,"GST-015/2026-27 APRIL AND MAY"],
  ["2026-05-01","Jrnl","1","CGST",9000,0,null],
  ["2026-05-01","Jrnl","1","SGST",9000,0,null],
  ["2026-05-01","Jrnl","1","AMAN AGGARWAL(RENT)",0,118000,null],
  ["2026-05-01","Jrnl","3","Office Rent",100000,0,"INV 015/2026-27 APRIL AND MAY"],
  ["2026-05-01","Jrnl","3","CGST",9000,0,null],
  ["2026-05-01","Jrnl","3","SGST",9000,0,null],
  ["2026-05-01","Jrnl","3","SAHIL AGGARWAL(RENT)",0,118000,null],
  // 04-May
  ["2026-05-04","SupI","GST/407/2026-27","Robotek LLP (HR)",0,116099,null],
  ["2026-05-04","SupI","GST/407/2026-27","Purchase",99200,0,null],
  ["2026-05-04","SupI","GST/407/2026-27","Rounded Off",0,0.20,null],
  ["2026-05-04","SupI","GST/407/2026-27","IGST",16899.20,0,null],
  ["2026-05-04","SupI","GST/410/2026-27","Robotek LLP (HR)",0,127323,null],
  ["2026-05-04","SupI","GST/410/2026-27","Purchase",109374.35,0,null],
  ["2026-05-04","SupI","GST/410/2026-27","Rounded Off",0,0.07,null],
  ["2026-05-04","SupI","GST/410/2026-27","IGST",17948.72,0,null],
  ["2026-05-04","Rcpt","37","FLIPKART INTERNET PVT LTD",0,1062.36,null],
  ["2026-05-04","Rcpt","37","IDBI BANK",1062.36,0,null],
  ["2026-05-04","Rcpt","38","FLIPKART INTERNET PVT LTD",0,4213.54,null],
  ["2026-05-04","Rcpt","38","IDBI BANK",4213.54,0,null],
  // 05-May
  ["2026-05-05","SupI","GST/435/2026-27","Robotek LLP (HR)",0,79606,null],
  ["2026-05-05","SupI","GST/435/2026-27","Purchase",67462.40,0,null],
  ["2026-05-05","SupI","GST/435/2026-27","Rounded Off",0.37,0,null],
  ["2026-05-05","SupI","GST/435/2026-27","IGST",12143.23,0,null],
  // 06-May
  ["2026-05-06","SupI","GST/441/2025-26","Robotek LLP (HR)",0,154727,null],
  ["2026-05-06","SupI","GST/441/2025-26","Purchase",131611,0,null],
  ["2026-05-06","SupI","GST/441/2025-26","Rounded Off",0.10,0,null],
  ["2026-05-06","SupI","GST/441/2025-26","IGST",23115.90,0,null],
  ["2026-05-06","SupO","GST/029/2026-27","DEEPAK KUMAR",24187,0,null],
  ["2026-05-06","SupO","GST/029/2026-27","Sales",0,20497.59,null],
  ["2026-05-06","SupO","GST/029/2026-27","IGST",0,3689.57,null],
  ["2026-05-06","SupO","GST/029/2026-27","Rounded Off",0.16,0,null],
  ["2026-05-06","SupO","GST/030/2026-27","A.S ELECTRONICS",9119,0,null],
  ["2026-05-06","SupO","GST/030/2026-27","Sales",0,7728.37,null],
  ["2026-05-06","SupO","GST/030/2026-27","IGST",0,1391.11,null],
  ["2026-05-06","SupO","GST/030/2026-27","Rounded Off",0.48,0,null],
  ["2026-05-06","SupO","GST/031/2026-27","PARKASH DISTRIBUTORS",13471,0,null],
  ["2026-05-06","SupO","GST/031/2026-27","Sales",0,11415.70,null],
  ["2026-05-06","SupO","GST/031/2026-27","IGST",0,2054.83,null],
  ["2026-05-06","SupO","GST/031/2026-27","Rounded Off",0,0.47,null],
  ["2026-05-06","Rcpt","39","FLIPKART INTERNET PVT LTD",0,3485.35,null],
  ["2026-05-06","Rcpt","39","IDBI BANK",3485.35,0,null],
  ["2026-05-06","Rcpt","40","FLIPKART INTERNET PVT LTD",0,1387.14,null],
  ["2026-05-06","Rcpt","40","IDBI BANK",1387.14,0,null],
  ["2026-05-06","Rcpt","41","YATI INFOTECH SOLUTION PVT. LTD.",0,1000000,null],
  ["2026-05-06","Rcpt","41","IDBI BANK",1000000,0,null],
  ["2026-05-06","Rcpt","42","Unregisterd Dealer",0,1406,"DELHIVERY LIMITED"],
  ["2026-05-06","Rcpt","42","IDBI BANK",1406,0,null],
  ["2026-05-06","Pymt","9","Robotek LLP (HR)",500000,0,null],
  ["2026-05-06","Pymt","9","IDBI BANK",0,500000,null],
  // 07-May
  ["2026-05-07","SupI","GST/462/2026-27","Robotek LLP (HR)",0,36757,null],
  ["2026-05-07","SupI","GST/462/2026-27","Purchase",31150,0,null],
  ["2026-05-07","SupI","GST/462/2026-27","IGST",5607,0,null],
  ["2026-05-07","SupO","GST/032/2026-27","Rajendra Mobile Accessories",1826,0,null],
  ["2026-05-07","SupO","GST/032/2026-27","Sales",0,1547.50,null],
  ["2026-05-07","SupO","GST/032/2026-27","IGST",0,278.55,null],
  ["2026-05-07","SupO","GST/032/2026-27","Rounded Off",0.05,0,null],
  ["2026-05-07","Pymt","10","Robotek LLP (HR)",1000000,0,null],
  ["2026-05-07","Pymt","10","IDBI BANK",0,1000000,null],
  // 08-May
  ["2026-05-08","SupI","GST/478/2026-27","Robotek LLP (HR)",0,28473,null],
  ["2026-05-08","SupI","GST/478/2026-27","Purchase",24130,0,null],
  ["2026-05-08","SupI","GST/478/2026-27","Rounded Off",0,0.40,null],
  ["2026-05-08","SupI","GST/478/2026-27","IGST",4343.40,0,null],
  ["2026-05-08","Rcpt","43","FLIPKART INTERNET PVT LTD",0,2033.30,null],
  ["2026-05-08","Rcpt","43","IDBI BANK",2033.30,0,null],
  // 09-May
  ["2026-05-09","SupI","GST/497/2026-27","Robotek LLP (HR)",0,47904,null],
  ["2026-05-09","SupI","GST/497/2026-27","Purchase",41340,0,null],
  ["2026-05-09","SupI","GST/497/2026-27","Rounded Off",0.30,0,null],
  ["2026-05-09","SupI","GST/497/2026-27","IGST",6563.70,0,null],
  // 11-May
  ["2026-05-11","SupI","GST/508/2026-27","Robotek LLP (HR)",0,8968,null],
  ["2026-05-11","SupI","GST/508/2026-27","Purchase",7600,0,null],
  ["2026-05-11","SupI","GST/508/2026-27","IGST",1368,0,null],
  ["2026-05-11","Rcpt","44","FLIPKART INTERNET PVT LTD",0,4443.09,null],
  ["2026-05-11","Rcpt","44","IDBI BANK",4443.09,0,null],
  // 12-May
  ["2026-05-12","SupI","GST/532/2026-27","Robotek LLP (HR)",0,215485,null],
  ["2026-05-12","SupI","GST/532/2026-27","Purchase",182614,0,null],
  ["2026-05-12","SupI","GST/532/2026-27","Rounded Off",0.48,0,null],
  ["2026-05-12","SupI","GST/532/2026-27","IGST",32870.52,0,null],
  ["2026-05-12","Rcpt","45","Unregisterd Dealer",0,1234,"DELHIVERY LIMITED"],
  ["2026-05-12","Rcpt","45","IDBI BANK",1234,0,null],
  // 13-May
  ["2026-05-13","SupI","GST/538/2026-27","Robotek LLP (HR)",0,21246,null],
  ["2026-05-13","SupI","GST/538/2026-27","Purchase",18207.90,0,null],
  ["2026-05-13","SupI","GST/538/2026-27","Rounded Off",0,0.12,null],
  ["2026-05-13","SupI","GST/538/2026-27","IGST",3038.22,0,null],
  ["2026-05-13","SupI","GST/550/2026-27","Robotek LLP (HR)",0,52066,null],
  ["2026-05-13","SupI","GST/550/2026-27","Purchase",44326.60,0,null],
  ["2026-05-13","SupI","GST/550/2026-27","Rounded Off",0,0.19,null],
  ["2026-05-13","SupI","GST/550/2026-27","IGST",7739.59,0,null],
  ["2026-05-13","SupI","GST/552/2026-27","Robotek LLP (HR)",0,49858,null],
  ["2026-05-13","SupI","GST/552/2026-27","Purchase",42252.40,0,null],
  ["2026-05-13","SupI","GST/552/2026-27","Rounded Off",0.17,0,null],
  ["2026-05-13","SupI","GST/552/2026-27","IGST",7605.43,0,null],
  ["2026-05-13","SupI","GST/554/2026-27","Robotek LLP (HR)",0,107469,null],
  ["2026-05-13","SupI","GST/554/2026-27","Purchase",91141.80,0,null],
  ["2026-05-13","SupI","GST/554/2026-27","Rounded Off",0,0.33,null],
  ["2026-05-13","SupI","GST/554/2026-27","IGST",16327.53,0,null],
  ["2026-05-13","Rcpt","46","FLIPKART INTERNET PVT LTD",0,1088.52,null],
  ["2026-05-13","Rcpt","46","IDBI BANK",1088.52,0,null],
  ["2026-05-13","Rcpt","47","FLIPKART INTERNET PVT LTD",0,5996.34,null],
  ["2026-05-13","Rcpt","47","IDBI BANK",5996.34,0,null],
  ["2026-05-13","Rcpt","48","RALAVA MOBILE CARE",0,350000,null],
  ["2026-05-13","Rcpt","48","IDBI BANK",350000,0,null],
  // 14-May
  ["2026-05-14","SupI","GST/569/2026-27","Robotek LLP (HR)",0,224629,null],
  ["2026-05-14","SupI","GST/569/2026-27","Purchase",190975.48,0,null],
  ["2026-05-14","SupI","GST/569/2026-27","Rounded Off",0.15,0,null],
  ["2026-05-14","SupI","GST/569/2026-27","IGST",33653.37,0,null],
  ["2026-05-14","SORt","4","PANKAJ TELECOM",0,7463,null],
  ["2026-05-14","SORt","4","Sales",5830.80,0,null],
  ["2026-05-14","SORt","4","IGST",1632.62,0,null],
  ["2026-05-14","SORt","4","Rounded Off",0,0.42,null],
  ["2026-05-14","SupO","GST/033/2026-27","Rajendra Mobile Accessories",2224,0,null],
  ["2026-05-14","SupO","GST/033/2026-27","Sales",0,1885,null],
  ["2026-05-14","SupO","GST/033/2026-27","IGST",0,339.30,null],
  ["2026-05-14","SupO","GST/033/2026-27","Rounded Off",0.30,0,null],
  ["2026-05-14","SupO","GST/034/2026-27","RALAVA MOBILE CARE",98778,0,null],
  ["2026-05-14","SupO","GST/034/2026-27","Sales",0,83710,null],
  ["2026-05-14","SupO","GST/034/2026-27","IGST",0,15067.80,null],
  ["2026-05-14","SupO","GST/034/2026-27","Rounded Off",0,0.20,null],
  ["2026-05-14","SupO","GST/035/2026-27","M/s MODERN TECH",59682,0,null],
  ["2026-05-14","SupO","GST/035/2026-27","Sales",0,50578.24,null],
  ["2026-05-14","SupO","GST/035/2026-27","IGST",0,9104.08,null],
  ["2026-05-14","SupO","GST/035/2026-27","Rounded Off",0.32,0,null],
  ["2026-05-14","SupO","GST/036/2026-27","PANKAJ TELECOM",7463,0,null],
  ["2026-05-14","SupO","GST/036/2026-27","Sales",0,5830.80,null],
  ["2026-05-14","SupO","GST/036/2026-27","IGST",0,1632.62,null],
  ["2026-05-14","SupO","GST/036/2026-27","Rounded Off",0.42,0,null],
  ["2026-05-14","Rcpt","49","RALAVA MOBILE CARE",0,250000,null],
  ["2026-05-14","Rcpt","49","IDBI BANK",250000,0,null],
  // 15-May
  ["2026-05-15","SupI","GST/579/2026-27","Robotek LLP (HR)",0,105042,null],
  ["2026-05-15","SupI","GST/579/2026-27","Purchase",89832.10,0,null],
  ["2026-05-15","SupI","GST/579/2026-27","Rounded Off",0,0.21,null],
  ["2026-05-15","SupI","GST/579/2026-27","IGST",15210.11,0,null],
  ["2026-05-15","SupI","GST/580/2026-27","Robotek LLP (HR)",0,1050,null],
  ["2026-05-15","SupI","GST/580/2026-27","Purchase",1000,0,null],
  ["2026-05-15","SupI","GST/580/2026-27","IGST",50,0,null],
  ["2026-05-15","SupO","GST/037/2026-27","PANKAJ TELECOM",6880,0,null],
  ["2026-05-15","SupO","GST/037/2026-27","Sales",0,5830.80,null],
  ["2026-05-15","SupO","GST/037/2026-27","IGST",0,1049.54,null],
  ["2026-05-15","SupO","GST/037/2026-27","Rounded Off",0.34,0,null],
  ["2026-05-15","Rcpt","50","FLIPKART INTERNET PVT LTD",0,866.73,null],
  ["2026-05-15","Rcpt","50","IDBI BANK",866.73,0,null],
  ["2026-05-15","Rcpt","51","FLIPKART INTERNET PVT LTD",0,1554.68,null],
  ["2026-05-15","Rcpt","51","IDBI BANK",1554.68,0,null],
  ["2026-05-15","Pymt","11","Robotek LLP (HR)",600000,0,null],
  ["2026-05-15","Pymt","11","IDBI BANK",0,600000,null],
  // 16-May
  ["2026-05-16","SupI","GST/602/2026-27","Robotek LLP (HR)",0,6110,null],
  ["2026-05-16","SupI","GST/602/2026-27","Purchase",5177.75,0,null],
  ["2026-05-16","SupI","GST/602/2026-27","Rounded Off",0.25,0,null],
  ["2026-05-16","SupI","GST/602/2026-27","IGST",932,0,null],
  ["2026-05-16","SupI","GST/603/2026-27","Robotek LLP (HR)",0,52680,null],
  ["2026-05-16","SupI","GST/603/2026-27","Purchase",44687.28,0,null],
  ["2026-05-16","SupI","GST/603/2026-27","Rounded Off",0.43,0,null],
  ["2026-05-16","SupI","GST/603/2026-27","IGST",7992.29,0,null],
  ["2026-05-16","SupO","GST/038/2026-27","KISHORE MOBILE",43101,0,null],
  ["2026-05-16","SupO","GST/038/2026-27","Sales",0,36526.50,null],
  ["2026-05-16","SupO","GST/038/2026-27","IGST",0,6574.77,null],
  ["2026-05-16","SupO","GST/038/2026-27","Rounded Off",0.27,0,null],
  ["2026-05-16","SupO","GST/039/2026-27","DEEPAK KUMAR",49138,0,null],
  ["2026-05-16","SupO","GST/039/2026-27","Sales",0,41642.60,null],
  ["2026-05-16","SupO","GST/039/2026-27","IGST",0,7495.67,null],
  ["2026-05-16","SupO","GST/039/2026-27","Rounded Off",0.27,0,null],
  ["2026-05-16","Rcpt","52","A.S ELECTRONICS",0,27000,null],
  ["2026-05-16","Rcpt","52","IDBI BANK",27000,0,null],
  ["2026-05-16","Rcpt","53","Unregisterd Dealer",0,228,"DELHIVERY LIMITED"],
  ["2026-05-16","Rcpt","53","IDBI BANK",228,0,null],
  // 17-May
  ["2026-05-17","Rcpt","54","PANKAJ TELECOM",0,6880,null],
  ["2026-05-17","Rcpt","54","IDBI BANK",6880,0,null],
  // 18-May
  ["2026-05-18","Rcpt","55","FLIPKART INTERNET PVT LTD",0,1085.87,null],
  ["2026-05-18","Rcpt","55","IDBI BANK",1085.87,0,null],
  ["2026-05-18","Rcpt","56","FLIPKART INTERNET PVT LTD",0,2136.23,null],
  ["2026-05-18","Rcpt","56","IDBI BANK",2136.23,0,null],
  // 19-May
  ["2026-05-19","SupI","GST/634/2026-27","Robotek LLP (HR)",0,62188,null],
  ["2026-05-19","SupI","GST/634/2026-27","Purchase",52955,0,null],
  ["2026-05-19","SupI","GST/634/2026-27","Rounded Off",0.10,0,null],
  ["2026-05-19","SupI","GST/634/2026-27","IGST",9232.90,0,null],
  ["2026-05-19","SupI","GST/646/2026-27","Robotek LLP (HR)",0,60221,null],
  ["2026-05-19","SupI","GST/646/2026-27","Purchase",51136,0,null],
  ["2026-05-19","SupI","GST/646/2026-27","Rounded Off",0.12,0,null],
  ["2026-05-19","SupI","GST/646/2026-27","IGST",9084.88,0,null],
  ["2026-05-19","Pymt","12","UNIVERSAL SOMPO GENERAL INSURANCE COMPAN",5123,0,null],
  ["2026-05-19","Pymt","12","IDBI BANK",0,5123,null],
  // 20-May
  ["2026-05-20","SupI","GST/657/2026-27","Robotek LLP (HR)",0,123635,null],
  ["2026-05-20","SupI","GST/657/2026-27","Purchase",104775,0,null],
  ["2026-05-20","SupI","GST/657/2026-27","Rounded Off",0.50,0,null],
  ["2026-05-20","SupI","GST/657/2026-27","IGST",18859.50,0,null],
  ["2026-05-20","SupO","GST/040/2026-27","A.S ELECTRONICS",10484,0,null],
  ["2026-05-20","SupO","GST/040/2026-27","Sales",0,8884.99,null],
  ["2026-05-20","SupO","GST/040/2026-27","IGST",0,1599.30,null],
  ["2026-05-20","SupO","GST/040/2026-27","Rounded Off",0.29,0,null],
  ["2026-05-20","Rcpt","57","Robotek LLP (HR)",0,150000,null],
  ["2026-05-20","Rcpt","57","IDBI BANK",150000,0,null],
  ["2026-05-20","Rcpt","58","FLIPKART INTERNET PVT LTD",0,1007.41,null],
  ["2026-05-20","Rcpt","58","IDBI BANK",1007.41,0,null],
  ["2026-05-20","Rcpt","59","FLIPKART INTERNET PVT LTD",0,3030.61,null],
  ["2026-05-20","Rcpt","59","IDBI BANK",3030.61,0,null],
  ["2026-05-20","Rcpt","60","Unregisterd Dealer",0,831,"DELHIVERY LIMITED"],
  ["2026-05-20","Rcpt","60","IDBI BANK",831,0,null],
  ["2026-05-20","Pymt","13","IGST",199586,0,null],
  ["2026-05-20","Pymt","13","IDBI BANK",0,199586,null],
  // 21-May
  ["2026-05-21","SupI","GST/668/2026-27","Robotek LLP (HR)",0,51584,null],
  ["2026-05-21","SupI","GST/668/2026-27","Purchase",43987.15,0,null],
  ["2026-05-21","SupI","GST/668/2026-27","Rounded Off",0.49,0,null],
  ["2026-05-21","SupI","GST/668/2026-27","IGST",7596.36,0,null],
  ["2026-05-21","SupO","GST/041/2026-27","IERA INDUSTRY",9629,0,null],
  ["2026-05-21","SupO","GST/041/2026-27","Sales",0,8160,null],
  ["2026-05-21","SupO","GST/041/2026-27","IGST",0,1468.80,null],
  ["2026-05-21","SupO","GST/041/2026-27","Rounded Off",0,0.20,null],
  ["2026-05-21","SupO","GST/042/2026-27","Hello Telecom",10881,0,null],
  ["2026-05-21","SupO","GST/042/2026-27","Sales",0,9220.80,null],
  ["2026-05-21","SupO","GST/042/2026-27","IGST",0,1659.74,null],
  ["2026-05-21","SupO","GST/042/2026-27","Rounded Off",0,0.46,null],
  ["2026-05-21","SupO","GST/043/2026-27","SWASTIK MOBILE ACCESSORIES",19426,0,null],
  ["2026-05-21","SupO","GST/043/2026-27","Sales",0,16462.80,null],
  ["2026-05-21","SupO","GST/043/2026-27","IGST",0,2963.30,null],
  ["2026-05-21","SupO","GST/043/2026-27","Rounded Off",0.10,0,null],
  ["2026-05-21","Rcpt","61","PARKASH DISTRIBUTORS",0,27398,null],
  ["2026-05-21","Rcpt","61","IDBI BANK",27398,0,null],
  ["2026-05-21","Rcpt","62","Unregisterd Dealer",0,1234,"DELHIVERY LIMITED"],
  ["2026-05-21","Rcpt","62","IDBI BANK",1234,0,null],
  // 22-May
  ["2026-05-22","Rcpt","63","FLIPKART INTERNET PVT LTD",0,157.66,null],
  ["2026-05-22","Rcpt","63","IDBI BANK",157.66,0,null],
  ["2026-05-22","Rcpt","64","FLIPKART INTERNET PVT LTD",0,143.81,null],
  ["2026-05-22","Rcpt","64","IDBI BANK",143.81,0,null],
  // 23-May
  ["2026-05-23","Pymt","14","Robotek LLP (HR)",50000,0,null],
  ["2026-05-23","Pymt","14","IDBI BANK",0,50000,null],
  // 25-May
  ["2026-05-25","Rcpt","65","FLIPKART INTERNET PVT LTD",0,2912.52,null],
  ["2026-05-25","Rcpt","65","IDBI BANK",2912.52,0,null],
  ["2026-05-25","Rcpt","66","FLIPKART INTERNET PVT LTD",0,5050.83,null],
  ["2026-05-25","Rcpt","66","IDBI BANK",5050.83,0,null],
  ["2026-05-25","Rcpt","67","FLIPKART INTERNET PVT LTD",0,5950.11,null],
  ["2026-05-25","Rcpt","67","IDBI BANK",5950.11,0,null],
  // 27-May
  ["2026-05-27","SupO","GST/044/2026-27","JAMIDARA AUTO ELECTRIC SERVICE",8549,0,null],
  ["2026-05-27","SupO","GST/044/2026-27","Sales",0,7244.60,null],
  ["2026-05-27","SupO","GST/044/2026-27","IGST",0,1304.03,null],
  ["2026-05-27","SupO","GST/044/2026-27","Rounded Off",0,0.37,null],
  ["2026-05-27","Rcpt","68","JAMIDARA AUTO ELECTRIC SERVICE",0,8549,null],
  ["2026-05-27","Rcpt","68","IDBI BANK",8549,0,null],
  ["2026-05-27","Rcpt","69","MITTAL ENTERPRISE",0,1164,null],
  ["2026-05-27","Rcpt","69","IDBI BANK",1164,0,null],
  // 31-May
  ["2026-05-31","Jrnl","2","TDS (Rent of Land)",0,10000,"APRIL & MAY"],
  ["2026-05-31","Jrnl","2","AMAN AGGARWAL(RENT)",10000,0,null],
  ["2026-05-31","Jrnl","4","TDS (Rent of Land)",0,10000,"APRIL & MAY"],
  ["2026-05-31","Jrnl","4","SAHIL AGGARWAL(RENT)",10000,0,null],
];

// ─── BANK ACCOUNT + STATEMENTS ──────────────────────────────────────────────

async function ensureBankAccount() {
  const accountNumber = "1009102000012050";
  const { data: existing } = await db.from("bank_accounts")
    .select("*").eq("company_id", COMPANY_ID).eq("account_number", accountNumber).maybeSingle();
  if (existing) {
    console.log(`  ✓ Existing IDBI bank_account: ${existing.id}`);
    return existing;
  }

  // Opening balance = balance after first April txn - amount = pre-balance.
  // srl=42 (oldest in source), Cr 328.00, balance 772414.67. Opening = 772414.67 - 328.00 = 772086.67
  const apr = IDBI_APRIL.slice().sort((a,b) => b[0] - a[0]); // chronological asc
  const first = apr[0];
  const opening = first[5] === "Cr" ? first[7] - first[6] : first[7] + first[6];

  const { data, error } = await db.from("bank_accounts").insert({
    company_id: COMPANY_ID,
    bank_name: "IDBI Bank",
    account_number: accountNumber,
    account_number_last4: "2050",
    account_holder_name: "AGGARWAL ENTERPRISE",
    account_type: "current",
    currency: "INR",
    period_start: "2026-04-01",
    period_end: "2026-04-01",
    statement_date: "2026-04-01",
    opening_balance: inPaisa(opening),
    closing_balance: inPaisa(opening),
  }).select("*").single();
  if (error) throw new Error(`bank_account insert: ${error.message}`);
  console.log(`  ✓ Created IDBI bank_account: ${data.id} (opening ₹${opening.toLocaleString("en-IN")})`);
  return data;
}

async function importBankMonth(acct, txns, fname) {
  console.log(`\n▶ ${fname} (${txns.length} txns)`);
  const sorted = txns.slice().sort((a,b) => b[0] - a[0]);
  const import_id = await createImport(fname, "xls", "bank_statement");
  const stmts = sorted.map(t => ({
    bank_account_id: acct.id,
    transaction_date: t[1],
    value_date: t[2],
    description: t[3],
    reference: t[4],
    debit:  t[5] === "Dr" ? inPaisa(t[6]) : 0,
    credit: t[5] === "Cr" ? inPaisa(t[6]) : 0,
    balance: inPaisa(t[7]),
    import_id,
  }));
  const ok = await insertBatched("bank_statements", stmts);
  await finishImport(import_id, ok);
  const last = sorted[sorted.length - 1];
  console.log(`  ✓ Inserted ${ok} rows · last date ${last[1]} · closing ₹${Number(last[7]).toLocaleString("en-IN")}`);
  return { lastDate: last[1], lastBalance: last[7] };
}

// ─── DAY BOOK IMPORT ────────────────────────────────────────────────────────

async function importDayBook() {
  const fname = "DayBook.xlsx (Aggarwal Apr-May 2026)";
  console.log(`\n▶ ${fname} (${DAYBOOK.length} ledger lines)`);
  const import_id = await createImport(fname, "xlsx", "transactions");

  const txns = DAYBOOK.map(([date, vchType, vchNo, ledger, debit, credit, narration]) => {
    const dr = Number(debit) || 0;
    const cr = Number(credit) || 0;
    return {
      company_id: COMPANY_ID,
      transaction_date: date,
      voucher_number: vchNo,
      voucher_type: vchType,
      ledger_name: ledger,
      amount: dr > 0 ? dr : cr,
      dr_cr: dr > 0 ? "DR" : "CR",
      narration: narration,
      financial_year: FY,
      import_id,
    };
  });

  // Skip zero-amount rows
  const nonZero = txns.filter(t => Number(t.amount) > 0);

  // Tally counts per voucher_type (counting distinct vouchers, not lines)
  const distinctVouchers = new Set();
  const voucherTypeCounts = {};
  for (const t of nonZero) {
    const key = `${t.voucher_type}|${t.voucher_number}`;
    if (!distinctVouchers.has(key)) {
      distinctVouchers.add(key);
      voucherTypeCounts[t.voucher_type] = (voucherTypeCounts[t.voucher_type] || 0) + 1;
    }
  }

  const ok = await insertBatched("transactions", nonZero);
  await finishImport(import_id, ok);
  console.log(`  ✓ Inserted ${ok} ledger lines across ${distinctVouchers.size} vouchers`);
  for (const [k, v] of Object.entries(voucherTypeCounts)) console.log(`    · ${k}: ${v}`);
  return { lines: ok, vouchers: distinctVouchers.size, types: voucherTypeCounts };
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

console.log(`\nAggarwal import — Company ${COMPANY_ID}`);

const acct = await ensureBankAccount();
const aprResult = await importBankMonth(acct, IDBI_APRIL, "agg april.xls");
const mayResult = await importBankMonth(acct, IDBI_MAY,   "agg may.xls");

await db.from("bank_accounts").update({
  period_end: mayResult.lastDate,
  statement_date: mayResult.lastDate,
  closing_balance: inPaisa(mayResult.lastBalance),
}).eq("id", acct.id);
console.log(`\n  ✓ Updated bank_account: period ${acct.period_start || "2026-04-01"} → ${mayResult.lastDate}, closing ₹${mayResult.lastBalance.toLocaleString("en-IN")}`);

const dbResult = await importDayBook();

// Reconciliation
console.log("\n=== Reconciliation ===");
const { data: a2 } = await db.from("bank_accounts").select("*").eq("id", acct.id).single();
const { data: rows } = await db.from("bank_statements").select("debit, credit").eq("bank_account_id", acct.id);
let d = 0, c = 0;
for (const r of rows) { d += Number(r.debit); c += Number(r.credit); }
const swing = (Number(a2.closing_balance) - Number(a2.opening_balance)) / 100;
const net   = (c - d) / 100;
const diff  = Math.abs(swing - net);
console.log(`IDBI ···2050 | ${a2.period_start} → ${a2.period_end}`);
console.log(`  Opening: ₹${(Number(a2.opening_balance)/100).toLocaleString("en-IN")}  Closing: ₹${(Number(a2.closing_balance)/100).toLocaleString("en-IN")}`);
console.log(`  Debits:  ₹${(d/100).toLocaleString("en-IN")}  Credits: ₹${(c/100).toLocaleString("en-IN")}`);
console.log(`  Swing:   ₹${swing.toLocaleString("en-IN")}  Net (Cr-Dr): ₹${net.toLocaleString("en-IN")}`);
console.log(`  Diff: ₹${diff.toFixed(2)} ${diff < 5 ? "✓" : "⚠"}`);

console.log("\n✓ Done.\n");
