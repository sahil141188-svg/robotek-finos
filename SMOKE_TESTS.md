# Smoke Tests — Robotek FinOS Banking Module

Run these 5 tests after each deploy. Each takes < 2 minutes.

---

## Test 1 — Upload correct data

**Steps:**
1. Go to `/dashboard/banking` → click "Import / Update Data"
2. Upload a valid Kotak PDF bank statement
3. Wait for import to finish

**Expected:**
- Import status = **Done** (green badge in /dashboard/imports)
- Bank account card shows **"Kotak Mahindra Bank"** (not HDFC/ICICI/Unknown)
- Account type shows **"Current Account"** (not "Unknown")
- Closing balance looks reasonable (matches last line of PDF)
- Inflow/outflow KPI tiles show **Lakhs / Crores** (not 100× inflated)

**Fail signs:**
- Wrong bank name → detect-bank.ts two-pass fix not deployed
- "Unknown" account type → account_type normalisation not deployed
- Balance 100× too high → B5 fix not deployed

---

## Test 2 — Upload wrong data (invalid file)

**Steps:**
1. Go to Import → try to upload a non-bank PDF (e.g. a GST return PDF)
2. Try uploading a .docx file

**Expected:**
- Non-bank PDF: imports but shows 0 transactions, status = **Failed**
- .docx file: immediate error "Only PDF files are supported"
- No orphaned records in bank_accounts

**Fail signs:**
- App crashes with unhandled error
- .docx is accepted

---

## Test 3 — Upload duplicate (re-upload same file)

**Steps:**
1. Upload the Kotak statement again (same file as Test 1)

**Expected:**
- Import completes (status = Done)
- **No new account card** appears in /dashboard/banking
  (same 1 Kotak account, not 2)
- Transaction count may increase if same transactions get re-inserted
  (acceptable for now — full txn dedup is Day 2 work)

**Fail signs:**
- A second Kotak card appears → B6 (dupe check) not working
- Import status shows "Done" when it should note the account already existed

---

## Test 4 — Dashboard total consistency

**Steps:**
1. Open `/dashboard/banking`
2. Note the **Total Liquidity** figure
3. Manually sum the **Closing Balance** of each account card

**Expected:**
- Total Liquidity = sum of all account closing balances (±₹1 due to rounding)
- Inflow and Outflow figures are in the correct Indian denomination:
  - If transactions total ~₹50 lakh → shows "₹50.00L" (NOT "₹50.00 Cr")

**Fail signs:**
- Total Liquidity ≠ sum of cards → calculateBankingSummary bug
- Inflow shows "₹4.84 Cr" but you know April receipts were ~₹4.84 lakh → B4 still present

---

## Test 5 — Delete import and verify cleanup

**Steps:**
1. Go to `/dashboard/imports`
2. Find one of the **wrong** HDFC/ICICI imports (from old bad detection)
3. Click trash → confirm delete
4. Go back to `/dashboard/banking`

**Expected:**
- The wrong account card **disappears** from the banking dashboard
- Total Liquidity updates immediately
- `/dashboard/imports` no longer shows that import row

**Fail signs:**
- Card still shows after delete → B1 (module name mismatch) not deployed
- Error on delete → check SUPABASE_SERVICE_ROLE_KEY env variable

---

## Quick reference — what each fix changed

| Bug | Symptom | Status |
|-----|---------|--------|
| B1 | Delete didn't remove accounts | ✅ Fixed |
| B2 | Shows "Unknown" account type | ✅ Fixed |
| B3 | Failed imports showed "Done" | ✅ Fixed |
| B4 | Inflow/outflow 100× too high | ✅ Fixed |
| B5 | Balance 100× too high | ✅ Fixed |
| B6 | Re-upload created duplicate cards | ✅ Fixed |
| B7 | Cashflow double-counted debit+credit | ✅ Fixed |
