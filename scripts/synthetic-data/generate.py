"""Synthetic data generator for the BNY x CMU A2A prototype.
Deterministic (seed 20261119). Writes CSVs to <repo>/data/<firm>/<table>.csv
"""
import csv, os, random, datetime as dt
from collections import defaultdict

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

ET = dt.timezone(dt.timedelta(hours=-5))
UTC = dt.timezone.utc
CET = dt.timezone(dt.timedelta(hours=1))
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

# ---------------- AllianzGI orders & allocations ----------------
agi_orders, agi_allocs = [], []
pms = ["F. Becker","C. Rossi","E. Laurent","J. Schmidt","A. Novak"]
ord_seq = defaultdict(int)

# ---------------- trades (BNY instructions) ----------------
instr, repair, fails_bny, cash, dtc_rows = [], [], [], [], []
gs_trades, gs_allocs, gs_deliv, gs_fails = [], [], [], []
inst_seq = defaultdict(lambda: 5500000)
rq_seq = defaultdict(lambda: 380); ex_seq = defaultdict(lambda: 880); dtc_seq = defaultdict(int); gs_seq = defaultdict(lambda: 440000); gsf_seq = defaultdict(lambda: 70)
ctm_seq = [77100000]
analysts = ["J. Rivera","M. Kowalski","S. Iyer","B. Murphy","R. Aboaba","O. Ahmadov"]

def new_iid(day):
    inst_seq[day] += random.randint(30, 140)
    return f"BNYI-{day.strftime('%Y%m%d')}-{inst_seq[day]:07d}"
def new_dtc(day):
    dtc_seq[day] += 1
    return f"DTC-{'DO'}-{day.strftime('%Y%m%d')}-{dtc_seq[day]:06d}"
def new_gs(day):
    gs_seq[day] += random.randint(5, 60)
    return f"GS-EQ-{day.strftime('%Y%m%d')}-{gs_seq[day]:06d}"

RES_BY_REASON = {"MISSING_CPTY_PARTICIPANT": ["ENRICHED_FROM_SSI", "CONFIRMED_WITH_CLIENT"], "QTY_PRICE_MISMATCH": ["CORRECTED_PER_CLIENT", "CONFIRMED_WITH_CLIENT"],
    "INVALID_SSI": ["ENRICHED_FROM_SSI", "CONFIRMED_WITH_CLIENT"], "MISSING_SETTLE_DATE": ["CONFIRMED_WITH_CLIENT", "CORRECTED_PER_CLIENT"],
    "DUPLICATE_SUSPECT": ["CANCELLED_DUPLICATE", "CONFIRMED_WITH_CLIENT"]}
COMMENT = {"REJECTED_NO_REFDATA_MATCH": "DE: no unique refdata match, returned to human queue; ISIN confirmed with client and keyed",
    "ENRICHED_FROM_REFDATA": "", "ENRICHED_FROM_SSI": "participant taken from active verified SSI",
    "CONFIRMED_WITH_CLIENT": "confirmed with client ops by email", "CORRECTED_PER_CLIENT": "client resent corrected details",
    "CANCELLED_DUPLICATE": "client confirmed duplicate, cancelled"}
REPAIR_REASONS = [("MISSING_SEC_ID",0.26),("MISSING_CPTY_PARTICIPANT",0.18),("QTY_PRICE_MISMATCH",0.2),("INVALID_SSI",0.16),("MISSING_SETTLE_DATE",0.1),("DUPLICATE_SUSPECT",0.1)]
FAIL_REASONS = [("LACK_OF_SECURITIES",0.36),("SSI_MISMATCH",0.18),("LATE_AFFIRMATION",0.15),("DK_QTY_MISMATCH",0.11),("ON_HOLD",0.11),("CASH_SHORTFALL",0.09)]
def pick(pairs): return random.choices([p for p,_ in pairs], weights=[w for _,w in pairs])[0]

def gs_book(day, exec_dt, client_name, client_side, sec, qty, px, custodian, cust_part, client_ref, settle, status_final, affirmed=True):
    ref = new_gs(day)
    gross = round(qty * px, 2); comm = round(qty * 0.01, 2)
    gs_trades.append(dict(gs_trade_ref=ref, exec_ts_utc=utc(exec_dt), client_name=client_name, side="SELL" if client_side == "BUY" else "BUY",
        client_side=client_side, ticker=sec["ticker"], isin=sec["isin"], quantity=qty, price=px, gross_amount=gross, commission=comm,
        trade_date=str(day), settle_date=str(settle), desk=random.choice(["US Cash Equities","Program Trading","High Touch"]),
        trader_id=f"T{random.randint(1000,9999)}", status="BOOKED"))
    ctm_seq[0] += random.randint(10, 900)
    gs_allocs.append(dict(alloc_id=f"AL-{ref[6:]}-1", gs_trade_ref=ref, client_name=client_name, client_account_ref=client_ref, quantity=qty,
        custodian_name=custodian, custodian_dtc_participant=cust_part, ctm_confirm_id=f"CTM-{ctm_seq[0]}", affirmed="Y" if affirmed else "N",
        affirmed_ts_utc=utc(exec_dt + dt.timedelta(hours=random.uniform(1, 5))) if affirmed else "", version=1, status="AFFIRMED" if affirmed else "PENDING_AFFIRMATION"))
    return ref, gross, comm

dtc_all = []
def dtc_events(ref, settle, deliverer, receiver, sec, qty, amt, outcome):
    t0 = at(settle, random.randint(6, 9), random.randint(0, 59))
    dtc_all.append(dict(dtc_reference=ref, event_ts_et=dtc_ts(t0), deliverer_participant=deliverer, receiver_participant=receiver, isin=sec["isin"],
        quantity=qty, settlement_amount=amt, transaction_type="DVP", event="INSTRUCTED", reason_code=""))
    if outcome == "SETTLED":
        dtc_all.append(dict(dtc_all[-1], event_ts_et=dtc_ts(t0 + dt.timedelta(minutes=random.randint(1, 240))), event="SETTLED"))
    elif outcome == "DK":
        dtc_all.append(dict(dtc_all[-1], event_ts_et=dtc_ts(t0 + dt.timedelta(minutes=1)), event="DK", reason_code="QTY_MISMATCH"))
    elif outcome == "PENDING":
        dtc_all.append(dict(dtc_all[-1], event_ts_et=dtc_ts(t0 + dt.timedelta(minutes=random.randint(5, 120))), event="PENDING", reason_code="INSUFFICIENT_POSITION"))
    return t0

TODAY = D("2026-11-19")
for day in days[:-1]:  # trade dates Oct 20 .. Nov 18
    n_trades = random.randint(88, 112)
    for _ in range(n_trades):
        is_agi = random.random() < 0.17
        acc = random.choice([a for a in accounts if a["client_short_code"] == "AGI"]) if is_agi else random.choice([a for a in accounts if a["client_short_code"] != "AGI"])
        r = random.random()
        sec = random.choice(eq_secs) if r < 0.68 else random.choice([s for s in active_secs if s["asset_class"] == "UST"]) if r < 0.85 else random.choice([s for s in active_secs if s["asset_class"] == "CORP_BOND"])
        bn, bpart = random.choices(brokers, weights=broker_w)[0]
        side = random.choice(["BUY", "SELL"])
        if sec["asset_class"] in ("EQUITY", "ETF"):
            qty = random.choice([100, 250, 500, 1000, 1500, 2000, 2500, 5000, 7500, 10000, 15000, 20000, 25000])
            px = round(float(sec["ref_price"]) * random.uniform(0.95, 1.05), 2)
        else:
            qty = random.choice([250000, 500000, 1000000, 2000000, 5000000])
            px = round(float(sec["ref_price"]) * random.uniform(0.99, 1.01), 4)
        settle = next_bd(day, 1)
        amount = round(qty * px / (100 if sec["asset_class"] in ("UST","CORP_BOND") else 1), 2)
        exec_dt = at(day, random.randint(9, 15), random.randint(0, 59), random.randint(0, 59))
        recv = exec_dt + dt.timedelta(hours=random.uniform(1.5, 6))
        iid = new_iid(day)
        client_ref = f"{acc['client_short_code']}-{day.strftime('%y%m%d')}-{random.randint(1000,9999)}"
        # AllianzGI order + allocation
        if is_agi:
            ord_seq[day] += random.randint(3, 25)
            fc = [k for k, v in agi_accounts.items() if v == acc["account_id"]][0]
            oid = f"AGI-ORD-26-{day.timetuple().tm_yday:03d}-{ord_seq[day]:04d}"
            client_ref = oid
            agi_orders.append(dict(agi_order_id=oid, created_ts_cet=cet(exec_dt - dt.timedelta(minutes=random.randint(5, 90))), portfolio_manager=random.choice(pms),
                fund_code=fc, side=side, isin=sec["isin"], quantity=qty, limit_price=round(px * 1.01, 2), broker=bn, status="FILLED"))
            agi_allocs.append(dict(allocation_id=f"ALC-{oid[8:]}-1", agi_order_id=oid, fund_code=fc, quantity=qty, version=1, amended_ts_cet="",
                custodian="BNY", sent_to_custodian_ts_cet=cet(recv - dt.timedelta(minutes=3)), status="SENT"))
        # outcome
        last = settle == TODAY
        rep = random.random() < 0.06
        fail = random.random() < 0.04
        status = "SETTLED"
        if last: status = random.choice(["SENT_TO_DTC", "MATCHED", "SENT_TO_DTC", "ENRICHED"])
        loc = sec["settlement_location"]
        instr_row = dict(instruction_id=iid, received_ts_et=et(recv), source_channel=random.choice(["SWIFT_MT541","SWIFT_MT541","CTM","PORTAL"]) if side == "BUY" else random.choice(["SWIFT_MT543","CTM","PORTAL"]),
            client_account_id=acc["account_id"], client_ref=client_ref, direction="RVP" if side == "BUY" else "DVP", isin=sec["isin"], quantity=qty, price=px,
            settlement_amount=amount, currency="USD", trade_date=str(day), settle_date=str(settle), counterparty_name=bn, cpty_dtc_participant=bpart,
            settlement_location=loc, amends_instruction_id="", status=status, status_ts_et=et(at(settle, 15, random.randint(0, 59)) if status == "SETTLED" else recv + dt.timedelta(minutes=4)))
        if rep:
            reason = pick(REPAIR_REASONS)
            rq_seq[day] += 1
            rid = f"RQ-{day.strftime('%Y%m%d')}-{rq_seq[day]:04d}"
            de = reason == "MISSING_SEC_ID"
            de_ok = de and random.random() < 0.55
            opened = recv + dt.timedelta(minutes=1)
            resolved = opened + dt.timedelta(minutes=random.randint(2, 15) if de_ok else random.randint(20, 300))
            if reason == "MISSING_CPTY_PARTICIPANT": instr_row["cpty_dtc_participant"] = ""
            open_item = last and random.random() < 0.5
            pscore = round(min(97, amount / 150000 + (30 if acc["client_tier"] == 1 else 10) + random.uniform(0, 20)), 1)
            assigned = "" if open_item else ("DE-REPAIR-01" if de else random.choice(analysts))
            fix = RES_BY_REASON.get(reason, ["CORRECTED_PER_CLIENT"])
            resolution = "" if open_item else ("ENRICHED_FROM_REFDATA" if de_ok else ("REJECTED_NO_REFDATA_MATCH" if de else random.choice(fix * (4 // len(fix)))))
            verifier = "" if open_item else random.choice(analysts)
            if verifier and verifier == assigned: verifier = analysts[(analysts.index(verifier) + 1) % len(analysts)]
            repair.append(dict(repair_id=rid, instruction_id=iid, opened_ts_et=et(opened), repair_reason=reason, routed_to="DIGITAL_EMPLOYEE" if de else "HUMAN",
                priority_score=pscore,
                cutoff_ts_et=et(at(settle, 14, 30)), trade_value_usd=amount, assigned_to=assigned, resolution=resolution,
                resolved_ts_et="" if open_item else et(resolved), verified_by=verifier,
                comments="awaiting analyst" if open_item else COMMENT.get(resolution, "")))
            if open_item: instr_row["status"] = "IN_REPAIR"
        instr.append(instr_row)
        # Goldman side
        gs_ref = None
        if bn.startswith("Goldman") and loc == "DTC":
            gs_ref, _, _ = gs_book(day, exec_dt, acc["client_legal_name"].replace(" (synthetic)", "") if acc["client_short_code"] != "AGI" else "Allianz Global Investors GmbH",
                side, sec, qty, px, "The Bank of New York Mellon", "0901", client_ref, settle, "SETTLED")
        # DTC & fails
        if loc == "DTC":
            dref = new_dtc(settle)
            deliverer, receiver = (bpart, "0901") if side == "BUY" else ("0901", bpart)
            outcome = "SETTLED"
            if fail: outcome = "PENDING"
            if last and outcome == "SETTLED": outcome = random.choice(["SETTLED", "SETTLED", "INSTRUCTED"])
            t0 = dtc_events(dref, settle, deliverer, receiver, sec, qty, amount, outcome if outcome != "INSTRUCTED" else "NONE")
            if gs_ref:
                gs_deliv.append(dict(delivery_id=f"DEL-{gs_ref[6:]}", gs_trade_ref=gs_ref, dtc_reference=dref, from_participant=deliverer, to_participant=receiver,
                    isin=sec["isin"], quantity=qty, settlement_amount=amount, instructed_ts_utc=utc(t0),
                    status="SETTLED" if outcome == "SETTLED" else ("PENDING" if outcome == "PENDING" else "DELIVERED"), status_ts_utc=utc(t0 + dt.timedelta(minutes=30)), dk_reason=""))
        if fail:
            reason = pick(FAIL_REASONS)
            ex_seq[settle] += 1
            age = max(0, (TODAY - settle).days)
            st = "OPEN" if age <= 3 and random.random() < 0.6 else "RESOLVED"
            if instr_row["status"] == "SETTLED" and st == "OPEN": instr_row["status"] = "PENDING_SETTLEMENT"
            fails_bny.append(dict(exception_id=f"EXC-{settle.strftime('%Y%m%d')}-{ex_seq[settle]:04d}", instruction_id=iid, dtc_reference=dref if loc == "DTC" else "",
                detected_ts_et=et(at(settle, random.randint(8, 13), random.randint(0, 59))), fail_reason=reason, counterparty_name=bn, days_outstanding=age if st == "OPEN" else "",
                status=st, owner=random.choice(analysts) if st == "RESOLVED" or random.random() < 0.6 else "",
                resolution_notes=random.choice(["cpty delivered late, settled S+1","client resent instruction","SSI corrected after call with cpty ops","partial borrow arranged by cpty","awaiting cpty response, chased by email",""]) if st == "RESOLVED" else random.choice(["chased cpty by phone 10:15, awaiting callback","emailed cpty ops, no response yet","cpty says shares due from their own fail",""])))
            if gs_ref and loc == "DTC":
                gsf_seq[settle] += 1
                gs_fails.append(dict(gs_fail_id=f"GS-FAIL-{settle.strftime('%Y%m%d')}-{gsf_seq[settle]:04d}", delivery_id=f"DEL-{gs_ref[6:]}", counterparty_custodian="The Bank of New York Mellon",
                    fail_reason={"LACK_OF_SECURITIES":"SHORT_INVENTORY","SSI_MISMATCH":"CPTY_SSI_MISMATCH","LATE_AFFIRMATION":"UNAFFIRMED","DK_QTY_MISMATCH":"DK_BY_RECEIVER","ON_HOLD":"HELD","CASH_SHORTFALL":"CPTY_CASH"}[reason],
                    opened_ts_utc=utc(at(settle, 8, random.randint(0, 59))), age_days=age, exposure_usd=amount, owner=random.choice(["fails-desk-1","fails-desk-2","fails-desk-3"]),
                    next_action=random.choice(["chase custodian","borrow","await client","escalate"]), status="OPEN" if st == "OPEN" else "CLOSED"))
        if instr_row["status"] in ("SETTLED",):
            cash.append(dict(entry_id=f"CL-{iid[5:]}", account_id=acc["account_id"].replace("-AGI-", "-AGC-") if is_agi else acc["account_id"], value_date=str(settle),
                amount=-amount if side == "BUY" else amount, currency="USD", entry_type="TRADE_SETTLEMENT", related_instruction_id=iid, status="POSTED"))

# Goldman trades with other custodians (non-BNY clients)
other_custs = [("State Street Bank and Trust Co","7201"),("JPMorgan Chase Bank NA (custody)","7202"),("Citibank NA (custody)","7203"),("The Northern Trust Company","7204")]
other_clients = ["Redwood Pension Board","Halcyon Capital","Cardinal Insurance Co","Granby Endowment","Lumen Asset Management","Osprey Partners","Vantage Mutual",
"Meadowlark Advisors","Stonebridge Retirement","Aldgate Investments","Coral Bay Capital","Hawthorn Pension"]
for day in days[:-1]:
    for _ in range(random.randint(55, 75)):
        cn = random.choice(other_clients); cust, cpart = random.choice(other_custs)
        sec = random.choice(eq_secs); qty = random.choice([500, 1000, 2500, 5000, 10000, 20000]); px = round(float(sec["ref_price"]) * random.uniform(0.95, 1.05), 2)
        side = random.choice(["BUY", "SELL"]); settle = next_bd(day, 1)
        exec_dt = at(day, random.randint(9, 15), random.randint(0, 59))
        aff = random.random() > 0.03
        ref, gross, comm = gs_book(day, exec_dt, cn, side, sec, qty, px, cust, cpart, f"{cn[:3].upper()}{random.randint(100000,999999)}", settle, "SETTLED", affirmed=aff)
        dref = new_dtc(settle); amount = round(qty * px, 2)
        deliverer, receiver = ("0005", cpart) if side == "BUY" else (cpart, "0005")
        f = random.random() < 0.035
        outcome = "PENDING" if f else ("SETTLED" if settle != TODAY else random.choice(["SETTLED", "NONE"]))
        t0 = dtc_events(dref, settle, deliverer, receiver, sec, qty, amount, outcome)
        gs_deliv.append(dict(delivery_id=f"DEL-{ref[6:]}", gs_trade_ref=ref, dtc_reference=dref, from_participant=deliverer, to_participant=receiver, isin=sec["isin"],
            quantity=qty, settlement_amount=amount, instructed_ts_utc=utc(t0), status={"SETTLED":"SETTLED","PENDING":"PENDING","NONE":"DELIVERED"}[outcome],
            status_ts_utc=utc(t0 + dt.timedelta(minutes=20)), dk_reason=""))
        if f:
            gsf_seq[settle] += 1; age = max(0, (TODAY - settle).days)
            gs_fails.append(dict(gs_fail_id=f"GS-FAIL-{settle.strftime('%Y%m%d')}-{gsf_seq[settle]:04d}", delivery_id=f"DEL-{ref[6:]}", counterparty_custodian=cust,
                fail_reason=random.choice(["SHORT_INVENTORY","SHORT_INVENTORY","CPTY_SSI_MISMATCH","UNAFFIRMED","DK_BY_RECEIVER"]), opened_ts_utc=utc(at(settle, 8, (gsf_seq[settle] * 7) % 50 + 5)),
                age_days=age, exposure_usd=amount, owner=random.choice(["fails-desk-1","fails-desk-2","fails-desk-3"]), next_action=random.choice(["chase custodian","borrow","escalate"]),
                status="OPEN" if age <= 2 else "CLOSED"))

# ---------------- GOLDEN CASE ----------------
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
agi_orders.append(dict(agi_order_id="AGI-ORD-26-322-0773", created_ts_cet=cet(at(T, 14, 31)), portfolio_manager="F. Becker", fund_code="AGI-GLEQ", side="BUY",
    isin="US67066G1040", quantity=10000, limit_price=187.00, broker="Goldman Sachs & Co. LLC", status="FILLED"))
agi_allocs.append(dict(allocation_id="ALC-26-322-0773-1", agi_order_id="AGI-ORD-26-322-0773", fund_code="AGI-GLEQ", quantity=8000, version=1, amended_ts_cet="",
    custodian="BNY", sent_to_custodian_ts_cet="18.11.2026 21:10", status="SUPERSEDED"))
agi_allocs.append(dict(allocation_id="ALC-26-322-0773-2", agi_order_id="AGI-ORD-26-322-0773", fund_code="AGI-GLEQ", quantity=10000, version=2, amended_ts_cet="18.11.2026 23:40",
    custodian="BNY", sent_to_custodian_ts_cet="19.11.2026 00:05", status="SENT"))
instr.append(dict(instruction_id="BNYI-20261118-5527301", received_ts_et="2026-11-18 15:10:04", source_channel="SWIFT_MT541", client_account_id="4471-AGI-GLEQ",
    client_ref="AGI-ORD-26-322-0773", direction="RVP", isin="US67066G1040", quantity=8000, price=186.25, settlement_amount=1490080.00, currency="USD",
    trade_date=str(T), settle_date=str(S), counterparty_name="Goldman Sachs & Co. LLC", cpty_dtc_participant="0005", settlement_location="DTC",
    amends_instruction_id="", status="SENT_TO_DTC", status_ts_et="2026-11-18 15:14:22"))
instr.append(dict(instruction_id="BNYI-20261118-5529944", received_ts_et="2026-11-18 18:05:37", source_channel="SWIFT_MT541", client_account_id="4471-AGI-GLEQ",
    client_ref="AGI-ORD-26-322-0773", direction="RVP", isin="US67066G1040", quantity=10000, price=186.25, settlement_amount=1862600.00, currency="USD",
    trade_date=str(T), settle_date=str(S), counterparty_name="Goldman Sachs & Co. LLC", cpty_dtc_participant="", settlement_location="DTC",
    amends_instruction_id="BNYI-20261118-5527301", status="IN_REPAIR", status_ts_et="2026-11-18 18:06:02"))
repair.append(dict(repair_id="RQ-20261118-0412", instruction_id="BNYI-20261118-5529944", opened_ts_et="2026-11-18 18:06:02", repair_reason="MISSING_CPTY_PARTICIPANT",
    routed_to="HUMAN", priority_score=88.4, cutoff_ts_et="2026-11-19 14:30:00", trade_value_usd=1862600.00, assigned_to="", resolution="", resolved_ts_et="", verified_by="",
    comments="amend of 5527301; 97A/95P counterparty field empty on inbound MT541"))
dtc_all.append(dict(dtc_reference="DTC-DO-20261119-000318", event_ts_et="2026-11-19T08:15:09-05:00", deliverer_participant="0005", receiver_participant="0901",
    isin="US67066G1040", quantity=10000, settlement_amount=1862600.00, transaction_type="DVP", event="INSTRUCTED", reason_code=""))
dtc_all.append(dict(dtc_all[-1], event_ts_et="2026-11-19T08:16:02-05:00", event="DK", reason_code="QTY_MISMATCH"))
gs_deliv.append(dict(delivery_id="DEL-20261118-448213", gs_trade_ref="GS-EQ-20261118-448213", dtc_reference="DTC-DO-20261119-000318", from_participant="0005",
    to_participant="0901", isin="US67066G1040", quantity=10000, settlement_amount=1862600.00, instructed_ts_utc="2026-11-19T13:15:09Z", status="DK",
    status_ts_utc="2026-11-19T13:16:02Z", dk_reason="QTY_MISMATCH"))
gs_fails.append(dict(gs_fail_id="GS-FAIL-20261119-0091", delivery_id="DEL-20261118-448213", counterparty_custodian="The Bank of New York Mellon", fail_reason="DK_BY_RECEIVER",
    opened_ts_utc="2026-11-19T13:17:00Z", age_days=0, exposure_usd=1862600.00, owner="", next_action="contact receiving custodian", status="OPEN"))
fails_bny.append(dict(exception_id="EXC-20261119-0907", instruction_id="BNYI-20261118-5527301", dtc_reference="DTC-DO-20261119-000318", detected_ts_et="2026-11-19 08:16:30",
    fail_reason="DK_QTY_MISMATCH", counterparty_name="Goldman Sachs & Co. LLC", days_outstanding=0, status="OPEN", owner="",
    resolution_notes="delivered 10,000 vs instructed 8,000; auto-DK"))
# near-miss 1: another NVDA trade for a different client same day, Goldman, settles fine
lk = [a for a in accounts if a["client_short_code"] == "LTP"][0]
instr.append(dict(instruction_id="BNYI-20261118-5527388", received_ts_et="2026-11-18 15:22:47", source_channel="CTM", client_account_id=lk["account_id"], client_ref="LTP-261118-4410",
    direction="RVP", isin="US67066G1040", quantity=8000, price=186.31, settlement_amount=1490480.00, currency="USD", trade_date=str(T), settle_date=str(S),
    counterparty_name="Goldman Sachs & Co. LLC", cpty_dtc_participant="0005", settlement_location="DTC", amends_instruction_id="", status="MATCHED", status_ts_et="2026-11-18 16:01:10"))
dtc_all.append(dict(dtc_reference="DTC-DO-20261119-000301", event_ts_et="2026-11-19T07:58:40-05:00", deliverer_participant="0005", receiver_participant="0901",
    isin="US67066G1040", quantity=8000, settlement_amount=1490480.00, transaction_type="DVP", event="INSTRUCTED", reason_code=""))
dtc_all.append(dict(dtc_all[-1], event_ts_et="2026-11-19T08:02:15-05:00", event="SETTLED"))
gs_trades.append(dict(gs_trade_ref="GS-EQ-20261118-448190", exec_ts_utc=utc(at(T, 15, 4, 12)), client_name="Lakeshore Teachers' Pension Plan", side="SELL", client_side="BUY",
    ticker="NVDA", isin="US67066G1040", quantity=8000, price=186.31, gross_amount=1490480.00, commission=80.00, trade_date=str(T), settle_date=str(S), desk="Program Trading", trader_id="T2290", status="BOOKED"))
gs_allocs.append(dict(alloc_id="AL-20261118-448190-1", gs_trade_ref="GS-EQ-20261118-448190", client_name="Lakeshore Teachers' Pension Plan", client_account_ref="LTP-261118-4410",
    quantity=8000, custodian_name="The Bank of New York Mellon", custodian_dtc_participant="0901", ctm_confirm_id="CTM-77104488", affirmed="Y", affirmed_ts_utc="2026-11-18T21:40:55Z", version=1, status="AFFIRMED"))
gs_deliv.append(dict(delivery_id="DEL-20261118-448190", gs_trade_ref="GS-EQ-20261118-448190", dtc_reference="DTC-DO-20261119-000301", from_participant="0005", to_participant="0901",
    isin="US67066G1040", quantity=8000, settlement_amount=1490480.00, instructed_ts_utc="2026-11-19T12:58:40Z", status="SETTLED", status_ts_utc="2026-11-19T13:02:15Z", dk_reason=""))
# near-miss 3: AGI trade with Morgan Stanley in repair (invalid SSI)
agi_orders.append(dict(agi_order_id="AGI-ORD-26-322-0781", created_ts_cet="18.11.2026 20:12", portfolio_manager="C. Rossi", fund_code="AGI-TECH", side="BUY",
    isin=sec_by_isin[isin_from_cusip("11135F101")]["isin"], quantity=5000, limit_price=203.0, broker="Morgan Stanley & Co. LLC", status="FILLED"))
instr.append(dict(instruction_id="BNYI-20261118-5528610", received_ts_et="2026-11-18 16:40:12", source_channel="SWIFT_MT541", client_account_id=agi_accounts["AGI-TECH"],
    client_ref="AGI-ORD-26-322-0781", direction="RVP", isin=isin_from_cusip("11135F101"), quantity=5000, price=201.88, settlement_amount=1009400.00, currency="USD",
    trade_date=str(T), settle_date=str(S), counterparty_name="Morgan Stanley & Co. LLC", cpty_dtc_participant="7101", settlement_location="DTC", amends_instruction_id="",
    status="IN_REPAIR", status_ts_et="2026-11-18 16:41:00"))
repair.append(dict(repair_id="RQ-20261118-0407", instruction_id="BNYI-20261118-5528610", opened_ts_et="2026-11-18 16:41:00", repair_reason="INVALID_SSI", routed_to="HUMAN",
    priority_score=71.2, cutoff_ts_et="2026-11-19 14:30:00", trade_value_usd=1009400.00, assigned_to="", resolution="", resolved_ts_et="", verified_by="",
    comments="new MS SSI pending verification (SSI-MS-US-EQ-7101-B)"))

# ---------------- positions, inquiries, inventory, stock loan, gs ssi ----------------
positions = []
for a in accounts:
    held = random.sample(active_secs, random.randint(15, 30))
    for s in held:
        q = random.choice([1000, 2500, 5000, 10000, 25000, 50000, 100000]) * (100 if s["asset_class"] in ("UST","CORP_BOND") else 1)
        price = float(s["ref_price"])
        positions.append(dict(as_of_date="2026-11-18", account_id=a["account_id"], isin=s["isin"], quantity=q, pending_receipts=0, pending_deliveries=0,
            market_value_usd=round(q * price / (100 if s["asset_class"] in ("UST","CORP_BOND") else 1), 2)))
# pending receipts for Nov 19 settlements (BNY sees only the active instruction)
pend = defaultdict(int)
for i in instr:
    if i["settle_date"] == "2026-11-19" and i["direction"] == "RVP" and i["status"] in ("SENT_TO_DTC", "MATCHED", "ENRICHED"):
        pend[(i["client_account_id"], i["isin"])] += int(i["quantity"])
pos_idx = {(p["account_id"], p["isin"]): p for p in positions}
for (aid, isn), q in pend.items():
    if (aid, isn) in pos_idx: pos_idx[(aid, isn)]["pending_receipts"] = q
    else:
        positions.append(dict(as_of_date="2026-11-18", account_id=aid, isin=isn, quantity=0, pending_receipts=q, pending_deliveries=0, market_value_usd=0))
assert pos_idx.get(("4471-AGI-GLEQ", "US67066G1040"), {"pending_receipts": pend[("4471-AGI-GLEQ","US67066G1040")]})["pending_receipts"] == 8000

inquiries = []
iq = 0
for day in days:
    for _ in range(random.randint(18, 30)):
        iq += 1
        disc = random.random() < 0.45
        cand = [i for i in instr if i["trade_date"] <= str(day)]
        rel = random.choice(cand) if cand else None
        acc = next(a for a in accounts if a["account_id"] == rel["client_account_id"]) if rel else random.choice(accounts)
        intent = random.choices(["TRANSACTION_STATUS","CORP_ACTION","TAX","OTHER"], weights=[0.55,0.2,0.12,0.13])[0]
        inquiries.append(dict(inquiry_id=f"INQ-{day.strftime('%Y%m%d')}-{iq:05d}", received_ts_et=et(at(day, random.randint(7, 18), random.randint(0, 59))),
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
gs_ssi = []
for cn in sorted({t["client_name"] for t in gs_trades}):
    cust = "The Bank of New York Mellon" if cn in [a["client_legal_name"].replace(" (synthetic)", "") for a in accounts] or cn.startswith("Allianz") else None
    if cust is None:
        cust, part = random.choice(other_custs)
    else:
        part = "0901"
    gs_ssi.append(dict(ssi_ref=f"GSSSI-{len(gs_ssi)+1:05d}", custodian_name=cust, client_name=cn, market="US", dtc_participant=part, effective_date="2025-01-15", status="ACTIVE"))

broker_list = [dict(broker_name=b, broker_lei=LEI[b], approved_markets="US;EU;UK", status="APPROVED") for b, _ in brokers]
funds = [dict(fund_code=fc, fund_name=fn, domicile=dom, custodian="BNY", base_currency="USD" if fc.startswith("AGI-US") else "EUR") for fc, fn, dom in agi_funds]

# superseded/duplicate noise rows
dup = dict(random.choice([i for i in instr if i["status"] == "SETTLED"]))
dup["instruction_id"] = dup["instruction_id"][:-3] + "999"; dup["status"] = "CANCELLED"; dup["amends_instruction_id"] = ""
instr.append(dup)

# ---------------- write ----------------
_rq = defaultdict(int)
for r in sorted(repair, key=lambda r: r["opened_ts_et"]):
    if r["repair_id"] in ("RQ-20261118-0412", "RQ-20261118-0407"): continue
    d = r["repair_id"][3:11]; _rq[d] += 1; r["repair_id"] = f"RQ-{d}-{380 + _rq[d]:04d}"
NOTES = {
 ("LACK_OF_SECURITIES","RESOLVED"): ["cpty delivered late, settled S+1", "cpty arranged borrow, settled S+1", "partial delivery S, remainder S+1"],
 ("LACK_OF_SECURITIES","OPEN"): ["cpty says shares due from their own fail", "emailed cpty ops, no response yet", "cpty awaiting recall, ETA tomorrow"],
 ("SSI_MISMATCH","RESOLVED"): ["SSI corrected after call with cpty ops", "client resent instruction with correct SSI"],
 ("SSI_MISMATCH","OPEN"): ["called cpty ops, awaiting confirmation of their SSI", "emailed cpty ops, no response yet"],
 ("LATE_AFFIRMATION","RESOLVED"): ["client affirmed late in CTM, settled S+1"],
 ("LATE_AFFIRMATION","OPEN"): ["chased client middle office for affirmation"],
 ("DK_QTY_MISMATCH","RESOLVED"): ["client confirmed qty, instruction amended, cpty redelivered", "cpty corrected delivery qty and redelivered"],
 ("DK_QTY_MISMATCH","OPEN"): ["qty break vs cpty delivery, confirming with client", "emailed cpty ops, no response yet"],
 ("ON_HOLD","RESOLVED"): ["hold released after client cash confirmed"],
 ("ON_HOLD","OPEN"): ["held pending client cash confirmation"],
 ("CASH_SHORTFALL","RESOLVED"): ["client funded account, settled S+1"],
 ("CASH_SHORTFALL","OPEN"): ["client notified of shortfall, awaiting funding"]}
_n19 = 0
for i, r in enumerate(sorted(fails_bny, key=lambda r: r["detected_ts_et"])):
    if r["exception_id"] == "EXC-20261119-0907": continue
    if r["detected_ts_et"].startswith("2026-11-19"):
        _n19 += 1
        r["detected_ts_et"] = f"2026-11-19 {8 + (5 * _n19) // 60:02d}:{(5 * _n19) % 60:02d}:00"
        r["status"], r["days_outstanding"], r["owner"] = "OPEN", 0, ""
    opts = NOTES.get((r["fail_reason"], r["status"]), [""])
    r["resolution_notes"] = "" if (r["status"] == "OPEN" and not r["owner"]) else opts[i % len(opts)]
_ex = defaultdict(int)
for r in sorted(fails_bny, key=lambda r: r["detected_ts_et"]):
    if r["exception_id"] == "EXC-20261119-0907": continue
    d = r["exception_id"][4:12]; _ex[d] += 1; r["exception_id"] = f"EXC-{d}-{880 + _ex[d]:04d}"
# data ends 09:00 ET on 2026-11-19: pull early-morning instructions before the cut, drop later events
_shift = {e["dtc_reference"] for e in dtc_all if e["event"] == "INSTRUCTED" and e["event_ts_et"].startswith("2026-11-19T") and e["event_ts_et"][11:16] >= "09:00"}
for e in dtc_all:
    if e["dtc_reference"] in _shift:
        t = dt.datetime.fromisoformat(e["event_ts_et"]) - dt.timedelta(hours=3); e["event_ts_et"] = t.isoformat(timespec="seconds")
dtc_all = [e for e in dtc_all if not (e["event_ts_et"].startswith("2026-11-19T") and e["event_ts_et"][11:16] >= "09:00")]
_last, _instr = {}, {}
for e in sorted(dtc_all, key=lambda e: e["event_ts_et"]):
    _last[e["dtc_reference"]] = e
    if e["event"] == "INSTRUCTED": _instr[e["dtc_reference"]] = e["event_ts_et"]
for dv in gs_deliv:
    ref = dv["dtc_reference"]
    if ref in _instr and _instr[ref].startswith("2026-11-19"):
        last = _last[ref]
        dv["instructed_ts_utc"] = utc(dt.datetime.fromisoformat(_instr[ref]))
        dv["status"] = {"INSTRUCTED": "DELIVERED", "SETTLED": "SETTLED", "PENDING": "PENDING", "DK": "DK"}[last["event"]]
        dv["status_ts_utc"] = utc(dt.datetime.fromisoformat(last["event_ts_et"]))
for r in instr:
    if r["settlement_location"] == "FED" and r["status"] == "SENT_TO_DTC": r["status"] = "SENT_TO_FED"
instr.sort(key=lambda r: r["received_ts_et"]); gs_fails.sort(key=lambda r: r["opened_ts_utc"]); fails_bny.sort(key=lambda r: r["detected_ts_et"]); repair.sort(key=lambda r: r["opened_ts_et"]); dtc_all.sort(key=lambda r: r["event_ts_et"]); gs_trades.sort(key=lambda r: r["exec_ts_utc"])
write("bny", "client_accounts", client_accounts, ["account_id","client_legal_name","client_short_code","fund_name","account_type","base_currency","client_tier","relationship_manager","service_executive","status","opened_date"])
write("bny", "securities_master", securities, ["bny_sec_id","isin","cusip","ticker","issuer_name","asset_class","currency","primary_exchange","settlement_cycle","settlement_location","ref_price","id_source","status"])
write("bny", "ssi_counterparties", ssi_bny, ["ssi_id","counterparty_name","counterparty_lei","market","asset_class","depository","dtc_participant","agent_bic","effective_date","end_date","verified_by","verification_date","status"])
write("bny", "settlement_instructions", instr, ["instruction_id","received_ts_et","source_channel","client_account_id","client_ref","direction","isin","quantity","price","settlement_amount","currency","trade_date","settle_date","counterparty_name","cpty_dtc_participant","settlement_location","amends_instruction_id","status","status_ts_et"])
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
