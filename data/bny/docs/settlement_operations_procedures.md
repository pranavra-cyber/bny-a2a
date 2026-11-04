# Settlement Operations Procedures

*Synthetic data for an illustrative prototype. No real accounts, people or events.*

**Owner:** US Securities Settlement Operations (synthetic) · **Version:** 4.2 · **Last reviewed:** 2026-09-30 · **Applies to:** US equity and fixed income settlement via DTC and Fedwire

## 1. Instruction lifecycle

| Stage | System status | What happens |
|---|---|---|
| Receipt | RECEIVED | Instruction arrives by SWIFT MT540-543, CTM or the client portal. It is stamped with a received time (ET) and given a BNYI reference. |
| Validation | VALIDATED or IN_REPAIR | Mandatory fields are checked against reference data: ISIN, account, settlement date, counterparty and its DTC participant, SSI. Any failure routes the instruction to the Repair Queue. |
| Enrichment | ENRICHED | Missing optional data (place of settlement, agent BIC) is filled from the SSI database. |
| Release | SENT_TO_DTC / SENT_TO_FED | The instruction is released to the depository. Equities and corporate bonds go to DTC; US Treasuries go to Fedwire Securities. |
| Matching | MATCHED | The counterparty's delivery is matched against our receipt instruction on ISIN, quantity, amount, settlement date and participant. |
| Settlement | SETTLED | Securities and cash move. Positions and the cash ledger are posted. |
| Exception | PENDING_SETTLEMENT | Not settled by end of settlement date. An exception is opened in the Fails & Exceptions Tracker. |

An amendment from the client arrives as a new instruction that references the one it replaces (`amends_instruction_id`). **The original is not cancelled until the amendment has passed validation.** Until then, the original remains live at the depository.

## 2. Matching and DKs

1. DTC compares the deliverer's instruction with ours. Any difference in quantity, amount or settlement date means the delivery is not matched.
2. A delivery we cannot match is **DK'd** ("don't know") by our receiving system. DKs are automatic for quantity and amount breaks above tolerance (0 shares; USD 25.00 on amount).
3. Every DK opens an exception with reason `DK_QTY_MISMATCH` or `DK_AMT_MISMATCH` and the DTC reference.
4. The analyst must find out which side is right before contacting the counterparty. Check, in order: the client's latest allocation, any open repair item for the same client reference, and the client inquiry log.

## 3. Cutoffs (ET)

| Item | Cutoff |
|---|---|
| Client instructions for same-day (S) DVP settlement | 11:30 |
| Repair items for S settlement | 14:30 |
| DTC DVP processing ends | 15:10 |
| Fedwire Securities | 15:15 |
| Late-instruction exception approval (manager) | 14:45 |

## 4. Prioritization

The repair and exception queues are ordered by a priority score (0-100). Inputs, highest weight first:

1. Minutes to the applicable cutoff.
2. Trade value (USD).
3. Client tier (1 = top).
4. Market exposure: whether the item blocks a delivery that a counterparty has already instructed.

Analysts may re-prioritize manually but must leave a comment.

## 5. Four-eyes rule

**Every manual repair is verified by a second person before release.** The analyst who made the change cannot verify it. This also applies to items enriched by the repair digital employee: the analyst on rotation reviews and releases them.

## 6. Escalation

| Condition | Escalate to |
|---|---|
| Item over USD 1 million within 2 hours of cutoff | Team lead |
| Tier 1 client item at risk of missing cutoff | Team lead and Service Executive |
| Counterparty unresponsive for 60 minutes on a DK | Team lead; open a call with counterparty fails desk |
| Any item likely to fail overnight | Daily fails call (15:30) |

## 7. Contacts (synthetic)

- Settlement Ops team lead: ops.lead@example-bny.test
- Repair queue rotation: repair.rotation@example-bny.test
- AllianzGI service team: agi.service@example-bny.test
