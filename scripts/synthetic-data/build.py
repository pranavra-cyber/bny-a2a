"""Builds xlsx workbooks (Drive folder tree) and DATA_DICTIONARY.md from <repo>/data CSVs into out/."""
import csv, os, shutil, zipfile
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

H = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(H, "..", "..", "data")
DRV = os.path.join(H, "out", "drive", "A2A Prototype Synthetic Data")
LINE = "Synthetic data for an illustrative prototype. No real accounts, people or events."
EXTRACT = {"bny": "2026-11-19 09:00 ET", "goldman": "2026-11-19T14:00:00Z", "dtc": "2026-11-19 09:00 ET", "allianzgi": "19.11.2026 15:00 CET"}

WB = [  # (folder, workbook title, firm, [tabs], system imitated)
 ("BNY/Custody Platform Extracts", "BNY Client & Account Master", "bny", ["client_accounts"], "BNY custody client static data (account master)"),
 ("BNY/Custody Platform Extracts", "BNY Reference Data", "bny", ["securities_master", "ssi_counterparties"], "BNY securities master and standing settlement instruction (SSI) database"),
 ("BNY/Custody Platform Extracts", "BNY Settlement Instructions Log", "bny", ["settlement_instructions"], "BNY settlement instruction processing platform"),
 ("BNY/Custody Platform Extracts", "BNY Instruction Repair Queue", "bny", ["repair_queue"], "BNY instruction repair workflow, incl. digital employee DE-REPAIR-01"),
 ("BNY/Custody Platform Extracts", "BNY Safekeeping Positions", "bny", ["positions"], "BNY safekeeping / positions system, end-of-day 2026-11-18"),
 ("BNY/Custody Platform Extracts", "BNY Cash Ledger", "bny", ["cash_ledger"], "BNY cash accounting ledger"),
 ("BNY/Custody Platform Extracts", "BNY Fails & Exceptions Tracker", "bny", ["fails_exceptions"], "BNY fails and exceptions management tool"),
 ("BNY/Custody Platform Extracts", "BNY Client Inquiries (DISC export)", "bny", ["client_inquiries"], "BNY client inquiry case tool with DISC drafting"),
 ("Goldman Sachs/Ops Extracts", "GS Equity Trade Blotter", "goldman", ["trade_blotter"], "Goldman Sachs US cash equities trade booking"),
 ("Goldman Sachs/Ops Extracts", "GS Allocations & Confirms", "goldman", ["allocations_confirms"], "Goldman Sachs allocation and CTM confirmation records"),
 ("Goldman Sachs/Ops Extracts", "GS DTC Deliveries", "goldman", ["deliveries"], "Goldman Sachs DTC delivery instructions (participant 0005)"),
 ("Goldman Sachs/Ops Extracts", "GS Fails Management", "goldman", ["fails"], "Goldman Sachs fails management queue"),
 ("Goldman Sachs/Ops Extracts", "GS Box & Inventory", "goldman", ["inventory"], "Goldman Sachs box / inventory position at DTC"),
 ("Goldman Sachs/Ops Extracts", "GS Counterparty SSI Book", "goldman", ["ssi_book"], "Goldman Sachs client and custodian SSI book"),
 ("Goldman Sachs/Ops Extracts", "GS Stock Loan & Borrow", "goldman", ["stock_loan"], "Goldman Sachs securities lending and borrowing book"),
 ("DTC", "DTC Settlement Activity Feed", "dtc", ["settlement_activity"], "DTC settlement event feed (DVP deliveries, both participants' view)"),
 ("DTC", "DTC Participant Directory", "dtc", ["participants"], "DTC participant directory"),
 ("Allianz Global Investors", "AGI OMS Orders Export", "allianzgi", ["orders"], "AllianzGI order management system"),
 ("Allianz Global Investors", "AGI Allocations", "allianzgi", ["allocations"], "AllianzGI OMS allocations to custodians"),
 ("Allianz Global Investors", "AGI Fund List", "allianzgi", ["funds"], "AllianzGI fund static data"),
 ("Allianz Global Investors", "AGI Approved Broker List", "allianzgi", ["broker_list"], "AllianzGI approved broker list"),
]
DOCS = [  # (folder, title, firm, md file)
 ("BNY/Procedures", "Settlement Operations Procedures", "bny", "settlement_operations_procedures.md"),
 ("BNY/Procedures", "Repair Queue Runbook", "bny", "repair_queue_runbook.md"),
 ("BNY/Procedures", "AllianzGI Service Level Summary", "bny", "allianzgi_service_level_summary.md"),
 ("BNY/Correspondence", "Ops Team Chat Export - Nov 18-19", "bny", "ops_team_chat_export_nov_18_19.md"),
 ("Goldman Sachs/Procedures", "Fails Desk Procedures", "goldman", "fails_desk_procedures.md"),
 ("Goldman Sachs/Correspondence", "Fails Desk Email Thread - NVDA DK", "goldman", "fails_desk_email_thread_nvda_dk.md"),
 ("Allianz Global Investors", "OMS Log - Allocation amendment 2026-11-18", "allianzgi", "oms_log_allocation_amendment_2026_11_18.md"),
]

# column dictionary: table -> col -> (type/format, description incl. allowed values)
C = {}
def t(table, *cols):
    C[table] = {c[0]: (c[1], c[2]) for c in cols}
t("client_accounts",
 ("account_id","text, NNNN-CODE-SUFFIX","BNY account number, e.g. 4471-AGI-GLEQ"),("client_legal_name","text","Client legal entity"),("client_short_code","text","Short code used across BNY tools, e.g. AGI"),
 ("fund_name","text","Fund or portfolio held in the account"),("account_type","enum","CUSTODY, CASH"),("base_currency","ISO 4217","USD, EUR"),("client_tier","int 1-3","1 = highest service tier"),
 ("relationship_manager","text","BNY RM (synthetic name)"),("service_executive","text","BNY service executive (synthetic name)"),("status","enum","OPEN"),("opened_date","date YYYY-MM-DD","Account opening date"))
t("securities_master",
 ("bny_sec_id","text BNYSnnnnnn","BNY internal security id"),("isin","text 12","ISIN"),("cusip","text 9","CUSIP"),("ticker","text","Exchange ticker; blank for bonds"),("issuer_name","text","Issuer / description"),
 ("asset_class","enum","EQUITY, ETF, UST, CORP_BOND"),("currency","ISO 4217","USD"),("primary_exchange","enum","NASDAQ, NYSE, OTC"),("settlement_cycle","enum","T+1 (T+2 on one inactive legacy record)"),
 ("settlement_location","enum","DTC, FED (Treasuries settle on Fedwire)"),("ref_price","decimal","Reference price, USD (bonds per 100 face)"),("id_source","enum","public = real identifier of a listed security; synthetic = invented"),
 ("status","enum","ACTIVE, INACTIVE"))
t("ssi_counterparties",
 ("ssi_id","text SSI-XX-US-AC-PPPP","SSI record id"),("counterparty_name","text","Broker-dealer"),("counterparty_lei","text 20","LEI (synthetic)"),("market","text","US"),("asset_class","enum","EQUITY, FIXED_INCOME"),
 ("depository","text","DTC"),("dtc_participant","text 4","Counterparty DTC participant number (0005 real for GS; others synthetic 71xx)"),("agent_bic","text","Agent BIC (synthetic)"),
 ("effective_date","date","Start of validity"),("end_date","date","End of validity; blank if open"),("verified_by","text","Analyst who verified the SSI"),("verification_date","date","Date verified"),
 ("status","enum","ACTIVE, SUPERSEDED, PENDING_VERIFICATION"))
t("settlement_instructions",
 ("instruction_id","text BNYI-YYYYMMDD-nnnnnnn","BNY instruction reference"),("received_ts_et","datetime ET YYYY-MM-DD HH:MM:SS","When BNY received the instruction"),
 ("source_channel","enum","SWIFT_MT541, SWIFT_MT543, CTM, PORTAL"),("client_account_id","text","FK client_accounts.account_id"),("client_ref","text","Client's own reference (AGI order id for AllianzGI)"),
 ("direction","enum","RVP (receive vs payment, client buy), DVP (deliver vs payment, client sell)"),("isin","text","FK securities_master.isin"),("quantity","number","Shares or face amount"),("price","decimal","Trade price"),
 ("settlement_amount","decimal USD","Net settlement amount"),("currency","ISO 4217","USD"),("trade_date","date","Trade date"),("settle_date","date","Contractual settlement date"),
 ("counterparty_name","text","Executing broker"),("cpty_dtc_participant","text 4","Counterparty DTC participant; blank when missing"),("settlement_location","enum","DTC, FED"),
 ("amends_instruction_id","text","Instruction this one amends; blank if new"),("status","enum","RECEIVED, IN_REPAIR, ENRICHED, SENT_TO_DTC, SENT_TO_FED, MATCHED, SETTLED, PENDING_SETTLEMENT, CANCELLED"),("status_ts_et","datetime ET","Last status change"))
t("repair_queue",
 ("repair_id","text RQ-YYYYMMDD-nnnn","Repair item id"),("instruction_id","text","FK settlement_instructions"),("opened_ts_et","datetime ET","When the item entered the queue"),
 ("repair_reason","enum","MISSING_SEC_ID, MISSING_CPTY_PARTICIPANT, QTY_PRICE_MISMATCH, INVALID_SSI, MISSING_SETTLE_DATE, DUPLICATE_SUSPECT"),("routed_to","enum","DIGITAL_EMPLOYEE (MISSING_SEC_ID only), HUMAN"),
 ("priority_score","decimal 0-100","From cutoff, value, client tier, exposure"),("cutoff_ts_et","datetime ET","Repair cutoff (14:30 ET on settle date)"),("trade_value_usd","decimal","Settlement amount"),
 ("assigned_to","text","DE-REPAIR-01 or analyst; blank if unassigned"),("resolution","enum","ENRICHED_FROM_REFDATA, REJECTED_NO_REFDATA_MATCH, CORRECTED_PER_CLIENT, ENRICHED_FROM_SSI, CANCELLED_DUPLICATE, CONFIRMED_WITH_CLIENT; blank if open"),
 ("resolved_ts_et","datetime ET","Blank if open"),("verified_by","text","Second analyst (four-eyes)"),("comments","text","Free text by ops staff"))
t("positions",
 ("as_of_date","date","Position date (EOD)"),("account_id","text","FK client_accounts"),("isin","text","FK securities_master"),("quantity","number","Settled position"),
 ("pending_receipts","number","Quantity due in from live receive instructions settling next day"),("pending_deliveries","number","Quantity due out"),("market_value_usd","decimal","quantity x ref_price"))
t("cash_ledger",
 ("entry_id","text CL-...","Ledger entry id"),("account_id","text","Cash account (AGC for AllianzGI) or custody account"),("value_date","date","Value date"),("amount","decimal","Signed: negative = debit"),
 ("currency","ISO 4217","USD"),("entry_type","enum","TRADE_SETTLEMENT"),("related_instruction_id","text","FK settlement_instructions"),("status","enum","POSTED"))
t("fails_exceptions",
 ("exception_id","text EXC-YYYYMMDD-nnnn","Exception id"),("instruction_id","text","FK settlement_instructions"),("dtc_reference","text","FK DTC settlement_activity; blank for Fed"),("detected_ts_et","datetime ET","Detected"),
 ("fail_reason","enum","LACK_OF_SECURITIES, SSI_MISMATCH, LATE_AFFIRMATION, DK_QTY_MISMATCH, ON_HOLD, CASH_SHORTFALL"),("counterparty_name","text","Broker"),("days_outstanding","int","Blank once resolved"),
 ("status","enum","OPEN, RESOLVED"),("owner","text","Analyst; blank if unassigned"),("resolution_notes","text","Free text"))
t("client_inquiries",
 ("inquiry_id","text INQ-YYYYMMDD-nnnnn","Inquiry id"),("received_ts_et","datetime ET","Received"),("client_short_code","text","FK client short code"),("channel","enum","EMAIL, PORTAL, PHONE"),
 ("intent","enum","TRANSACTION_STATUS, CORP_ACTION, TAX, OTHER"),("related_instruction_id","text","For status inquiries"),("draft_by","enum","DISC (AI draft, human reviewed), HUMAN"),
 ("response_seconds","int","Time to draft reply (DISC ~25s, human ~90s)"),("reviewed_by","text","Analyst"),("status","enum","CLOSED"))
t("trade_blotter",
 ("gs_trade_ref","text GS-EQ-YYYYMMDD-nnnnnn","Goldman trade reference"),("exec_ts_utc","datetime ISO 8601 Z","Execution time, UTC"),("client_name","text","Client (no custodian account ids here)"),
 ("side","enum","GS side: BUY, SELL"),("client_side","enum","Client side: BUY, SELL"),("ticker","text","Ticker"),("isin","text","ISIN"),("quantity","number","Shares"),("price","decimal","Price"),
 ("gross_amount","decimal","quantity x price"),("commission","decimal","Commission charged"),("trade_date","date","Trade date"),("settle_date","date","Settlement date"),("desk","text","Desk"),("trader_id","text","Trader id"),("status","enum","BOOKED"))
t("allocations_confirms",
 ("alloc_id","text AL-...-n","Allocation id"),("gs_trade_ref","text","FK trade_blotter"),("client_name","text","Client"),("client_account_ref","text","Client's reference (AGI order id)"),("quantity","number","Allocated quantity"),
 ("custodian_name","text","Client's custodian"),("custodian_dtc_participant","text 4","Custodian participant (BNY 0901 real; others synthetic 72xx)"),("ctm_confirm_id","text CTM-nnnnnnnn","CTM confirmation id; same id across versions"),
 ("affirmed","Y/N","Affirmed in CTM"),("affirmed_ts_utc","datetime Z","Affirmation time"),("version","int","Allocation version"),("status","enum","AFFIRMED, PENDING_AFFIRMATION, SUPERSEDED"))
t("deliveries",
 ("delivery_id","text DEL-...","Goldman delivery id"),("gs_trade_ref","text","FK trade_blotter"),("dtc_reference","text","Depository reference, shared with DTC and custodian"),("from_participant","text 4","Deliverer"),
 ("to_participant","text 4","Receiver"),("isin","text","ISIN"),("quantity","number","Shares"),("settlement_amount","decimal","USD"),("instructed_ts_utc","datetime Z","Instructed at DTC"),
 ("status","enum","DELIVERED (instructed, awaiting), SETTLED, PENDING, DK"),("status_ts_utc","datetime Z","Last status"),("dk_reason","text","Reason given by receiver"))
t("fails",
 ("gs_fail_id","text GS-FAIL-YYYYMMDD-nnnn","Fail id"),("delivery_id","text","FK deliveries"),("counterparty_custodian","text","Receiving / delivering custodian"),
 ("fail_reason","enum","SHORT_INVENTORY, CPTY_SSI_MISMATCH, UNAFFIRMED, DK_BY_RECEIVER, HELD, CPTY_CASH"),("opened_ts_utc","datetime Z","Opened"),("age_days","int","Days since settle date"),
 ("exposure_usd","decimal","Value"),("owner","text","Desk queue; blank if unassigned"),("next_action","text","Planned action"),("status","enum","OPEN, CLOSED"))
t("inventory",("as_of_date","date","Snapshot date"),("isin","text","ISIN"),("box_location","text","DTC-0005"),("quantity_available","number","Free to deliver"),("quantity_pledged","number","Pledged"),("quantity_on_loan","number","Lent out"))
t("ssi_book",("ssi_ref","text GSSSI-nnnnn","Goldman SSI id"),("custodian_name","text","Client's custodian"),("client_name","text","Client"),("market","text","US"),("dtc_participant","text 4","Custodian participant"),("effective_date","date","From"),("status","enum","ACTIVE"))
t("stock_loan",("loan_id","text SL-...","Loan id"),("isin","text","ISIN"),("quantity","number","Shares"),("counterparty","text","Lender/borrower"),("direction","enum","LEND, BORROW"),("start_date","date","Start"),("recall_status","enum","NONE, RECALLED, RECALL_PENDING"))
t("settlement_activity",
 ("dtc_reference","text DTC-DO-YYYYMMDD-nnnnnn","Depository delivery reference (one per delivery, several events)"),("event_ts_et","datetime ISO 8601 with -05:00","Event time, ET"),
 ("deliverer_participant","text 4","FK participants"),("receiver_participant","text 4","FK participants"),("isin","text","ISIN"),("quantity","number","Shares / face"),("settlement_amount","decimal","USD"),
 ("transaction_type","enum","DVP"),("event","enum","INSTRUCTED, SETTLED, PENDING, DK"),("reason_code","enum","QTY_MISMATCH, INSUFFICIENT_POSITION; blank otherwise"))
t("participants",("participant_number","text 4","DTC participant number (0901, 0005 real; others synthetic)"),("participant_name","text","Firm"),("type","enum","CUSTODIAN, BROKER_DEALER"),("id_source","enum","public, synthetic"),("status","enum","ACTIVE, INACTIVE"))
t("orders",
 ("agi_order_id","text AGI-ORD-YY-DDD-nnnn","OMS order id (DDD = day of year)"),("created_ts_cet","datetime DD.MM.YYYY HH:MM CET","Order created"),("portfolio_manager","text","PM (synthetic)"),("fund_code","text","FK funds"),
 ("side","enum","BUY, SELL"),("isin","text","ISIN"),("quantity","number","Order quantity"),("limit_price","decimal","Limit"),("broker","text","FK broker_list"),("status","enum","FILLED"))
t("allocations",
 ("allocation_id","text ALC-...-v","Allocation id; suffix is version"),("agi_order_id","text","FK orders"),("fund_code","text","FK funds"),("quantity","number","Allocated quantity"),("version","int","1 = original"),
 ("amended_ts_cet","datetime CET","Blank unless amended"),("custodian","text","BNY"),("sent_to_custodian_ts_cet","datetime CET","When the allocation reached the custodian feed"),("status","enum","SENT, SUPERSEDED"))
t("funds",("fund_code","text","AGI-XXXX"),("fund_name","text","Fund name (synthetic)"),("domicile","ISO country","LU, DE, UK"),("custodian","text","BNY"),("base_currency","ISO 4217","USD, EUR"))
t("broker_list",("broker_name","text","Broker legal name"),("broker_lei","text","LEI (synthetic)"),("approved_markets","text","Semicolon list"),("status","enum","APPROVED"))

TEXT_COLS = {"cusip","isin","dtc_participant","cpty_dtc_participant","custodian_dtc_participant","participant_number","from_participant","to_participant","deliverer_participant","receiver_participant","account_id","client_account_id","counterparty_lei","broker_lei"}
NUM_COLS = {"quantity","price","settlement_amount","gross_amount","commission","ref_price","pending_receipts","pending_deliveries","market_value_usd","amount","trade_value_usd","priority_score",
            "exposure_usd","quantity_available","quantity_pledged","quantity_on_loan","limit_price","response_seconds","days_outstanding","age_days","client_tier","version"}

def read(firm, tab):
    with open(os.path.join(DATA, firm, tab + ".csv")) as f:
        r = list(csv.reader(f))
    return r[0], r[1:]

def conv(col, v):
    if v == "" or col not in NUM_COLS: return v
    try: return int(v) if v.lstrip("-").isdigit() else float(v)
    except ValueError: return v

def build():
    if os.path.exists(os.path.join(H, "out", "drive")): shutil.rmtree(os.path.join(H, "out", "drive"))
    counts = {}
    hdr_fill = PatternFill("solid", fgColor="00243E")
    for folder, title, firm, tabs, system in WB:
        wb = Workbook(); ws = wb.active; ws.title = "README"
        rows = {tab: read(firm, tab) for tab in tabs}
        ws["A1"] = LINE; ws["A1"].font = Font(bold=True)
        ws["A3"], ws["B3"] = "Workbook", title
        ws["A4"], ws["B4"] = "System imitated", system
        ws["A5"], ws["B5"] = "Last extract", EXTRACT[firm]
        r = 7; ws.cell(r, 1, "Tab").font = Font(bold=True); ws.cell(r, 2, "Rows").font = Font(bold=True); ws.cell(r, 3, "Exports to").font = Font(bold=True)
        for tab in tabs:
            r += 1; ws.cell(r, 1, tab); ws.cell(r, 2, len(rows[tab][1])); ws.cell(r, 3, f"/data/{firm}/{tab}.csv")
            counts[(firm, tab)] = len(rows[tab][1])
        ws.column_dimensions["A"].width = 18; ws.column_dimensions["B"].width = 60; ws.column_dimensions["C"].width = 40
        for tab in tabs:
            h, data = rows[tab]; s = wb.create_sheet(tab); s.append(h)
            for c in s[1]: c.font = Font(bold=True, color="FFFFFF"); c.fill = hdr_fill
            for row in data: s.append([conv(h[i], v) for i, v in enumerate(row)])
            for i, col in enumerate(h, 1):
                if col in TEXT_COLS:
                    for cell in s.iter_rows(min_row=2, min_col=i, max_col=i):
                        cell[0].number_format = "@"
                s.column_dimensions[get_column_letter(i)].width = max(10, min(40, len(col) + 4))
            s.freeze_panes = "A2"
        d = os.path.join(DRV, folder); os.makedirs(d, exist_ok=True)
        wb.save(os.path.join(d, title + ".xlsx"))
    return counts

def dictionary(counts):
    out = ["# DATA_DICTIONARY", "", f"*{LINE}*", "",
           "Every table in the synthetic data estate. Each table is one tab in a Google Sheet and exports to `/data/<firm>/<tab>.csv`. Dates are `YYYY-MM-DD` unless the format column says otherwise. Each firm uses its own time zone and timestamp format: BNY and DTC in US Eastern, Goldman Sachs in UTC, AllianzGI in CET with European date format.", ""]
    for folder, title, firm, tabs, system in WB:
        for tab in tabs:
            h, data = read(firm, tab)
            out += [f"## {firm}/{tab}", "", f"**Workbook:** {title} · **Folder:** {folder} · **Imitates:** {system} · **Rows:** {counts[(firm, tab)]}", "",
                    "| Column | Type / format | Description and allowed values | Example |", "|---|---|---|---|"]
            for i, col in enumerate(h):
                typ, desc = C[tab].get(col, ("text", ""))
                ex = next((r[i] for r in data if r[i]), "")
                out.append(f"| {col} | {typ} | {desc} | {ex} |")
            out.append("")
    return "\n".join(out)

if __name__ == "__main__":
    counts = build()
    dd = dictionary(counts)
    open(os.path.join(H, "out", "DATA_DICTIONARY.md"), "w").write(dd)
    for k, v in counts.items(): print(k, v)
