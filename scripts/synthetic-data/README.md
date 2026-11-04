# Synthetic data generator

Generates the CSVs in `/data` for the A2A settlement prototype.

```sh
python3 generate.py
```

This regenerates every `/data/<firm>/<table>.csv` identically (fixed seed `20261119`; standard library only). The markdown docs (`/data/*/docs/*.md`, `/data/README.md`, `/data/DATA_DICTIONARY.md`) are not produced by the generator.

Other scripts:

- `validate.py`: quick sanity report on the CSVs in `/data` (duplicates, orphans, golden-case hits).
- `build.py`: builds the Google Drive xlsx workbooks and a `DATA_DICTIONARY.md` into `out/` (needs `openpyxl`). It does not write to `/data`.

To change the data, edit `generate.py` and rerun it. Never edit `/data` by hand. Run `npm run data:check` afterwards.
