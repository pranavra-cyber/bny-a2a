# Fails Desk Procedures

*Synthetic data for an illustrative prototype. No real accounts, people or events.*

**Owner:** US Equity Fails Management, Goldman Sachs Operations (synthetic) · **Version:** 3.1 · **Last reviewed:** 2026-08-12 · **Times:** UTC unless stated

## 1. Scope

Deliveries from Goldman Sachs & Co. LLC (DTC participant 0005) to client custodians that do not settle as instructed: DKs, pending deliveries for lack of inventory, unaffirmed trades and SSI mismatches.

## 2. Fail reasons

| fail_reason | Meaning | First action |
|---|---|---|
| DK_BY_RECEIVER | Receiving custodian rejected our delivery | Contact the receiving custodian |
| SHORT_INVENTORY | Not enough shares in the box to deliver | Check inventory and recalls; request borrow |
| CPTY_SSI_MISMATCH | Our SSI for the client does not match the custodian's | Confirm SSI with custodian and client |
| UNAFFIRMED | Client has not affirmed in CTM | Chase client middle office |
| HELD | Delivery held by us (credit or compliance) | Escalate internally |
| CPTY_CASH | Receiver lacked cash or collateral | Contact custodian |

## 3. Working a DK

1. Compare our delivery with the affirmed allocation in CTM. If quantity, price and settlement date match the affirmed allocation, our side is correct.
2. **Contact the receiving custodian's settlement operations** to find out why they DK'd and whether they will accept a redelivery. Most DKs come from an amendment the custodian has not processed.
3. Use the custodian contact list. If the list has no current contact, use the custodian's published client service line. Record who you spoke to.
4. Agree the redelivery: same quantity, or a split if the custodian can only take part today. Re-instruct at DTC.
5. Note every contact in the fail record. Close it only when DTC shows SETTLED.

## 4. Aging and escalation

| Age | Action |
|---|---|
| Same day, over USD 1m | Desk lead informed by 15:00 UTC |
| 1 day | Client coverage informed; CSDR-style penalty and buy-in exposure assessed |
| 3 days | Head of fails; borrow or buy-in decision |
| 5+ days | Escalation to regional ops management |

## 5. Contacts (synthetic)

- Fails desk shared mailbox: us.eq.fails@example-gs.test
- Desk lead: fails.lead@example-gs.test
