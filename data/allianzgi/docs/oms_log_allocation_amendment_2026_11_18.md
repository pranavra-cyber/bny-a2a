# OMS Log - Allocation amendment 2026-11-18

*Synthetic data for an illustrative prototype. No real accounts, people or events.*

---

**System:** AllianzGI order management (synthetic) · **Order:** AGI-ORD-26-322-0773 · **Times:** CET

| Time | User | Event |
|---|---|---|
| 18.11.2026 14:31 | F. Becker | Order created: BUY 10,000 NVDA (US67066G1040), broker Goldman Sachs & Co. LLC |
| 18.11.2026 21:10 | system | Allocation ALC-26-322-0773-1 (AGI-GLEQ, 8,000) released to custodian BNY as MT541 |
| 18.11.2026 23:40 | F. Becker | Allocation amended to 10,000 (ALC-26-322-0773-2) after PM top-up |
| 18.11.2026 23:47 | system | Broker allocation re-sent to Goldman Sachs via CTM (10,000) |
| 18.11.2026 23:47 | system | Custodian instruction for ALC-26-322-0773-2 queued for second approval |
| 19.11.2026 00:30 | system | Approval queue closed for the night; custodian instruction **not released** |

*Note:* the broker side was updated and affirmed; the amended custodian instruction (MT541 to BNY) was never released, so BNY still holds the 8,000 instruction.
