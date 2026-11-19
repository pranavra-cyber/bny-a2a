"""Synthetic data generator for the BNY x CMU A2A prototype.
Deterministic (seed 20261119). Writes CSVs to <repo>/data/<firm>/<table>.csv
"""
import csv, os, random, datetime as dt
from collections import defaultdict
from zoneinfo import ZoneInfo

random.seed(20261119)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")

# ---------------- helpers ----------------
def cusip_check(base8):
    total = 0
    for i, ch in enumerate(base8):
        if ch.isdigit(): v = int(ch)
        elif ch.isalpha(): v = ord(ch.upper()) - 55
        else: v = {'*':36,'@':37,'#':38}[ch]
        if i % 2 == 1: v *= 2
        total += v // 10 + v % 10
    return str((10 - total % 10) % 10)

def isin_from_cusip(cusip, cc="US"):
    s = cc + cusip
    digits = "".join(str(int(c)) if c.isdigit() else str(ord(c) - 55) for c in s)
    total = 0
    for i, d in enumerate(reversed(digits)):
        n = int(d)
        if i % 2 == 0:
            n *= 2
            n = n // 10 + n % 10
        total += n
    return s + str((10 - total % 10) % 10)

def syn_lei():
    return "5493" + "".join(random.choice("ABCDEFGHJKLMNPQRSTUVWXYZ0123456789") for _ in range(14)) + f"{random.randint(10,99)}"

def write(firm, table, rows, cols):
    d = os.path.join(OUT, firm); os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, table + ".csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        def fmt(v):
            if v is None: return ""
            if isinstance(v, float) and v.is_integer(): return int(v)
            return v
        for r in rows: w.writerow({c: fmt(r.get(c)) for c in cols})
    print(f"{firm}/{table}: {len(rows)}")

# Real time zones (daylight saving included): US Eastern for BNY and DTC, Central
# European for AllianzGI, UTC for Goldman. In this window the US is on EDT (UTC-4)
# until 1 Nov and Europe on CEST (UTC+2) until 25 Oct.
ET = ZoneInfo("America/New_York")
UTC = dt.timezone.utc
CET = ZoneInfo("Europe/Berlin")
def et(d): return d.astimezone(ET).strftime("%Y-%m-%d %H:%M:%S")          # BNY style
def utc(d): return d.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")      # GS style
def cet(d): return d.astimezone(CET).strftime("%d.%m.%Y %H:%M")          # AGI style
def dtc_ts(d): return d.astimezone(ET).isoformat(timespec="seconds")     # DTC style
def D(s): return dt.date.fromisoformat(s)

# trading days Oct 20 - Nov 19 2026
days = []
d = D("2026-10-20")
while d <= D("2026-11-19"):
    if d.weekday() < 5: days.append(d)
    d += dt.timedelta(days=1)
def next_bd(d, n=1):
    i = days.index(d) if d in days else None
    if i is not None and i + n < len(days): return days[i + n]
    x = d
    while n:
        x += dt.timedelta(days=1)
        if x.weekday() < 5: n -= 1
    return x
def at(day, h, m, s=0, tz=ET): return dt.datetime(day.year, day.month, day.day, h, m, s, tzinfo=tz)

# ---------------- securities ----------------
EQ = [("NVDA","NVIDIA Corp","67066G104",186.25),("AAPL","Apple Inc","037833100",231.40),("MSFT","Microsoft Corp","594918104",468.10),
("AMZN","Amazon.com Inc","023135106",214.75),("GOOGL","Alphabet Inc Class A","02079K305",182.30),("META","Meta Platforms Inc","30303M102",612.90),
("TSLA","Tesla Inc","88160R101",248.60),("JPM","JPMorgan Chase & Co","46625H100",246.15),("JNJ","Johnson & Johnson","478160104",158.20),
("XOM","Exxon Mobil Corp","30231G102",112.45),("PG","Procter & Gamble Co","742718109",166.80),("V","Visa Inc Class A","92826C839",318.55),
("UNH","UnitedHealth Group Inc","91324P102",512.70),("HD","Home Depot Inc","437076102",401.25),("KO","Coca-Cola Co","191216100",68.90),
("PEP","PepsiCo Inc","713448108",152.35),("WMT","Walmart Inc","931142103",92.10),("BAC","Bank of America Corp","060505104",44.85),
("INTC","Intel Corp","458140100",24.60),("CSCO","Cisco Systems Inc","17275R102",61.75),("ORCL","Oracle Corp","68389X105",189.40),
("ADBE","Adobe Inc","00724F101",498.30),("NFLX","Netflix Inc","64110L106",871.20),("AMD","Advanced Micro Devices Inc","007903107",158.90),
("CRM","Salesforce Inc","79466L302",312.60),("LLY","Eli Lilly and Co","532457108",842.10),("MRK","Merck & Co Inc","58933Y105",101.35),
("PFE","Pfizer Inc","717081103",27.40),("CVX","Chevron Corp","166764100",154.80),("MA","Mastercard Inc Class A","57636Q104",526.40),
("COST","Costco Wholesale Corp","22160K105",948.70),("DIS","Walt Disney Co","254687106",112.90),("IBM","International Business Machines","459200101",231.60),
("AVGO","Broadcom Inc","11135F101",201.30),("QCOM","Qualcomm Inc","747525103",168.25),("TXN","Texas Instruments Inc","882508104",198.40),
("ABBV","AbbVie Inc","00287Y109",187.90),("T","AT&T Inc","00206R102",23.15),("VZ","Verizon Communications Inc","92343V104",42.70)]
ETF = [("SPY","SPDR S&P 500 ETF Trust","78462F103",612.40),("QQQ","Invesco QQQ Trust","46090E103",528.10),("IVV","iShares Core S&P 500 ETF","464287200",614.90)]
securities = []
n = 1
for tk, name, cus, px in EQ + ETF:
    securities.append(dict(bny_sec_id=f"BNYS{n:06d}", isin=isin_from_cusip(cus), cusip=cus, ticker=tk, issuer_name=name,
        asset_class="ETF" if (tk, name, cus, px) in ETF else "EQUITY", currency="USD", primary_exchange="NASDAQ" if tk in
        ("NVDA","AAPL","MSFT","AMZN","GOOGL","META","TSLA","INTC","CSCO","ADBE","NFLX","AMD","COST","AVGO","QCOM","TXN","PEP","QQQ") else "NYSE",
        settlement_cycle="T+1", settlement_location="DTC", ref_price=px, id_source="public", status="ACTIVE")); n += 1
# synthetic Treasuries and corporate bonds
for i in range(58):
    mat = D("2027-01-31") + dt.timedelta(days=91 * i)
    cpn = round(random.choice([3.5,3.625,3.75,3.875,4.0,4.125,4.25,4.375,4.5]), 3)
    base = f"91282C{''.join(random.choice('ABCDEFGHJKLMNPQRSTUVWXYZ0123456789') for _ in range(2))}"
    cus = base + cusip_check(base)
    securities.append(dict(bny_sec_id=f"BNYS{n:06d}", isin=isin_from_cusip(cus), cusip=cus, ticker="",
        issuer_name=f"US Treasury Note {cpn}% {mat.strftime('%m/%d/%Y')}", asset_class="UST", currency="USD", primary_exchange="OTC",
        settlement_cycle="T+1", settlement_location="FED", ref_price=round(random.uniform(97.5, 101.5), 4), id_source="synthetic", status="ACTIVE")); n += 1
issuers = ["Northgate Utilities","Calder Logistics","Brightwater Health","Summit Rail","Harbor Energy","Ellison Retail","Quarry Materials","Pinecrest Telecom","Atlas Insurance Holdings","Meridian Foods"]
for i in range(45):
    iss = issuers[i % len(issuers)]; mat = D("2028-03-15") + dt.timedelta(days=120 * i)
    base = f"{random.randint(10,99)}{random.choice('ABCDEFGH')}{random.randint(100,999)}{random.choice('ABCDEF')}{random.randint(1,9)}"
    cus = base + cusip_check(base)
    securities.append(dict(bny_sec_id=f"BNYS{n:06d}", isin=isin_from_cusip(cus), cusip=cus, ticker="",
        issuer_name=f"{iss} (synthetic) {round(random.uniform(3.8,6.2),3)}% {mat.strftime('%m/%d/%Y')}", asset_class="CORP_BOND", currency="USD",
        primary_exchange="OTC", settlement_cycle="T+1", settlement_location="DTC", ref_price=round(random.uniform(94, 104), 3), id_source="synthetic", status="ACTIVE")); n += 1
# one retired line (lookalike noise)
securities.append(dict(bny_sec_id=f"BNYS{n:06d}", isin="US67066G1040", cusip="67066G104", ticker="NVDA", issuer_name="NVIDIA Corp (legacy record, pre-split)",
    asset_class="EQUITY", currency="USD", primary_exchange="NASDAQ", settlement_cycle="T+2", settlement_location="DTC", ref_price="", id_source="public", status="INACTIVE"))
sec_by_isin = {s["isin"]: s for s in securities if s["status"] == "ACTIVE"}
NVDA = sec_by_isin["US67066G1040"]
active_secs = [s for s in securities if s["status"] == "ACTIVE"]
eq_secs = [s for s in active_secs if s["asset_class"] in ("EQUITY", "ETF")]

# ---------------- participants & brokers ----------------
participants = [
    dict(participant_number="0901", participant_name="The Bank of New York Mellon", type="CUSTODIAN", id_source="public", status="ACTIVE"),
    dict(participant_number="0005", participant_name="Goldman Sachs & Co. LLC", type="BROKER_DEALER", id_source="public", status="ACTIVE")]
syn_parts = [("7101","Morgan Stanley & Co. LLC","BROKER_DEALER"),("7102","J.P. Morgan Securities LLC","BROKER_DEALER"),("7103","BofA Securities Inc","BROKER_DEALER"),
("7104","Citigroup Global Markets Inc","BROKER_DEALER"),("7105","Barclays Capital Inc","BROKER_DEALER"),("7106","UBS Securities LLC","BROKER_DEALER"),
("7107","Jefferies LLC","BROKER_DEALER"),("7201","State Street Bank and Trust Co","CUSTODIAN"),("7202","JPMorgan Chase Bank NA (custody)","CUSTODIAN"),
("7203","Citibank NA (custody)","CUSTODIAN"),("7204","The Northern Trust Company","CUSTODIAN"),("7105X","Barclays Capital Inc (legacy)","BROKER_DEALER")]
for num, nm, tp in syn_parts:
    participants.append(dict(participant_number=num, participant_name=nm, type=tp, id_source="synthetic", status="INACTIVE" if "legacy" in nm else "ACTIVE"))
brokers = [("Goldman Sachs & Co. LLC","0005"),("Morgan Stanley & Co. LLC","7101"),("J.P. Morgan Securities LLC","7102"),("BofA Securities Inc","7103"),
("Citigroup Global Markets Inc","7104"),("Barclays Capital Inc","7105"),("UBS Securities LLC","7106"),("Jefferies LLC","7107")]
broker_w = [0.24,0.18,0.16,0.12,0.10,0.08,0.07,0.05]

# ---------------- BNY clients & accounts ----------------
client_names = ["Lakeshore Teachers' Pension Plan","Granite State Employees Retirement","Northbridge Mutual Insurance","Harbourview Asset Management",
"Crescent Sovereign Fund","Evergreen University Endowment","Bayside Municipal Pension","Ridgeway Capital Partners","Orchard Life Assurance",
"Westfield Public Retirement System","Silverline Investment Trust","Kestrel Global Advisors","Monarch Family Office","Tidewater Insurance Group",
"Pacific Crest Pension Fund","Aurora Wealth Partners","Ironwood Asset Management","Bluewater Reinsurance","Highland County Retirement",
"Sterling Foundation","Cobalt Investment Managers","Foxglove Capital","Riverside Healthcare Pension","Clearwater Endowment",
"Northstar Sovereign Holdings","Maple & Oak Advisors","Sequoia Hill Pension","Beacon Mutual Life","Copperfield Asset Management",
"Larkspur Investment Partners","Elmwood Retirement Trust","Summit Peak Capital","Harbor Light Insurance","Juniper State Pension",
"Windward Asset Management","Oakmont Endowment","Prairie Mutual","Fairhaven Advisors","Glenmore Capital"]
client_accounts = []
rms = ["R. Okafor","S. Lindqvist","M. Chen","D. Alvarez","P. Nair","J. Whitaker"]
ses = ["K. Brennan","A. Moretti","T. Haddad","L. Fischer","N. Osei"]
accounts = []
for i, cn in enumerate(client_names):
    code = "".join(w[0] for w in cn.replace("&","").split()[:3]).upper()
    for j in range(random.choice([1,1,2,2,3])):
        aid = f"{3100 + i*7 + j:04d}-{code}-{['MAIN','EQTY','FXIN'][j]}"
        acc = dict(account_id=aid, client_legal_name=cn + " (synthetic)", client_short_code=code, fund_name=f"{cn} {['Core','Equity','Fixed Income'][j]} Portfolio (synthetic)",
            account_type="CUSTODY", base_currency="USD", client_tier=random.choice([1,2,2,3,3]), relationship_manager=random.choice(rms),
            service_executive=random.choice(ses), status="OPEN", opened_date=str(D("2012-01-01") + dt.timedelta(days=random.randint(0, 4800))))
        client_accounts.append(acc); accounts.append(acc)
# AllianzGI
agi_funds = [("AGI-GLEQ","AllianzGI Global Equity Fund (synthetic)","LU"),("AGI-USEQ","AllianzGI US Equity Opportunities Fund (synthetic)","LU"),
("AGI-EUEQ","AllianzGI Europe Equity Growth Fund (synthetic)","DE"),("AGI-TECH","AllianzGI Global Technology Fund (synthetic)","LU"),
("AGI-INCO","AllianzGI Income and Growth Fund (synthetic)","LU"),("AGI-USHY","AllianzGI US High Yield Fund (synthetic)","UK"),
("AGI-SUST","AllianzGI Sustainable Equity Fund (synthetic)","DE"),("AGI-MULT","AllianzGI Multi Asset Balanced Fund (synthetic)","UK")]
agi_accounts = {}
for k, (fc, fn, dom) in enumerate(agi_funds):
    aid = f"{4471 + k*3:04d}-AGI-{fc.split('-')[1]}"
    acc = dict(account_id=aid, client_legal_name="Allianz Global Investors GmbH", client_short_code="AGI", fund_name=fn, account_type="CUSTODY",
        base_currency="USD" if fc.startswith("AGI-US") else "EUR", client_tier=1, relationship_manager="R. Okafor", service_executive="K. Brennan",
        status="OPEN", opened_date="2026-04-01")
    client_accounts.append(acc); accounts.append(acc); agi_accounts[fc] = aid
    client_accounts.append(dict(acc, account_id=aid.replace("-AGI-", "-AGC-"), account_type="CASH", fund_name=fn + " cash"))
assert agi_accounts["AGI-GLEQ"] == "4471-AGI-GLEQ"
cust_accounts = [a for a in accounts]

# ---------------- SSIs ----------------
TAGS = {"Goldman Sachs & Co. LLC":"GS","Morgan Stanley & Co. LLC":"MS","J.P. Morgan Securities LLC":"JPM","BofA Securities Inc":"BOFA",
        "Citigroup Global Markets Inc":"CITI","Barclays Capital Inc":"BARC","UBS Securities LLC":"UBS","Jefferies LLC":"JEF"}
LEI = {b: syn_lei() for b, _ in brokers}
ssi_bny = []
for bn, part in brokers:
    tag = TAGS[bn]
    for ac in ["EQ", "FI"]:
        ssi_bny.append(dict(ssi_id=f"SSI-{tag}-US-{ac}-{part}", counterparty_name=bn, counterparty_lei=LEI[bn],
            market="US", asset_class="EQUITY" if ac == "EQ" else "FIXED_INCOME", depository="DTC", dtc_participant=part,
            agent_bic=f"SYN{tag[:2]}US33XXX", effective_date="2024-06-01", end_date="", verified_by=random.choice(["L. Park","G. Adeyemi","H. Romano"]),
            verification_date="2026-02-14", status="ACTIVE"))
gs_lei = ssi_bny[0]["counterparty_lei"]
for r in ssi_bny:
    if r["counterparty_name"].startswith("Goldman"): r["counterparty_lei"] = gs_lei
# near-miss: superseded Goldman SSI
ssi_bny.append(dict(ssi_id="SSI-GS-US-EQ-7108", counterparty_name="Goldman Sachs & Co. LLC", counterparty_lei=gs_lei, market="US", asset_class="EQUITY",
    depository="DTC", dtc_participant="7108", agent_bic="SYNGSUS33XXX", effective_date="2019-03-01", end_date="2024-05-31", verified_by="L. Park",
    verification_date="2019-02-20", status="SUPERSEDED"))
ssi_bny.append(dict(ssi_id="SSI-MS-US-EQ-7101-B", counterparty_name="Morgan Stanley & Co. LLC", counterparty_lei="", market="US", asset_class="EQUITY",
    depository="DTC", dtc_participant="7101", agent_bic="", effective_date="2026-11-17", end_date="", verified_by="", verification_date="", status="PENDING_VERIFICATION"))

# ---------------- calendar, amounts, cut ----------------
# The data is a snapshot taken at 09:00 ET on 19 Nov: nothing after it exists yet.
CUT = dt.datetime(2026, 11, 19, 9, 0, tzinfo=ET)
TODAY = D("2026-11-19")
# Veterans Day: Fedwire and the US bond market are closed; equities trade and settle at DTC.
BOND_HOLIDAYS = {D("2026-11-11")}
def is_bond(sec): return sec["asset_class"] in ("UST", "CORP_BOND")
def settle_for(day, sec):
    s = next_bd(day, 1)
    while is_bond(sec) and s in BOND_HOLIDAYS: s = next_bd(s, 1)
    return s

COMM_PER_SHARE = 0.01  # Goldman and every broker here charge $0.01/share on equities
def amounts(sec, qty, px, client_side):
    """(gross, commission, net settlement amount). Equity buyers pay commission on top; sellers receive net of it."""
    if is_bond(sec):
        g = round(qty * px / 100, 2); return g, 0.0, g
    g = round(qty * px, 2); c = round(qty * COMM_PER_SHARE, 2)
    return g, c, round(g + c if client_side == "BUY" else g - c, 2)

# ---------------- ids ----------------
agi_orders, agi_allocs = [], []
pms = ["F. Becker","C. Rossi","E. Laurent","J. Schmidt","A. Novak"]
ord_seq = defaultdict(int)
instr, repair, fails_bny, cash, dtc_all = [], [], [], [], []
gs_trades, gs_allocs, gs_deliv, gs_fails = [], [], [], []
inst_seq = defaultdict(lambda: 5500000)
dtc_seq = defaultdict(int); gs_seq = defaultdict(lambda: 440000)
ctm_seq = [77100000]
analysts = ["J. Rivera","M. Kowalski","S. Iyer","B. Murphy","R. Aboaba","O. Ahmadov"]
RESERVED_DTC = {"DTC-DO-20261119-000318", "DTC-DO-20261119-000301"}

def new_iid(day):
    inst_seq[day] += random.randint(30, 140)
    return f"BNYI-{day.strftime('%Y%m%d')}-{inst_seq[day]:07d}"
def new_dtc(day):
    while True:
        dtc_seq[day] += 1
        ref = f"DTC-DO-{day.strftime('%Y%m%d')}-{dtc_seq[day]:06d}"
        if ref not in RESERVED_DTC: return ref
def new_gs(day):
    gs_seq[day] += random.randint(5, 60)
    return f"GS-EQ-{day.strftime('%Y%m%d')}-{gs_seq[day]:06d}"

def pick(pairs): return random.choices([p for p, _ in pairs], weights=[w for _, w in pairs])[0]

RES_BY_REASON = {"MISSING_CPTY_PARTICIPANT": ["ENRICHED_FROM_SSI", "CONFIRMED_WITH_CLIENT"], "QTY_PRICE_MISMATCH": ["CORRECTED_PER_CLIENT", "CONFIRMED_WITH_CLIENT"],
    "INVALID_SSI": ["ENRICHED_FROM_SSI", "CONFIRMED_WITH_CLIENT"], "MISSING_SETTLE_DATE": ["CONFIRMED_WITH_CLIENT", "CORRECTED_PER_CLIENT"],
    "DUPLICATE_SUSPECT": ["CANCELLED_DUPLICATE", "CONFIRMED_WITH_CLIENT"]}
COMMENT = {"REJECTED_NO_REFDATA_MATCH": "DE: no unique refdata match, returned to human queue; ISIN confirmed with client and keyed",
    "ENRICHED_FROM_REFDATA": "", "ENRICHED_FROM_SSI": "participant taken from active verified SSI",
    "CONFIRMED_WITH_CLIENT": "confirmed with client ops by email", "CORRECTED_PER_CLIENT": "client resent corrected details",
    "CANCELLED_DUPLICATE": "client confirmed duplicate, cancelled"}
REPAIR_REASONS = [("MISSING_SEC_ID",0.26),("MISSING_CPTY_PARTICIPANT",0.18),("QTY_PRICE_MISMATCH",0.2),("INVALID_SSI",0.16),("MISSING_SETTLE_DATE",0.1),("DUPLICATE_SUSPECT",0.1)]
FAIL_REASONS = [("LACK_OF_SECURITIES",0.36),("SSI_MISMATCH",0.18),("LATE_AFFIRMATION",0.15),("DK_QTY_MISMATCH",0.11),("ON_HOLD",0.11),("CASH_SHORTFALL",0.09)]

# How each fail shows at DTC: (event, reason_code). The same codes drive BNY's and Goldman's records.
DTC_FAIL = {"LACK_OF_SECURITIES": ("PENDING", "INSUFFICIENT_POSITION"), "SSI_MISMATCH": ("DK", "SSI_MISMATCH"),
    "LATE_AFFIRMATION": ("PENDING", "UNAFFIRMED"), "DK_QTY_MISMATCH": ("DK", "QTY_MISMATCH"),
    "ON_HOLD": ("PENDING", "HOLD"), "CASH_SHORTFALL": ("PENDING", "NET_DEBIT_CAP")}
# Goldman's own fail reason depends on whether Goldman delivers (client buys) or receives (client sells).
GS_WHEN_DELIVERING = {"LACK_OF_SECURITIES": "SHORT_INVENTORY", "SSI_MISMATCH": "CPTY_SSI_MISMATCH", "LATE_AFFIRMATION": "UNAFFIRMED",
    "DK_QTY_MISMATCH": "DK_BY_RECEIVER", "ON_HOLD": "HELD", "CASH_SHORTFALL": "CPTY_CASH"}
GS_WHEN_RECEIVING = {"LACK_OF_SECURITIES": "CPTY_FAILED_TO_DELIVER", "SSI_MISMATCH": "CPTY_SSI_MISMATCH", "LATE_AFFIRMATION": "UNAFFIRMED",
    "DK_QTY_MISMATCH": "DK_ISSUED", "ON_HOLD": "CPTY_FAILED_TO_DELIVER", "CASH_SHORTFALL": "CPTY_FAILED_TO_DELIVER"}
GS_NEXT_ACTION = {"SHORT_INVENTORY": "borrow", "CPTY_SSI_MISMATCH": "confirm SSI with custodian", "UNAFFIRMED": "chase client affirmation",
    "DK_BY_RECEIVER": "contact receiving custodian", "HELD": "await custodian release", "CPTY_CASH": "await client funding",
    "CPTY_FAILED_TO_DELIVER": "chase delivering custodian", "DK_ISSUED": "await corrected delivery"}
NOTES = {
 ("LACK_OF_SECURITIES","RESOLVED"): ["cpty delivered late, settled S+1", "cpty arranged borrow, settled S+1", "shares recalled from loan, settled late"],
 ("LACK_OF_SECURITIES","OPEN"): ["cpty says shares due from their own fail", "emailed cpty ops, no response yet", "cpty awaiting recall, ETA tomorrow"],
 ("SSI_MISMATCH","RESOLVED"): ["SSI corrected after call with cpty ops, redelivered", "client resent instruction with correct SSI, redelivered"],
 ("SSI_MISMATCH","OPEN"): ["called cpty ops, awaiting confirmation of their SSI", "emailed cpty ops, no response yet"],
 ("LATE_AFFIRMATION","RESOLVED"): ["client affirmed late in CTM, settled after affirmation"],
 ("LATE_AFFIRMATION","OPEN"): ["chased client middle office for affirmation"],
 ("DK_QTY_MISMATCH","RESOLVED"): ["client confirmed qty, instruction amended, cpty redelivered", "cpty corrected delivery qty and redelivered"],
 ("DK_QTY_MISMATCH","OPEN"): ["qty break vs cpty delivery, confirming with client", "emailed cpty ops, no response yet"],
 ("ON_HOLD","RESOLVED"): ["hold released after client cash confirmed"],
 ("ON_HOLD","OPEN"): ["held pending client cash confirmation"],
 ("CASH_SHORTFALL","RESOLVED"): ["client funded account, settled"],
 ("CASH_SHORTFALL","OPEN"): ["client notified of shortfall, awaiting funding"]}

def fail_reason(direction):
    r = pick(FAIL_REASONS)
    # A client that is selling isn't short of cash: that fail shows as a hold instead.
    return "ON_HOLD" if direction == "DVP" and r == "CASH_SHORTFALL" else r

def resolve_time(settle, reason):
    """When the fail clears and the trade settles at DTC."""
    if reason in ("ON_HOLD", "CASH_SHORTFALL") and random.random() < 0.5:
        return at(settle, random.randint(12, 14), random.randint(0, 59))
    d = settle
    for _ in range(random.choices([1, 2, 3, 5], weights=[0.6, 0.2, 0.12, 0.08])[0]): d = next_bd(d, 1)
    return at(d, random.randint(7, 13), random.randint(0, 59))

def dtc_flow(ref, settle, deliverer, receiver, sec, qty, amt, reason, resolved):
    """DTC events for one delivery. Returns (events, settled_at or None, fail_event or None)."""
    base = dict(dtc_reference=ref, deliverer_participant=deliverer, receiver_participant=receiver, isin=sec["isin"],
                quantity=qty, settlement_amount=amt, transaction_type="DVP")
    t0 = at(settle, random.randint(6, 8), random.randint(0, 59), random.randint(0, 59))
    ev = [dict(base, _t=t0, event="INSTRUCTED", reason_code="")]
    settled, failed = None, None
    if reason is None:
        settled = t0 + dt.timedelta(minutes=random.randint(1, 240))
        ev.append(dict(base, _t=settled, event="SETTLED", reason_code=""))
    else:
        kind, code = DTC_FAIL[reason]
        failed = dict(base, _t=t0 + dt.timedelta(minutes=1 if kind == "DK" else random.randint(5, 120)), event=kind, reason_code=code)
        ev.append(failed)
        if kind == "DK":  # after a DK the deliverer redelivers under the same reference
            ev.append(dict(base, _t=resolved - dt.timedelta(minutes=random.randint(8, 30)), event="INSTRUCTED", reason_code=""))
        settled = resolved
        ev.append(dict(base, _t=resolved, event="SETTLED", reason_code=""))
    ev = [e for e in ev if e["_t"] <= CUT]
    if settled and settled > CUT: settled = None
    dtc_all.extend(ev)
    return ev, settled, failed

# ---------------- one settlement leg (BNY instruction, repair, DTC, fails, cash) ----------------
def leg(day, acc, sec, side, qty, px, bn, bpart, exec_dt, recv, client_ref, settle, is_agi):
    iid = new_iid(day)
    _, _, amount = amounts(sec, qty, px, side)
    direction = "RVP" if side == "BUY" else "DVP"
    loc = sec["settlement_location"]
    last = settle == TODAY
    row = dict(instruction_id=iid, _recv=recv, source_channel=random.choice(["SWIFT_MT541","SWIFT_MT541","CTM","PORTAL"]) if side == "BUY" else random.choice(["SWIFT_MT543","CTM","PORTAL"]),
        client_account_id=acc["account_id"], client_ref=client_ref, direction=direction, isin=sec["isin"], quantity=qty, price=px,
        settlement_amount=amount, currency="USD", trade_date=str(day), settle_date=str(settle), counterparty_name=bn, cpty_dtc_participant=bpart,
        settlement_location=loc, amends_instruction_id="", dtc_reference="", status="", _status_t=recv + dt.timedelta(minutes=4), _settled=None,
        _open_lack=False, _agi=is_agi)
    # Repair: opened on receipt; nobody works the queue after 17:30 ET, so late items wait for the morning.
    in_repair = False
    if random.random() < 0.06:
        reason = pick(REPAIR_REASONS)
        de = reason == "MISSING_SEC_ID"; de_ok = de and random.random() < 0.55
        opened = recv + dt.timedelta(minutes=1)
        resolved = opened + dt.timedelta(minutes=random.randint(2, 15) if de_ok else random.randint(20, 300))
        lt = resolved.astimezone(ET)
        if not de_ok and not (dt.time(7, 30) <= lt.time() <= dt.time(17, 30)) or lt.weekday() >= 5:
            nd = next_bd(lt.date(), 1) if lt.time() > dt.time(17, 30) or lt.weekday() >= 5 else lt.date()
            resolved = at(nd, 7, 30) + dt.timedelta(minutes=random.randint(0, 80))
        open_item = resolved > CUT or (last and random.random() < 0.35)
        if reason == "MISSING_CPTY_PARTICIPANT": row["cpty_dtc_participant"] = ""
        pscore = round(min(97, amount / 150000 + (30 if acc["client_tier"] == 1 else 10) + random.uniform(0, 20)), 1)
        assigned = "" if open_item else ("DE-REPAIR-01" if de else random.choice(analysts))
        fix = RES_BY_REASON.get(reason, ["CORRECTED_PER_CLIENT"])
        resolution = "" if open_item else ("ENRICHED_FROM_REFDATA" if de_ok else ("REJECTED_NO_REFDATA_MATCH" if de else random.choice(fix * (4 // len(fix)))))
        verifier = "" if open_item else random.choice(analysts)
        if verifier and verifier == assigned: verifier = analysts[(analysts.index(verifier) + 1) % len(analysts)]
        comments = "awaiting analyst" if open_item else COMMENT.get(resolution, "")
        repair.append(dict(_rid_day=day if recv.astimezone(ET).date() == day else recv.astimezone(ET).date(), instruction_id=iid, _opened=opened, repair_reason=reason,
            routed_to="DIGITAL_EMPLOYEE" if de else "HUMAN", priority_score=pscore, cutoff_ts_et=et(at(settle, 14, 30)), trade_value_usd=amount,
            assigned_to=assigned, resolution=resolution, _resolved=None if open_item else resolved, verified_by=verifier, comments=comments, _agi=is_agi))
        if open_item:
            in_repair = True
            row["status"] = "IN_REPAIR"
        else:
            row["_status_t"] = resolved + dt.timedelta(minutes=2)
    instr.append(row)
    deliverer, receiver = (bpart or "0000", "0901") if side == "BUY" else ("0901", bpart or "0000")
    out = dict(row=row, amount=amount, deliverer=deliverer, receiver=receiver, reason=None, resolved=None, events=[], settled=None, failed=None, dref="")
    if in_repair: return out  # never instructed at DTC yet
    reason = fail_reason(direction) if random.random() < 0.04 else None
    resolved = resolve_time(settle, reason) if reason else None
    out.update(reason=reason, resolved=resolved)
    if loc == "DTC":
        dref = new_dtc(settle)
        row["dtc_reference"] = dref
        ev, settled, failed = dtc_flow(dref, settle, deliverer, receiver, sec, qty, amount, reason, resolved)
        out.update(events=ev, settled=settled, failed=failed, dref=dref)
    else:  # Fedwire: settles on the day unless it fails
        settled = (resolved if reason else at(settle, random.randint(9, 15), random.randint(0, 59)))
        out["settled"] = settled if settled <= CUT else None
        out["failed"] = dict(_t=at(settle, 9, random.randint(5, 50))) if reason else None
    # BNY fail record
    if reason:
        f_t = (out["failed"]["_t"] if out["failed"] else at(settle, 8, 30)) + dt.timedelta(minutes=random.randint(2, 10))
        if f_t <= CUT:
            st = "RESOLVED" if out["settled"] else "OPEN"
            owner = random.choice(analysts) if st == "RESOLVED" or random.random() < 0.6 else ""
            opts = NOTES.get((reason, st), [""])
            fails_bny.append(dict(_t=f_t, instruction_id=iid, dtc_reference=row["dtc_reference"], fail_reason=reason, counterparty_name=bn,
                days_outstanding=(TODAY - settle).days if st == "OPEN" else "", status=st, owner=owner,
                resolution_notes="" if (st == "OPEN" and not owner) else random.choice(opts)))
            if st == "OPEN" and reason == "LACK_OF_SECURITIES" and direction == "DVP": row["_open_lack"] = True
    # instruction status from what actually happened
    if out["settled"]:
        row["status"] = "SETTLED"; row["_status_t"] = out["settled"]; row["_settled"] = out["settled"]
    elif reason and out["failed"] and settle < TODAY:
        row["status"] = "PENDING_SETTLEMENT"; row["_status_t"] = out["failed"]["_t"]
    else:
        row["status"] = ("SENT_TO_FED" if loc == "FED" else random.choice(["SENT_TO_DTC", "MATCHED", "SENT_TO_DTC", "ENRICHED"])) if last else "SETTLED"
    if row["_settled"]:
        cash.append(dict(entry_id=f"CL-{iid[5:]}", account_id=acc["account_id"].replace("-AGI-", "-AGC-") if is_agi else acc["account_id"],
            value_date=str(row["_settled"].astimezone(ET).date()), amount=-amount if side == "BUY" else amount, currency="USD",
            entry_type="TRADE_SETTLEMENT", related_instruction_id=iid, status="POSTED"))
    return out

# ---------------- Goldman booking ----------------
def gs_trade(day, exec_dt, client_name, client_side, sec, qty, px, settle):
    ref = new_gs(day)
    g, c, _ = amounts(sec, qty, px, client_side)
    gs_trades.append(dict(gs_trade_ref=ref, exec_ts_utc=utc(exec_dt), client_name=client_name, side="SELL" if client_side == "BUY" else "BUY",
        client_side=client_side, ticker=sec["ticker"], isin=sec["isin"], quantity=qty, price=px, gross_amount=g, commission=c,
        trade_date=str(day), settle_date=str(settle), desk="US Credit" if is_bond(sec) else random.choice(["US Cash Equities","Program Trading","High Touch"]),
        trader_id=f"T{random.randint(1000,9999)}", status="BOOKED"))
    return ref

def gs_leg(ref, k, block, client_name, client_ref, qty, custodian, cust_part, exec_dt, sec, client_side, out, settle):
    """Goldman's allocation, DTC delivery and (if any) fail for one leg of a trade."""
    ctm_seq[0] += random.randint(10, 900)
    reason, settled = out["reason"], out["settled"]
    # Affirmation is the client's (or its custodian's) job in CTM. A late affirmation is what causes that fail.
    late_aff = reason == "LATE_AFFIRMATION"
    affirmed = not late_aff or settled is not None
    aff_t = (settled - dt.timedelta(minutes=random.randint(20, 90))) if late_aff and settled else exec_dt + dt.timedelta(hours=random.uniform(1, 5))
    gs_allocs.append(dict(alloc_id=f"AL-{ref[6:]}-{k}", gs_trade_ref=ref, client_name=client_name, client_account_ref=client_ref, quantity=qty,
        custodian_name=custodian, custodian_dtc_participant=cust_part, ctm_confirm_id=f"CTM-{ctm_seq[0]}", affirmed="Y" if affirmed else "N",
        affirmed_ts_utc=utc(aff_t) if affirmed else "", version=1, status="AFFIRMED" if affirmed else "PENDING_AFFIRMATION"))
    if not out["dref"]: return
    did = f"DEL-{ref[6:]}" + (f"-{k}" if block else "")
    ev = out["events"]; lastev = max(ev, key=lambda e: e["_t"])
    gs_deliv.append(dict(delivery_id=did, gs_trade_ref=ref, dtc_reference=out["dref"], from_participant=out["deliverer"], to_participant=out["receiver"],
        isin=sec["isin"], quantity=qty, settlement_amount=out["amount"], instructed_ts_utc=utc(ev[0]["_t"]),
        status={"INSTRUCTED": "DELIVERED", "SETTLED": "SETTLED", "PENDING": "PENDING", "DK": "DK"}[lastev["event"]], status_ts_utc=utc(lastev["_t"]),
        dk_reason=lastev["reason_code"] if lastev["event"] == "DK" else ""))
    if reason and out["failed"] and out["failed"]["_t"] <= CUT:
        gs_delivers = out["deliverer"] == "0005"
        fr = (GS_WHEN_DELIVERING if gs_delivers else GS_WHEN_RECEIVING)[reason]
        gs_fails.append(dict(_t=out["failed"]["_t"] + dt.timedelta(minutes=1), delivery_id=did, counterparty_custodian=custodian, fail_reason=fr,
            age_days=(TODAY - settle).days if not settled else (settled.astimezone(ET).date() - settle).days, exposure_usd=out["amount"],
            owner=random.choice(["fails-desk-1","fails-desk-2","fails-desk-3"]), next_action=GS_NEXT_ACTION[fr], status="CLOSED" if settled else "OPEN"))

# ---------------- BNY client trades ----------------
def split_qty(total, k):
    cuts = sorted(random.sample(range(1, total // 100), k - 1))
    parts = [b - a for a, b in zip([0] + cuts, cuts + [total // 100])]
    return [p * 100 for p in parts]

AGI_FUNDS = list(agi_accounts)
for day in days[:-1]:  # trade dates Oct 20 .. Nov 18
    for _ in range(random.randint(88, 112)):
        is_agi = random.random() < 0.17
        acc = random.choice([a for a in accounts if a["client_short_code"] == "AGI"]) if is_agi else random.choice([a for a in accounts if a["client_short_code"] != "AGI"])
        r = random.random()
        bonds_open = day not in BOND_HOLIDAYS
        if r < 0.68 or not bonds_open: sec = random.choice(eq_secs)
        elif r < 0.85: sec = random.choice([s for s in active_secs if s["asset_class"] == "UST"])
        else: sec = random.choice([s for s in active_secs if s["asset_class"] == "CORP_BOND"])
        bn, bpart = random.choices(brokers, weights=broker_w)[0]
        side = random.choice(["BUY", "SELL"])
        if not is_bond(sec):
            qty = random.choice([100, 250, 500, 1000, 1500, 2000, 2500, 5000, 7500, 10000, 15000, 20000, 25000])
            px = round(float(sec["ref_price"]) * random.uniform(0.95, 1.05), 2)
        else:
            qty = random.choice([250000, 500000, 1000000, 2000000, 5000000])
            px = round(float(sec["ref_price"]) * random.uniform(0.99, 1.01), 4)
        settle = settle_for(day, sec)
        # US market hours. AllianzGI trades before its 21:00 CET custodian cutoff so allocations go out the same day.
        agi_cap = at(day, 20, 58, 0, CET)
        exec_dt = at(day, random.randint(9, 15), random.randint(0, 59), random.randint(0, 59))
        if exec_dt < at(day, 9, 30): exec_dt += dt.timedelta(minutes=30)
        legs = [(acc, qty)]
        oid = None
        if is_agi:
            exec_dt = min(exec_dt, agi_cap - dt.timedelta(minutes=random.randint(20, 90)))
            sent = min(exec_dt + dt.timedelta(minutes=random.randint(15, 90)), agi_cap)
            recv = sent + dt.timedelta(minutes=random.randint(1, 3), seconds=random.randint(0, 59))
            # About a third of AllianzGI equity orders are blocks across 2-3 funds, allocated per fund.
            block = not is_bond(sec) and qty >= 1000 and random.random() < 0.33
            if block:
                funds = random.sample(AGI_FUNDS, random.choice([2, 2, 3]))
                legs = list(zip([next(a for a in accounts if a["account_id"] == agi_accounts[f]) for f in funds], split_qty(qty, len(funds))))
            ord_seq[day] += random.randint(3, 25)
            oid = f"AGI-ORD-26-{day.timetuple().tm_yday:03d}-{ord_seq[day]:04d}"
            fc = "BLOCK" if block else [k for k, v in agi_accounts.items() if v == acc["account_id"]][0]
            agi_orders.append(dict(agi_order_id=oid, created_ts_cet=cet(exec_dt - dt.timedelta(minutes=random.randint(5, 90))), portfolio_manager=random.choice(pms),
                fund_code=fc, side=side, isin=sec["isin"], quantity=qty,
                # A buy limit is a ceiling, a sell limit a floor: fills sit on the right side of it.
                limit_price=round(px * (1.01 if side == "BUY" else 0.99), 2), broker=bn, status="FILLED"))
            for k, (la, lq) in enumerate(legs, 1):
                lf = [f for f, v in agi_accounts.items() if v == la["account_id"]][0]
                agi_allocs.append(dict(allocation_id=f"ALC-{oid[8:]}-{k}", agi_order_id=oid, fund_code=lf, quantity=lq, version=1, amended_ts_cet="",
                    custodian="BNY", sent_to_custodian_ts_cet=cet(sent), status="SENT"))
        else:
            recv = exec_dt + dt.timedelta(hours=random.uniform(1.5, 6))
        outs = []
        for la, lq in legs:
            client_ref = oid or f"{la['client_short_code']}-{day.strftime('%y%m%d')}-{random.randint(1000,9999)}"
            outs.append((la, lq, client_ref, leg(day, la, sec, side, lq, px, bn, bpart, exec_dt, recv, client_ref, settle, is_agi)))
        if bn.startswith("Goldman") and sec["settlement_location"] == "DTC":
            cname = "Allianz Global Investors GmbH" if is_agi else acc["client_legal_name"].replace(" (synthetic)", "")
            ref = gs_trade(day, exec_dt, cname, side, sec, qty, px, settle)
            for k, (la, lq, cref, out) in enumerate(outs, 1):
                gs_leg(ref, k, len(outs) > 1, cname, cref, lq, "The Bank of New York Mellon", "0901", exec_dt, sec, side, out, settle)

# ---------------- Goldman trades with other custodians (non-BNY clients) ----------------
other_custs = [("State Street Bank and Trust Co","7201"),("JPMorgan Chase Bank NA (custody)","7202"),("Citibank NA (custody)","7203"),("The Northern Trust Company","7204")]
other_clients = ["Redwood Pension Board","Halcyon Capital","Cardinal Insurance Co","Granby Endowment","Lumen Asset Management","Osprey Partners","Vantage Mutual",
"Meadowlark Advisors","Stonebridge Retirement","Aldgate Investments","Coral Bay Capital","Hawthorn Pension"]
# Each client settles through one custodian, the one in Goldman's SSI book.
CUSTODIAN_OF = {cn: other_custs[i % len(other_custs)] for i, cn in enumerate(other_clients)}
for day in days[:-1]:
    for _ in range(random.randint(55, 75)):
        cn = random.choice(other_clients); cust, cpart = CUSTODIAN_OF[cn]
        sec = random.choice(eq_secs); qty = random.choice([500, 1000, 2500, 5000, 10000, 20000]); px = round(float(sec["ref_price"]) * random.uniform(0.95, 1.05), 2)
        side = random.choice(["BUY", "SELL"]); settle = settle_for(day, sec)
        exec_dt = at(day, random.randint(9, 15), random.randint(0, 59))
        if exec_dt < at(day, 9, 30): exec_dt += dt.timedelta(minutes=30)
        ref = gs_trade(day, exec_dt, cn, side, sec, qty, px, settle)
        _, _, amount = amounts(sec, qty, px, side)
        dref = new_dtc(settle)
        deliverer, receiver = ("0005", cpart) if side == "BUY" else (cpart, "0005")
        reason = fail_reason("RVP" if side == "BUY" else "DVP") if random.random() < 0.035 else None
        resolved = resolve_time(settle, reason) if reason else None
        ev, settled, failed = dtc_flow(dref, settle, deliverer, receiver, sec, qty, amount, reason, resolved)
        out = dict(reason=reason if failed else None, settled=settled, failed=failed, events=ev, dref=dref, deliverer=deliverer, receiver=receiver, amount=amount)
        gs_leg(ref, 1, False, cn, f"{cn[:3].upper()}{random.randint(100000,999999)}", qty, cust, cpart, exec_dt, sec, side, out, settle)

# ---------------- GOLDEN CASE ----------------
# AllianzGI's PM raised the order from 8,000 to 10,000 before Goldman filled it, but the
# fund's allocation went out at the stale 8,000. CTM showed 10,000 against 8,000, so AGI
# trade operations amended the allocation late that evening; the amended custodian
# instruction then stuck in AGI's approval queue and never reached BNY.
T, S = D("2026-11-18"), D("2026-11-19")
exec_dt = at(T, 14, 52, 31)
gs_trades.append(dict(gs_trade_ref="GS-EQ-20261118-448213", exec_ts_utc=utc(exec_dt), client_name="Allianz Global Investors GmbH", side="SELL", client_side="BUY",
    ticker="NVDA", isin="US67066G1040", quantity=10000, price=186.25, gross_amount=1862500.00, commission=100.00, trade_date=str(T), settle_date=str(S),
    desk="High Touch", trader_id="T4417", status="BOOKED"))
gs_allocs.append(dict(alloc_id="AL-20261118-448213-1", gs_trade_ref="GS-EQ-20261118-448213", client_name="Allianz Global Investors GmbH", client_account_ref="AGI-ORD-26-322-0773",
    quantity=8000, custodian_name="The Bank of New York Mellon", custodian_dtc_participant="0901", ctm_confirm_id="CTM-77104562", affirmed="N", affirmed_ts_utc="", version=1, status="SUPERSEDED"))
gs_allocs.append(dict(alloc_id="AL-20261118-448213-2", gs_trade_ref="GS-EQ-20261118-448213", client_name="Allianz Global Investors GmbH", client_account_ref="AGI-ORD-26-322-0773",
    quantity=10000, custodian_name="The Bank of New York Mellon", custodian_dtc_participant="0901", ctm_confirm_id="CTM-77104562", affirmed="Y",
    affirmed_ts_utc=utc(at(T, 23, 52, 10, CET)), version=2, status="AFFIRMED"))
agi_orders.append(dict(agi_order_id="AGI-ORD-26-322-0773", created_ts_cet=cet(at(T, 14, 31, 0, CET)), portfolio_manager="F. Becker", fund_code="AGI-GLEQ", side="BUY",
    isin="US67066G1040", quantity=10000, limit_price=187.00, broker="Goldman Sachs & Co. LLC", status="FILLED"))
agi_allocs.append(dict(allocation_id="ALC-26-322-0773-1", agi_order_id="AGI-ORD-26-322-0773", fund_code="AGI-GLEQ", quantity=8000, version=1, amended_ts_cet="",
    custodian="BNY", sent_to_custodian_ts_cet="18.11.2026 20:58", status="SUPERSEDED"))
agi_allocs.append(dict(allocation_id="ALC-26-322-0773-2", agi_order_id="AGI-ORD-26-322-0773", fund_code="AGI-GLEQ", quantity=10000, version=2, amended_ts_cet="18.11.2026 23:40",
    custodian="BNY", sent_to_custodian_ts_cet="", status="NOT_SENT"))
instr.append(dict(instruction_id="BNYI-20261118-5527301", _recv=at(T, 14, 58, 41), source_channel="SWIFT_MT541", client_account_id="4471-AGI-GLEQ",
    client_ref="AGI-ORD-26-322-0773", direction="RVP", isin="US67066G1040", quantity=8000, price=186.25, settlement_amount=1490080.00, currency="USD",
    trade_date=str(T), settle_date=str(S), counterparty_name="Goldman Sachs & Co. LLC", cpty_dtc_participant="0005", settlement_location="DTC",
    amends_instruction_id="", dtc_reference="DTC-DO-20261119-000318", status="SENT_TO_DTC", _status_t=at(T, 15, 2, 10), _settled=None, _open_lack=False, _agi=True))
dtc_all.append(dict(dtc_reference="DTC-DO-20261119-000318", _t=at(S, 8, 15, 9), deliverer_participant="0005", receiver_participant="0901",
    isin="US67066G1040", quantity=10000, settlement_amount=1862600.00, transaction_type="DVP", event="INSTRUCTED", reason_code=""))
dtc_all.append(dict(dtc_all[-1], _t=at(S, 8, 16, 2), event="DK", reason_code="QTY_MISMATCH"))
gs_deliv.append(dict(delivery_id="DEL-20261118-448213", gs_trade_ref="GS-EQ-20261118-448213", dtc_reference="DTC-DO-20261119-000318", from_participant="0005",
    to_participant="0901", isin="US67066G1040", quantity=10000, settlement_amount=1862600.00, instructed_ts_utc="2026-11-19T13:15:09Z", status="DK",
    status_ts_utc="2026-11-19T13:16:02Z", dk_reason="QTY_MISMATCH"))
gs_fails.append(dict(gs_fail_id="GS-FAIL-20261119-0091", _t=at(S, 8, 17), delivery_id="DEL-20261118-448213", counterparty_custodian="The Bank of New York Mellon", fail_reason="DK_BY_RECEIVER",
    age_days=0, exposure_usd=1862600.00, owner="", next_action="contact receiving custodian", status="OPEN"))
fails_bny.append(dict(exception_id="EXC-20261119-0907", instruction_id="BNYI-20261118-5527301", dtc_reference="DTC-DO-20261119-000318", _t=at(S, 8, 16, 30),
    fail_reason="DK_QTY_MISMATCH", counterparty_name="Goldman Sachs & Co. LLC", days_outstanding=0, status="OPEN", owner="",
    resolution_notes="delivered 10,000 vs instructed 8,000; auto-DK"))
# near-miss 1: another Goldman NVDA trade the same day for a different client; it settled before 09:00
lk = [a for a in accounts if a["client_short_code"] == "LTP"][0]
instr.append(dict(instruction_id="BNYI-20261118-5527388", _recv=at(T, 15, 22, 47), source_channel="CTM", client_account_id=lk["account_id"], client_ref="LTP-261118-4410",
    direction="RVP", isin="US67066G1040", quantity=8000, price=186.31, settlement_amount=1490560.00, currency="USD", trade_date=str(T), settle_date=str(S),
    counterparty_name="Goldman Sachs & Co. LLC", cpty_dtc_participant="0005", settlement_location="DTC", amends_instruction_id="", dtc_reference="DTC-DO-20261119-000301",
    status="SETTLED", _status_t=at(S, 8, 2, 15), _settled=at(S, 8, 2, 15), _open_lack=False, _agi=False))
cash.append(dict(entry_id="CL-20261118-5527388", account_id=lk["account_id"], value_date="2026-11-19", amount=-1490560.00, currency="USD",
    entry_type="TRADE_SETTLEMENT", related_instruction_id="BNYI-20261118-5527388", status="POSTED"))
dtc_all.append(dict(dtc_reference="DTC-DO-20261119-000301", _t=at(S, 7, 58, 40), deliverer_participant="0005", receiver_participant="0901",
    isin="US67066G1040", quantity=8000, settlement_amount=1490560.00, transaction_type="DVP", event="INSTRUCTED", reason_code=""))
dtc_all.append(dict(dtc_all[-1], _t=at(S, 8, 2, 15), event="SETTLED"))
gs_trades.append(dict(gs_trade_ref="GS-EQ-20261118-448190", exec_ts_utc=utc(at(T, 15, 4, 12)), client_name="Lakeshore Teachers' Pension Plan", side="SELL", client_side="BUY",
    ticker="NVDA", isin="US67066G1040", quantity=8000, price=186.31, gross_amount=1490480.00, commission=80.00, trade_date=str(T), settle_date=str(S), desk="Program Trading", trader_id="T2290", status="BOOKED"))
gs_allocs.append(dict(alloc_id="AL-20261118-448190-1", gs_trade_ref="GS-EQ-20261118-448190", client_name="Lakeshore Teachers' Pension Plan", client_account_ref="LTP-261118-4410",
    quantity=8000, custodian_name="The Bank of New York Mellon", custodian_dtc_participant="0901", ctm_confirm_id="CTM-77104488", affirmed="Y", affirmed_ts_utc="2026-11-18T21:40:55Z", version=1, status="AFFIRMED"))
gs_deliv.append(dict(delivery_id="DEL-20261118-448190", gs_trade_ref="GS-EQ-20261118-448190", dtc_reference="DTC-DO-20261119-000301", from_participant="0005", to_participant="0901",
    isin="US67066G1040", quantity=8000, settlement_amount=1490560.00, instructed_ts_utc="2026-11-19T12:58:40Z", status="SETTLED", status_ts_utc="2026-11-19T13:02:15Z", dk_reason=""))
# near-miss 3: another AllianzGI trade on 18 Nov, with Morgan Stanley, held in repair on an unverified SSI
avgo = sec_by_isin[isin_from_cusip("11135F101")]
agi_orders.append(dict(agi_order_id="AGI-ORD-26-322-0781", created_ts_cet="18.11.2026 19:12", portfolio_manager="C. Rossi", fund_code="AGI-TECH", side="BUY",
    isin=avgo["isin"], quantity=5000, limit_price=203.0, broker="Morgan Stanley & Co. LLC", status="FILLED"))
agi_allocs.append(dict(allocation_id="ALC-26-322-0781-1", agi_order_id="AGI-ORD-26-322-0781", fund_code="AGI-TECH", quantity=5000, version=1, amended_ts_cet="",
    custodian="BNY", sent_to_custodian_ts_cet="18.11.2026 20:39", status="SENT"))
instr.append(dict(instruction_id="BNYI-20261118-5528610", _recv=at(T, 14, 40, 12), source_channel="SWIFT_MT541", client_account_id=agi_accounts["AGI-TECH"],
    client_ref="AGI-ORD-26-322-0781", direction="RVP", isin=avgo["isin"], quantity=5000, price=201.88, settlement_amount=1009450.00, currency="USD",
    trade_date=str(T), settle_date=str(S), counterparty_name="Morgan Stanley & Co. LLC", cpty_dtc_participant="7101", settlement_location="DTC", amends_instruction_id="",
    dtc_reference="", status="IN_REPAIR", _status_t=at(T, 14, 41), _settled=None, _open_lack=False, _agi=True))
repair.append(dict(repair_id="RQ-20261118-0407", _rid_day=T, instruction_id="BNYI-20261118-5528610", _opened=at(T, 14, 41), repair_reason="INVALID_SSI", routed_to="HUMAN",
    priority_score=71.2, cutoff_ts_et="2026-11-19 14:30:00", trade_value_usd=1009450.00, assigned_to="", resolution="", _resolved=None, verified_by="",
    comments="new MS SSI pending verification (SSI-MS-US-EQ-7101-B)", _agi=True))

# ---------------- repair queue: ids, AGI service level ----------------
_rq = defaultdict(int)
for r in sorted(repair, key=lambda r: r["_opened"]):
    if r.get("repair_id") == "RQ-20261118-0407": continue
    d = r["_rid_day"].strftime("%Y%m%d"); _rq[d] += 1
    n = 380 + _rq[d]
    if d == "20261118" and n >= 407: n += 1  # 0407 is the Morgan Stanley near-miss
    r["repair_id"] = f"RQ-{d}-{n:04d}"
for r in repair:
    # AllianzGI's service level: repair items actioned within 60 minutes during US hours.
    end = r["_resolved"] or CUT
    if r["_agi"] and r["routed_to"] == "HUMAN" and end - r["_opened"] > dt.timedelta(minutes=60):
        breach = r["_opened"] + dt.timedelta(minutes=60)
        note = f"AGI 60-min SLA breached {breach.astimezone(ET).strftime('%H:%M')}; escalated to K. Brennan (service exec)"
        r["comments"] = f"{r['comments']}; {note}" if r["comments"] else note

# ---------------- positions: built from settled history ----------------
SETTLED_BY_18 = dt.datetime(2026, 11, 18, 23, 59, tzinfo=ET)
flows = defaultdict(list)
for i in instr:
    if i["_settled"] and i["_settled"] <= SETTLED_BY_18:
        flows[(i["client_account_id"], i["isin"])].append((i["_settled"], int(i["quantity"]) * (1 if i["direction"] == "RVP" else -1)))
pend_in, pend_out, need_19 = defaultdict(int), defaultdict(int), defaultdict(int)
for i in instr:
    if i["settle_date"] != "2026-11-19" or i["status"] in ("CANCELLED", "IN_REPAIR"): continue
    k = (i["client_account_id"], i["isin"])
    if i["direction"] == "RVP": pend_in[k] += int(i["quantity"])
    else:
        pend_out[k] += int(i["quantity"])
        if not i["_open_lack"]: need_19[k] += int(i["quantity"])
positions = []
sec_by = {s["isin"]: s for s in active_secs}
for a in accounts:
    held = {s["isin"] for s in random.sample(active_secs, random.randint(15, 30))}
    keys = held | {k[1] for k in list(flows) + list(pend_in) + list(pend_out) if k[0] == a["account_id"]}
    for isn in sorted(keys):
        s = sec_by[isn]; k = (a["account_id"], isn); unit = 100 if is_bond(s) else 1
        base = random.choice([1000, 2500, 5000, 10000, 25000, 50000, 100000]) * unit if isn in held else 0
        run, low = 0, 0
        for _, q in sorted(flows[k]): run += q; low = min(low, run)
        opening = max(base, -low)
        if opening + run < need_19[k]: opening += need_19[k] - (opening + run) + random.choice([0, 0, 500, 1000]) * unit
        q = opening + run
        if q == 0 and not pend_in[k] and not pend_out[k]: continue
        positions.append(dict(as_of_date="2026-11-18", account_id=a["account_id"], isin=isn, quantity=q, pending_receipts=pend_in[k], pending_deliveries=pend_out[k],
            market_value_usd=round(q * float(s["ref_price"]) / (100 if is_bond(s) else 1), 2)))
assert next(p for p in positions if p["account_id"] == "4471-AGI-GLEQ" and p["isin"] == "US67066G1040")["pending_receipts"] == 8000

# ---------------- inquiries, inventory, stock loan, Goldman SSI book ----------------
inquiries = []
iq = 0
for day in days:
    for _ in range(random.randint(18, 30) if day != TODAY else random.randint(8, 14)):
        iq += 1
        disc = random.random() < 0.45
        cand = [i for i in instr if i["trade_date"] <= str(day)]
        rel = random.choice(cand) if cand else None
        acc = next(a for a in accounts if a["account_id"] == rel["client_account_id"]) if rel else random.choice(accounts)
        intent = random.choices(["TRANSACTION_STATUS","CORP_ACTION","TAX","OTHER"], weights=[0.55,0.2,0.12,0.13])[0]
        t = at(day, random.randint(7, 8), random.randint(0, 59)) if day == TODAY else at(day, random.randint(7, 18), random.randint(0, 59))
        inquiries.append(dict(inquiry_id=f"INQ-{day.strftime('%Y%m%d')}-{iq:05d}", received_ts_et=et(t),
            client_short_code=acc["client_short_code"], channel=random.choice(["EMAIL","EMAIL","PORTAL","PHONE"]), intent=intent,
            related_instruction_id=rel["instruction_id"] if intent == "TRANSACTION_STATUS" and rel else "", draft_by="DISC" if disc and intent == "TRANSACTION_STATUS" else "HUMAN",
            response_seconds=random.randint(18, 35) if disc and intent == "TRANSACTION_STATUS" else random.randint(60, 140), reviewed_by=random.choice(analysts), status="CLOSED"))

inventory = []
for s in eq_secs:
    inventory.append(dict(as_of_date="2026-11-19", isin=s["isin"], box_location="DTC-0005", quantity_available=random.randint(20000, 900000) if s["ticker"] != "NVDA" else 412500,
        quantity_pledged=random.randint(0, 50000), quantity_on_loan=random.randint(0, 80000)))
stock_loan = []
for k in range(160):
    s = random.choice(eq_secs)
    stock_loan.append(dict(loan_id=f"SL-{2026}{k+1:05d}", isin=s["isin"], quantity=random.choice([5000, 10000, 25000, 50000]), counterparty=random.choice(other_clients + [b[0] for b in brokers[1:]]),
        direction=random.choice(["LEND", "BORROW"]), start_date=str(random.choice(days)), recall_status=random.choice(["NONE","NONE","NONE","RECALLED","RECALL_PENDING"])))
bny_client_names = {a["client_legal_name"].replace(" (synthetic)", "") for a in accounts}
gs_ssi = []
for cn in sorted({t["client_name"] for t in gs_trades}):
    cust, part = ("The Bank of New York Mellon", "0901") if cn in bny_client_names or cn.startswith("Allianz") else CUSTODIAN_OF[cn]
    gs_ssi.append(dict(ssi_ref=f"GSSSI-{len(gs_ssi)+1:05d}", custodian_name=cust, client_name=cn, market="US", dtc_participant=part, effective_date="2025-01-15", status="ACTIVE"))

broker_list = [dict(broker_name=b, broker_lei=LEI[b], approved_markets="US;EU;UK", status="APPROVED") for b, _ in brokers]
funds = [dict(fund_code=fc, fund_name=fn, domicile=dom, custodian="BNY", base_currency="USD" if fc.startswith("AGI-US") else "EUR") for fc, fn, dom in agi_funds]

# superseded/duplicate noise row
dup = dict(random.choice([i for i in instr if i["status"] == "SETTLED" and not i["dtc_reference"].startswith("DTC-DO-20261119")]))
dup["instruction_id"] = dup["instruction_id"][:-3] + "999"; dup["status"] = "CANCELLED"; dup["amends_instruction_id"] = ""; dup["dtc_reference"] = ""
dup["_status_t"] = dup["_recv"] + dt.timedelta(minutes=9)
instr.append(dup)

# ---------------- finalize ids and timestamps ----------------
for i in instr:
    i["received_ts_et"] = et(i["_recv"]); i["status_ts_et"] = et(i["_status_t"])
for r in repair:
    r["opened_ts_et"] = et(r["_opened"]); r["resolved_ts_et"] = et(r["_resolved"]) if r["_resolved"] else ""
_ex = defaultdict(int)
for r in sorted(fails_bny, key=lambda r: r["_t"]):
    r["detected_ts_et"] = et(r["_t"])
    if r.get("exception_id") == "EXC-20261119-0907": continue
    d = r["_t"].astimezone(ET).strftime("%Y%m%d"); _ex[d] += 1
    n = 880 + _ex[d]
    if d == "20261119" and n >= 907: n += 1
    r["exception_id"] = f"EXC-{d}-{n:04d}"
_gf = defaultdict(int)
for r in sorted(gs_fails, key=lambda r: r["_t"]):
    r["opened_ts_utc"] = utc(r["_t"])
    if r.get("gs_fail_id") == "GS-FAIL-20261119-0091": continue
    d = r["_t"].astimezone(ET).strftime("%Y%m%d"); _gf[d] += 1
    n = 70 + _gf[d]
    if d == "20261119" and n >= 91: n += 1
    r["gs_fail_id"] = f"GS-FAIL-{d}-{n:04d}"
for e in dtc_all: e["event_ts_et"] = dtc_ts(e["_t"])
instr.sort(key=lambda r: r["_recv"]); gs_fails.sort(key=lambda r: r["_t"]); fails_bny.sort(key=lambda r: r["_t"]); repair.sort(key=lambda r: r["_opened"])
dtc_all.sort(key=lambda r: (r["_t"], r["dtc_reference"])); gs_trades.sort(key=lambda r: r["exec_ts_utc"])

# ---------------- write ----------------
write("bny", "client_accounts", client_accounts, ["account_id","client_legal_name","client_short_code","fund_name","account_type","base_currency","client_tier","relationship_manager","service_executive","status","opened_date"])
write("bny", "securities_master", securities, ["bny_sec_id","isin","cusip","ticker","issuer_name","asset_class","currency","primary_exchange","settlement_cycle","settlement_location","ref_price","id_source","status"])
write("bny", "ssi_counterparties", ssi_bny, ["ssi_id","counterparty_name","counterparty_lei","market","asset_class","depository","dtc_participant","agent_bic","effective_date","end_date","verified_by","verification_date","status"])
write("bny", "settlement_instructions", instr, ["instruction_id","received_ts_et","source_channel","client_account_id","client_ref","direction","isin","quantity","price","settlement_amount","currency","trade_date","settle_date","counterparty_name","cpty_dtc_participant","settlement_location","amends_instruction_id","dtc_reference","status","status_ts_et"])
write("bny", "repair_queue", repair, ["repair_id","instruction_id","opened_ts_et","repair_reason","routed_to","priority_score","cutoff_ts_et","trade_value_usd","assigned_to","resolution","resolved_ts_et","verified_by","comments"])
write("bny", "positions", positions, ["as_of_date","account_id","isin","quantity","pending_receipts","pending_deliveries","market_value_usd"])
write("bny", "cash_ledger", cash, ["entry_id","account_id","value_date","amount","currency","entry_type","related_instruction_id","status"])
write("bny", "fails_exceptions", fails_bny, ["exception_id","instruction_id","dtc_reference","detected_ts_et","fail_reason","counterparty_name","days_outstanding","status","owner","resolution_notes"])
write("bny", "client_inquiries", inquiries, ["inquiry_id","received_ts_et","client_short_code","channel","intent","related_instruction_id","draft_by","response_seconds","reviewed_by","status"])
write("goldman", "trade_blotter", gs_trades, ["gs_trade_ref","exec_ts_utc","client_name","side","client_side","ticker","isin","quantity","price","gross_amount","commission","trade_date","settle_date","desk","trader_id","status"])
write("goldman", "allocations_confirms", gs_allocs, ["alloc_id","gs_trade_ref","client_name","client_account_ref","quantity","custodian_name","custodian_dtc_participant","ctm_confirm_id","affirmed","affirmed_ts_utc","version","status"])
write("goldman", "deliveries", gs_deliv, ["delivery_id","gs_trade_ref","dtc_reference","from_participant","to_participant","isin","quantity","settlement_amount","instructed_ts_utc","status","status_ts_utc","dk_reason"])
write("goldman", "fails", gs_fails, ["gs_fail_id","delivery_id","counterparty_custodian","fail_reason","opened_ts_utc","age_days","exposure_usd","owner","next_action","status"])
write("goldman", "inventory", inventory, ["as_of_date","isin","box_location","quantity_available","quantity_pledged","quantity_on_loan"])
write("goldman", "ssi_book", gs_ssi, ["ssi_ref","custodian_name","client_name","market","dtc_participant","effective_date","status"])
write("goldman", "stock_loan", stock_loan, ["loan_id","isin","quantity","counterparty","direction","start_date","recall_status"])
write("dtc", "settlement_activity", dtc_all, ["dtc_reference","event_ts_et","deliverer_participant","receiver_participant","isin","quantity","settlement_amount","transaction_type","event","reason_code"])
write("dtc", "participants", participants, ["participant_number","participant_name","type","id_source","status"])
write("allianzgi", "orders", agi_orders, ["agi_order_id","created_ts_cet","portfolio_manager","fund_code","side","isin","quantity","limit_price","broker","status"])
write("allianzgi", "allocations", agi_allocs, ["allocation_id","agi_order_id","fund_code","quantity","version","amended_ts_cet","custodian","sent_to_custodian_ts_cet","status"])
write("allianzgi", "funds", funds, ["fund_code","fund_name","domicile","custodian","base_currency"])
write("allianzgi", "broker_list", broker_list, ["broker_name","broker_lei","approved_markets","status"])
