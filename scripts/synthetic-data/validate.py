import csv,os,collections
B=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','data')
def L(f,t): return list(csv.DictReader(open(f"{B}/{f}/{t}.csv")))
T={(f,t[:-4]):L(f,t[:-4]) for f in os.listdir(B) if os.path.isdir(f'{B}/{f}') for t in os.listdir(f"{B}/{f}") if t.endswith('.csv')}
def uniq(k,col):
    c=collections.Counter(r[col] for r in T[k]); d=[x for x,n in c.items() if n>1]
    print(k,col,'dups:',d[:5])
uniq(('bny','settlement_instructions'),'instruction_id'); uniq(('bny','repair_queue'),'repair_id')
uniq(('goldman','trade_blotter'),'gs_trade_ref'); uniq(('goldman','allocations_confirms'),'alloc_id'); uniq(('goldman','deliveries'),'delivery_id')
uniq(('bny','fails_exceptions'),'exception_id'); uniq(('goldman','fails'),'gs_fail_id'); uniq(('allianzgi','orders'),'agi_order_id')
uniq(('bny','client_accounts'),'account_id')
ids={r['instruction_id'] for r in T[('bny','settlement_instructions')]}
print('repair orphan',[r['repair_id'] for r in T[('bny','repair_queue')] if r['instruction_id'] not in ids][:3])
accs={r['account_id'] for r in T[('bny','client_accounts')]}
print('instr acct orphan',sum(r['client_account_id'] not in accs for r in T[('bny','settlement_instructions')]))
isins={r['isin'] for r in T[('bny','securities_master')]}
print('isin orphan',sum(r['isin'] not in isins for r in T[('bny','settlement_instructions')]))
gsr={r['gs_trade_ref'] for r in T[('goldman','trade_blotter')]}
print('gs alloc orphan',sum(r['gs_trade_ref'] not in gsr for r in T[('goldman','allocations_confirms')]),'trades w/o alloc',len(gsr-{r['gs_trade_ref'] for r in T[('goldman','allocations_confirms')]}))
dl={r['delivery_id'] for r in T[('goldman','deliveries')]}
print('gs fail orphan',sum(r['delivery_id'] not in dl for r in T[('goldman','fails')]))
dtcref={r['dtc_reference'] for r in T[('dtc','settlement_activity')]}
print('deliv dtc orphan',sum(r['dtc_reference'] not in dtcref for r in T[('goldman','deliveries')]))
print('bny fail dtc orphan',sum(bool(r['dtc_reference']) and r['dtc_reference'] not in dtcref for r in T[('bny','fails_exceptions')]))
G=['BNYI-20261118-5527301','BNYI-20261118-5529944','RQ-20261118-0412','SSI-GS-US-EQ-0005','DTC-DO-20261119-000318','GS-FAIL-20261119-0091','GS-EQ-20261118-448213','CTM-77104562','AGI-ORD-26-322-0773','4471-AGI-GLEQ']
for g in G:
    hits=[k for k,rows in T.items() if any(g in v for r in rows for v in r.values())]
    print(g,hits)
print([r for r in T[('bny','positions')] if r['account_id']=='4471-AGI-GLEQ' and r['isin']=='US67066G1040'])
print('CTM dup', collections.Counter(r['ctm_confirm_id'] for r in T[('goldman','allocations_confirms')]).most_common(2))
print('dtc 000318 events',[ (r['event'],r['event_ts_et']) for r in T[('dtc','settlement_activity')] if r['dtc_reference']=='DTC-DO-20261119-000318'])
rq=T[('bny','repair_queue')]; de=[r for r in rq if r['routed_to']=='DIGITAL_EMPLOYEE']
print('repair total',len(rq),'DE resolved',sum(r['resolution']=='ENRICHED_FROM_REFDATA' for r in de), 'share',round(sum(r['resolution']=='ENRICHED_FROM_REFDATA' for r in de)/len(rq),2))
print('fail reasons',collections.Counter(r['fail_reason'] for r in T[('bny','fails_exceptions')]))
iq=T[('bny','client_inquiries')]; print('DISC share',round(sum(r['draft_by']=='DISC' for r in iq)/len(iq),2))
print('instr status',collections.Counter(r['status'] for r in T[('bny','settlement_instructions')]))
print('dtc ust', sum(1 for r in T[('dtc','settlement_activity')] if r['isin'].startswith('US91282')))
