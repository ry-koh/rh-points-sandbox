# RH Hall Points Sandbox

Offline what-if tool for Raffles Hall AY26-27 points (68th JCRC). JCRC loads every
vetted CCA leader CSV plus its own data, adjusts every multiplier and bonus, and gets
five lists: male staying, male bidding, female staying, female bidding, sem-2 bidding.

## Confidentiality (non-negotiable)
- Fully offline: no network calls, analytics or CDN assets. Files are loaded via the file picker.
- Nothing leaves the machine except files the user explicitly exports.
- Never commit real resident data. Real files go in `data/` (gitignored); only synthetic
  data belongs in `samples/`.
- Scenario JSON holds settings only, never resident data.

## Docs
- [Points spec](docs/points-spec.md) — authoritative rules, formulas, file formats and worked examples.
