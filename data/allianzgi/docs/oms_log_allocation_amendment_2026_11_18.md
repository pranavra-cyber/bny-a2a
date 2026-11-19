# OMS Log - Allocation amendment 2026-11-18

*Synthetic data for an illustrative prototype. No real accounts, people or events.*

---

**System:** AllianzGI order management (synthetic) · **Order:** AGI-ORD-26-322-0773 · **Times:** CET

| Time | User | Event |
|---|---|---|
| 18.11.2026 14:31 | F. Becker | Order created: BUY 8,000 NVDA (US67066G1040), fund AGI-GLEQ, broker Goldman Sachs & Co. LLC, limit 187.00 |
| 18.11.2026 20:40 | F. Becker | Order quantity increased to 10,000 (PM top-up) |
| 18.11.2026 20:52 | system | Filled: 10,000 @ 186.25 by Goldman Sachs |
| 18.11.2026 20:58 | system | Allocation ALC-26-322-0773-1 (AGI-GLEQ, **8,000**, built from the original order quantity) released to custodian BNY as MT541 |
| 18.11.2026 21:03 | system | CTM: Goldman confirm CTM-77104562 for 10,000 does not match allocation (8,000); unmatched |
| 18.11.2026 23:40 | E. Carter | Allocation amended to 10,000 (ALC-26-322-0773-2) to match the fill |
| 18.11.2026 23:47 | system | Broker allocation re-sent to Goldman Sachs via CTM (10,000) |
| 18.11.2026 23:47 | system | Custodian instruction for ALC-26-322-0773-2 queued for second approval |
| 18.11.2026 23:52 | E. Carter | CTM-77104562 affirmed at 10,000 |
| 19.11.2026 00:30 | system | Approval queue closed for the night; custodian instruction **not released** |

*Note:* the top-up was in the order before Goldman filled it, but the allocation went out at the old 8,000. The broker side was corrected and affirmed that night; the amended custodian instruction (MT541 to BNY) was never released, so BNY still holds the 8,000 instruction.
