# Repair Queue Runbook

*Synthetic data for an illustrative prototype. No real accounts, people or events.*

**Owner:** Instruction Repair team (synthetic) · **Version:** 2.7 · **Last reviewed:** 2026-10-15

## 1. Purpose

Instructions that fail validation land in the Repair Queue. The goal is to fix each item correctly before its cutoff (14:30 ET for same-day settlement) and to never guess.

## 2. Repair reasons

| repair_reason | Meaning | Handled by | Typical fix |
|---|---|---|---|
| MISSING_SEC_ID | ISIN/CUSIP missing or not found in the securities master | **Digital employee DE-REPAIR-01**, then human verification | Look up by ticker, description or alternate ID in reference data |
| MISSING_CPTY_PARTICIPANT | Counterparty DTC participant number blank | Human | Confirm with SSI database **and** with the counterparty or client; never infer from name alone |
| QTY_PRICE_MISMATCH | Quantity or price does not match the confirm | Human | Confirm with client; check for an amendment |
| INVALID_SSI | SSI expired, superseded or pending verification | Human | Use the active verified SSI; if none, call the counterparty on a known number |
| MISSING_SETTLE_DATE | Settlement date blank or a holiday | Human | Default T+1 only with client confirmation |
| DUPLICATE_SUSPECT | Same client ref, ISIN and quantity as a live instruction | Human | Confirm with client which to keep; cancel the other |

## 3. Digital employee scope (DE-REPAIR-01)

- Works **only** on `MISSING_SEC_ID`.
- Resolves an item only when reference data gives exactly one active match. Records the resolution as `ENRICHED_FROM_REFDATA`.
- **Rejects rather than guesses.** No match, or more than one match, gives `REJECTED_NO_REFDATA_MATCH` and the item goes back to the human queue.
- In the last quarter it resolved about one in five repair items overall.
- A person always verifies its work before release (four-eyes rule).

## 4. Working an item

1. Open the oldest item with the highest priority score.
2. Read the full instruction and any linked instruction (`amends_instruction_id`).
3. Check the client's other open items, the inquiry log, and the Ops chat for context.
4. Make the fix. Write a comment saying what you changed and where the data came from.
5. Hand to a second analyst for verification. Only the verifier releases.

## 5. Known traps

- **Superseded SSIs.** The SSI table keeps old records with `status = SUPERSEDED`. Goldman Sachs has one (participant 7108, ended 2024-05-31). Use only `ACTIVE` records.
- **Amendments that arrive after hours.** An amendment received after 18:00 ET sits in the queue overnight while the original instruction stays live at DTC. Check for this before the 08:00 depository cycle.
- **Same security, same day, different client.** Do not match a counterparty delivery to another client's instruction just because the ISIN and quantity look right.
