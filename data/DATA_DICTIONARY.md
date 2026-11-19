# DATA_DICTIONARY

*Synthetic data for an illustrative prototype. No real accounts, people or events.*

Every table in the synthetic data estate. Each table is one tab in a Google Sheet and exports to `/data/<firm>/<tab>.csv`. Dates are `YYYY-MM-DD` unless the format column says otherwise. Each firm uses its own time zone and timestamp format: BNY and DTC in US Eastern, Goldman Sachs in UTC, AllianzGI in Central European time with European date format. Local times follow the real zones, daylight saving included: the US is on EDT (UTC-4) until 1 Nov 2026 and Europe on CEST (UTC+2) until 25 Oct. Equity settlement amounts include $0.01/share commission (added for buyers, deducted for sellers); bond amounts are price × face / 100 with no commission. The data is a snapshot at 09:00 ET on 19 Nov 2026: nothing after it exists.

## bny/client_accounts

**Workbook:** BNY Client & Account Master · **Folder:** BNY/Custody Platform Extracts · **Imitates:** BNY custody client static data (account master) · **Rows:** 83

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| account_id | text, NNNN-CODE-SUFFIX | BNY account number, e.g. 4471-AGI-GLEQ | 3100-LTP-MAIN |
| client_legal_name | text | Client legal entity | Lakeshore Teachers' Pension Plan (synthetic) |
| client_short_code | text | Short code used across BNY tools, e.g. AGI | LTP |
| fund_name | text | Fund or portfolio held in the account | Lakeshore Teachers' Pension Plan Core Portfolio (synthetic) |
| account_type | enum | CUSTODY, CASH | CUSTODY |
| base_currency | ISO 4217 | USD, EUR | USD |
| client_tier | int 1-3 | 1 = highest service tier | 2 |
| relationship_manager | text | BNY RM (synthetic name) | P. Nair |
| service_executive | text | BNY service executive (synthetic name) | T. Haddad |
| status | enum | OPEN | OPEN |
| opened_date | date YYYY-MM-DD | Account opening date | 2017-05-27 |

## bny/securities_master

**Workbook:** BNY Reference Data · **Folder:** BNY/Custody Platform Extracts · **Imitates:** BNY securities master and standing settlement instruction (SSI) database · **Rows:** 146

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| bny_sec_id | text BNYSnnnnnn | BNY internal security id | BNYS000001 |
| isin | text 12 | ISIN | US67066G1040 |
| cusip | text 9 | CUSIP | 67066G104 |
| ticker | text | Exchange ticker; blank for bonds | NVDA |
| issuer_name | text | Issuer / description | NVIDIA Corp |
| asset_class | enum | EQUITY, ETF, UST, CORP_BOND | EQUITY |
| currency | ISO 4217 | USD | USD |
| primary_exchange | enum | NASDAQ, NYSE, OTC | NASDAQ |
| settlement_cycle | enum | T+1 (T+2 on one inactive legacy record) | T+1 |
| settlement_location | enum | DTC, FED (Treasuries settle on Fedwire) | DTC |
| ref_price | decimal | Reference price, USD (bonds per 100 face) | 186.25 |
| id_source | enum | public = real identifier of a listed security; synthetic = invented | public |
| status | enum | ACTIVE, INACTIVE | ACTIVE |

## bny/ssi_counterparties

**Workbook:** BNY Reference Data · **Folder:** BNY/Custody Platform Extracts · **Imitates:** BNY securities master and standing settlement instruction (SSI) database · **Rows:** 18

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| ssi_id | text SSI-XX-US-AC-PPPP | SSI record id | SSI-GS-US-EQ-0005 |
| counterparty_name | text | Broker-dealer | Goldman Sachs & Co. LLC |
| counterparty_lei | text 20 | LEI (synthetic) | 5493VQMLGW286LLGYZ19 |
| market | text | US | US |
| asset_class | enum | EQUITY, FIXED_INCOME | EQUITY |
| depository | text | DTC | DTC |
| dtc_participant | text 4 | Counterparty DTC participant number (0005 real for GS; others synthetic 71xx) | 0005 |
| agent_bic | text | Agent BIC (synthetic) | SYNGSUS33XXX |
| effective_date | date | Start of validity | 2024-06-01 |
| end_date | date | End of validity; blank if open | 2024-05-31 |
| verified_by | text | Analyst who verified the SSI | L. Park |
| verification_date | date | Date verified | 2026-02-14 |
| status | enum | ACTIVE, SUPERSEDED, PENDING_VERIFICATION | ACTIVE |

## bny/settlement_instructions

**Workbook:** BNY Settlement Instructions Log · **Folder:** BNY/Custody Platform Extracts · **Imitates:** BNY settlement instruction processing platform · **Rows:** 2258

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| instruction_id | text BNYI-YYYYMMDD-nnnnnnn | BNY instruction reference | BNYI-20261020-5500030 |
| received_ts_et | datetime ET YYYY-MM-DD HH:MM:SS | When BNY received the instruction | 2026-10-20 11:28:05 |
| source_channel | enum | SWIFT_MT541, SWIFT_MT543, CTM, PORTAL | PORTAL |
| client_account_id | text | FK client_accounts.account_id | 3192-TIG-EQTY |
| client_ref | text | Client's own reference (AGI order id for AllianzGI) | TIG-261020-4987 |
| direction | enum | RVP (receive vs payment, client buy), DVP (deliver vs payment, client sell) | DVP |
| isin | text | FK securities_master.isin | US1667641005 |
| quantity | number | Shares or face amount | 5000 |
| price | decimal | Trade price | 157.2 |
| settlement_amount | decimal USD | Net settlement amount, commission included for equities | 786000 |
| currency | ISO 4217 | USD | USD |
| trade_date | date | Trade date | 2026-10-20 |
| settle_date | date | Contractual settlement date | 2026-10-21 |
| counterparty_name | text | Executing broker | UBS Securities LLC |
| cpty_dtc_participant | text 4 | Counterparty DTC participant; blank when missing | 7106 |
| settlement_location | enum | DTC, FED | DTC |
| amends_instruction_id | text | Instruction this one amends; blank if new | BNYI-20261118-5527301 |
| dtc_reference | text DTC-DO-... | The DTC delivery this instruction settles against; blank until instructed at DTC (and for Fedwire) | DTC-DO-20261119-000318 |
| status | enum | RECEIVED, IN_REPAIR, ENRICHED, SENT_TO_DTC, SENT_TO_FED, MATCHED, SETTLED, PENDING_SETTLEMENT, CANCELLED | SETTLED |
| status_ts_et | datetime ET | Last status change | 2026-10-21 15:05:00 |

## bny/repair_queue

**Workbook:** BNY Instruction Repair Queue · **Folder:** BNY/Custody Platform Extracts · **Imitates:** BNY instruction repair workflow, incl. digital employee DE-REPAIR-01 · **Rows:** 143

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| repair_id | text RQ-YYYYMMDD-nnnn | Repair item id | RQ-20261020-0381 |
| instruction_id | text | FK settlement_instructions | BNYI-20261020-5500326 |
| opened_ts_et | datetime ET | When the item entered the queue | 2026-10-20 11:57:32 |
| repair_reason | enum | MISSING_SEC_ID, MISSING_CPTY_PARTICIPANT, QTY_PRICE_MISMATCH, INVALID_SSI, MISSING_SETTLE_DATE, DUPLICATE_SUSPECT | QTY_PRICE_MISMATCH |
| routed_to | enum | DIGITAL_EMPLOYEE (MISSING_SEC_ID only), HUMAN | HUMAN |
| priority_score | decimal 0-100 | From cutoff, value, client tier, exposure | 57.5 |
| cutoff_ts_et | datetime ET | Repair cutoff (14:30 ET on settle date) | 2026-10-21 14:30:00 |
| trade_value_usd | decimal | Settlement amount | 3374550 |
| assigned_to | text | DE-REPAIR-01 or analyst; blank if unassigned | O. Ahmadov |
| resolution | enum | ENRICHED_FROM_REFDATA, REJECTED_NO_REFDATA_MATCH, CORRECTED_PER_CLIENT, ENRICHED_FROM_SSI, CANCELLED_DUPLICATE, CONFIRMED_WITH_CLIENT; blank if open | CONFIRMED_WITH_CLIENT |
| resolved_ts_et | datetime ET | Blank if open | 2026-10-20 15:04:32 |
| verified_by | text | Second analyst (four-eyes) | R. Aboaba |
| comments | text | Free text by ops staff | confirmed with client ops by email |

## bny/positions

**Workbook:** BNY Safekeeping Positions · **Folder:** BNY/Custody Platform Extracts · **Imitates:** BNY safekeeping / positions system, end-of-day 2026-11-18 · **Rows:** 1671

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| as_of_date | date | Position date (EOD) | 2026-11-18 |
| account_id | text | FK client_accounts | 3100-LTP-MAIN |
| isin | text | FK securities_master | US91282CD731 |
| quantity | number | Settled position | 250000 |
| pending_receipts | number | Quantity due in from live receive instructions settling next day | 0 |
| pending_deliveries | number | Quantity due out | 0 |
| market_value_usd | decimal | quantity x ref_price | 252090.25 |

## bny/cash_ledger

**Workbook:** BNY Cash Ledger · **Folder:** BNY/Custody Platform Extracts · **Imitates:** BNY cash accounting ledger · **Rows:** 2143

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| entry_id | text CL-... | Ledger entry id | CL-20261020-5500030 |
| account_id | text | Cash account (AGC for AllianzGI) or custody account | 3192-TIG-EQTY |
| value_date | date | Value date | 2026-10-21 |
| amount | decimal | Signed: negative = debit | 786000 |
| currency | ISO 4217 | USD | USD |
| entry_type | enum | TRADE_SETTLEMENT | TRADE_SETTLEMENT |
| related_instruction_id | text | FK settlement_instructions | BNYI-20261020-5500030 |
| status | enum | POSTED | POSTED |

## bny/fails_exceptions

**Workbook:** BNY Fails & Exceptions Tracker · **Folder:** BNY/Custody Platform Extracts · **Imitates:** BNY fails and exceptions management tool · **Rows:** 90

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| exception_id | text EXC-YYYYMMDD-nnnn | Exception id | EXC-20261021-0881 |
| instruction_id | text | FK settlement_instructions | BNYI-20261020-5507143 |
| dtc_reference | text | FK DTC settlement_activity; blank for Fed | DTC-DO-20261021-000080 |
| detected_ts_et | datetime ET | Detected | 2026-10-21 09:24:00 |
| fail_reason | enum | LACK_OF_SECURITIES, SSI_MISMATCH, LATE_AFFIRMATION, DK_QTY_MISMATCH, ON_HOLD, CASH_SHORTFALL | CASH_SHORTFALL |
| counterparty_name | text | Broker | Morgan Stanley & Co. LLC |
| days_outstanding | int | Blank once resolved | 3 |
| status | enum | OPEN, RESOLVED | RESOLVED |
| owner | text | Analyst; blank if unassigned | O. Ahmadov |
| resolution_notes | text | Free text | client funded account, settled S+1 |

## bny/client_inquiries

**Workbook:** BNY Client Inquiries (DISC export) · **Folder:** BNY/Custody Platform Extracts · **Imitates:** BNY client inquiry case tool with DISC drafting · **Rows:** 537

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| inquiry_id | text INQ-YYYYMMDD-nnnnn | Inquiry id | INQ-20261020-00001 |
| received_ts_et | datetime ET | Received | 2026-10-20 15:09:00 |
| client_short_code | text | FK client short code | OE |
| channel | enum | EMAIL, PORTAL, PHONE | EMAIL |
| intent | enum | TRANSACTION_STATUS, CORP_ACTION, TAX, OTHER | TRANSACTION_STATUS |
| related_instruction_id | text | For status inquiries | BNYI-20261020-5504257 |
| draft_by | enum | DISC (AI draft, human reviewed), HUMAN | HUMAN |
| response_seconds | int | Time to draft reply (DISC ~25s, human ~90s) | 132 |
| reviewed_by | text | Analyst | R. Aboaba |
| status | enum | CLOSED | CLOSED |

## goldman/trade_blotter

**Workbook:** GS Equity Trade Blotter · **Folder:** Goldman Sachs/Ops Extracts · **Imitates:** Goldman Sachs US cash equities trade booking · **Rows:** 1888

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| gs_trade_ref | text GS-EQ-YYYYMMDD-nnnnnn | Goldman trade reference | GS-EQ-20261020-440893 |
| exec_ts_utc | datetime ISO 8601 Z | Execution time, UTC | 2026-10-20T14:02:02Z |
| client_name | text | Client (no custodian account ids here) | Allianz Global Investors GmbH |
| side | enum | GS side: BUY, SELL | SELL |
| client_side | enum | Client side: BUY, SELL | BUY |
| ticker | text | Ticker | JNJ |
| isin | text | ISIN | US4781601046 |
| quantity | number | Shares | 2500 |
| price | decimal | Price | 163.13 |
| gross_amount | decimal | quantity x price | 407825 |
| commission | decimal | Commission charged ($0.01/share on equities; 0 on bonds, booked on the US Credit desk) | 25 |
| trade_date | date | Trade date | 2026-10-20 |
| settle_date | date | Settlement date | 2026-10-21 |
| desk | text | Desk | High Touch |
| trader_id | text | Trader id | T4177 |
| status | enum | BOOKED | BOOKED |

## goldman/allocations_confirms

**Workbook:** GS Allocations & Confirms · **Folder:** Goldman Sachs/Ops Extracts · **Imitates:** Goldman Sachs allocation and CTM confirmation records · **Rows:** 1889

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| alloc_id | text AL-...-n | Allocation id | AL-20261020-440030-1 |
| gs_trade_ref | text | FK trade_blotter | GS-EQ-20261020-440030 |
| client_name | text | Client | Lakeshore Teachers' Pension Plan |
| client_account_ref | text | Client's reference (AGI order id) | LTP-261020-3936 |
| quantity | number | Allocated quantity | 500 |
| custodian_name | text | Client's custodian | The Bank of New York Mellon |
| custodian_dtc_participant | text 4 | Custodian participant (BNY 0901 real; others synthetic 72xx) | 0901 |
| ctm_confirm_id | text CTM-nnnnnnnn | CTM confirmation id; same id across versions | CTM-77100141 |
| affirmed | Y/N | Affirmed in CTM | Y |
| affirmed_ts_utc | datetime Z | Affirmation time | 2026-10-20T22:27:08Z |
| version | int | Allocation version | 1 |
| status | enum | AFFIRMED, PENDING_AFFIRMATION, SUPERSEDED | AFFIRMED |

## goldman/deliveries

**Workbook:** GS DTC Deliveries · **Folder:** Goldman Sachs/Ops Extracts · **Imitates:** Goldman Sachs DTC delivery instructions (participant 0005) · **Rows:** 1888

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| delivery_id | text DEL-... | Goldman delivery id; a block trade has one per allocation (DEL-...-1, -2) | DEL-20261020-440030 |
| gs_trade_ref | text | FK trade_blotter | GS-EQ-20261020-440030 |
| dtc_reference | text | Depository reference, shared with DTC and custodian | DTC-DO-20261021-000003 |
| from_participant | text 4 | Deliverer | 0901 |
| to_participant | text 4 | Receiver | 0005 |
| isin | text | ISIN | US1667641005 |
| quantity | number | Shares | 500 |
| settlement_amount | decimal | USD | 74970 |
| instructed_ts_utc | datetime Z | Instructed at DTC | 2026-10-21T14:56:00Z |
| status | enum | DELIVERED (instructed, awaiting), SETTLED, PENDING, DK | SETTLED |
| status_ts_utc | datetime Z | Last status | 2026-10-21T15:26:00Z |
| dk_reason | text | Reason given by receiver | QTY_MISMATCH |

## goldman/fails

**Workbook:** GS Fails Management · **Folder:** Goldman Sachs/Ops Extracts · **Imitates:** Goldman Sachs fails management queue · **Rows:** 70

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| gs_fail_id | text GS-FAIL-YYYYMMDD-nnnn | Fail id | GS-FAIL-20261021-0072 |
| delivery_id | text | FK deliveries | DEL-20261020-442397 |
| counterparty_custodian | text | Receiving / delivering custodian | Citibank NA (custody) |
| fail_reason | enum | When Goldman delivers: SHORT_INVENTORY, DK_BY_RECEIVER, HELD, CPTY_CASH. When it receives: CPTY_FAILED_TO_DELIVER, DK_ISSUED. Either: CPTY_SSI_MISMATCH, UNAFFIRMED. next_action follows the reason | DK_BY_RECEIVER |
| opened_ts_utc | datetime Z | Opened | 2026-10-21T13:09:00Z |
| age_days | int | Days since settle date | 29 |
| exposure_usd | decimal | Value | 1161025 |
| owner | text | Desk queue; blank if unassigned | fails-desk-2 |
| next_action | text | Planned action | borrow |
| status | enum | OPEN, CLOSED | CLOSED |

## goldman/inventory

**Workbook:** GS Box & Inventory · **Folder:** Goldman Sachs/Ops Extracts · **Imitates:** Goldman Sachs box / inventory position at DTC · **Rows:** 42

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| as_of_date | date | Snapshot date | 2026-11-19 |
| isin | text | ISIN | US67066G1040 |
| box_location | text | DTC-0005 | DTC-0005 |
| quantity_available | number | Free to deliver | 412500 |
| quantity_pledged | number | Pledged | 33267 |
| quantity_on_loan | number | Lent out | 56522 |

## goldman/ssi_book

**Workbook:** GS Counterparty SSI Book · **Folder:** Goldman Sachs/Ops Extracts · **Imitates:** Goldman Sachs client and custodian SSI book · **Rows:** 52

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| ssi_ref | text GSSSI-nnnnn | Goldman SSI id | GSSSI-00001 |
| custodian_name | text | Client's custodian | Citibank NA (custody) |
| client_name | text | Client | Aldgate Investments |
| market | text | US | US |
| dtc_participant | text 4 | Custodian participant | 7203 |
| effective_date | date | From | 2025-01-15 |
| status | enum | ACTIVE | ACTIVE |

## goldman/stock_loan

**Workbook:** GS Stock Loan & Borrow · **Folder:** Goldman Sachs/Ops Extracts · **Imitates:** Goldman Sachs securities lending and borrowing book · **Rows:** 160

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| loan_id | text SL-... | Loan id | SL-202600001 |
| isin | text | ISIN | US4581401001 |
| quantity | number | Shares | 10000 |
| counterparty | text | Lender/borrower | Stonebridge Retirement |
| direction | enum | LEND, BORROW | LEND |
| start_date | date | Start | 2026-10-23 |
| recall_status | enum | NONE, RECALLED, RECALL_PENDING | RECALL_PENDING |

## dtc/settlement_activity

**Workbook:** DTC Settlement Activity Feed · **Folder:** DTC · **Imitates:** DTC settlement event feed (DVP deliveries, both participants' view) · **Rows:** 6504

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| dtc_reference | text DTC-DO-YYYYMMDD-nnnnnn | Depository delivery reference (one per delivery, several events) | DTC-DO-20261021-000017 |
| event_ts_et | datetime ISO 8601 with -05:00 | Event time, ET | 2026-10-21T06:01:00-05:00 |
| deliverer_participant | text 4 | FK participants | 0901 |
| receiver_participant | text 4 | FK participants | 7106 |
| isin | text | ISIN | US88160R1014 |
| quantity | number | Shares / face | 7500 |
| settlement_amount | decimal | USD | 1847325 |
| transaction_type | enum | DVP | DVP |
| event | enum | INSTRUCTED, SETTLED, PENDING, DK | INSTRUCTED |
| reason_code | enum | DK: QTY_MISMATCH, SSI_MISMATCH. PENDING: INSUFFICIENT_POSITION, UNAFFIRMED, HOLD, NET_DEBIT_CAP. Blank otherwise. A DK'd delivery is redelivered under the same reference (a second INSTRUCTED, then SETTLED) | INSUFFICIENT_POSITION |

## dtc/participants

**Workbook:** DTC Participant Directory · **Folder:** DTC · **Imitates:** DTC participant directory · **Rows:** 14

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| participant_number | text 4 | DTC participant number (0901, 0005 real; others synthetic) | 0901 |
| participant_name | text | Firm | The Bank of New York Mellon |
| type | enum | CUSTODIAN, BROKER_DEALER | CUSTODIAN |
| id_source | enum | public, synthetic | public |
| status | enum | ACTIVE, INACTIVE | ACTIVE |

## allianzgi/orders

**Workbook:** AGI OMS Orders Export · **Folder:** Allianz Global Investors · **Imitates:** AllianzGI order management system · **Rows:** 371

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| agi_order_id | text AGI-ORD-YY-DDD-nnnn | OMS order id (DDD = day of year) | AGI-ORD-26-293-0013 |
| created_ts_cet | datetime DD.MM.YYYY HH:MM CET | Order created | 20.10.2026 15:20 |
| portfolio_manager | text | PM (synthetic) | C. Rossi |
| fund_code | text | FK funds, or BLOCK for one order across several funds (split in allocations) | AGI-INCO |
| side | enum | BUY, SELL | SELL |
| isin | text | ISIN | US1912161007 |
| quantity | number | Order quantity | 5000 |
| limit_price | decimal | Limit | 72.72 |
| broker | text | FK broker_list | Goldman Sachs & Co. LLC |
| status | enum | FILLED | FILLED |

## allianzgi/allocations

**Workbook:** AGI Allocations · **Folder:** Allianz Global Investors · **Imitates:** AllianzGI OMS allocations to custodians · **Rows:** 371

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| allocation_id | text ALC-...-v | Allocation id; suffix is version | ALC-26-293-0013-1 |
| agi_order_id | text | FK orders | AGI-ORD-26-293-0013 |
| fund_code | text | FK funds | AGI-INCO |
| quantity | number | Allocated quantity | 5000 |
| version | int | 1 = original | 1 |
| amended_ts_cet | datetime CET | Blank unless amended | 18.11.2026 23:40 |
| custodian | text | BNY | BNY |
| sent_to_custodian_ts_cet | datetime CET | When the allocation reached the custodian feed | 20.10.2026 21:56 |
| status | enum | SENT, SUPERSEDED | SENT |

## allianzgi/funds

**Workbook:** AGI Fund List · **Folder:** Allianz Global Investors · **Imitates:** AllianzGI fund static data · **Rows:** 8

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| fund_code | text | AGI-XXXX | AGI-GLEQ |
| fund_name | text | Fund name (synthetic) | AllianzGI Global Equity Fund (synthetic) |
| domicile | ISO country | LU, DE, UK | LU |
| custodian | text | BNY | BNY |
| base_currency | ISO 4217 | USD, EUR | EUR |

## allianzgi/broker_list

**Workbook:** AGI Approved Broker List · **Folder:** Allianz Global Investors · **Imitates:** AllianzGI approved broker list · **Rows:** 8

| Column | Type / format | Description and allowed values | Example |
|---|---|---|---|
| broker_name | text | Broker legal name | Goldman Sachs & Co. LLC |
| broker_lei | text | LEI (synthetic) | 5493VQMLGW286LLGYZ19 |
| approved_markets | text | Semicolon list | US;EU;UK |
| status | enum | APPROVED | APPROVED |
