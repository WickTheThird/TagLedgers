# TagLedger

Tag-based financial reconciliation tool. Upload bank transaction Excel files, classify with tags, filter by any criteria, and generate P&L reports grouped by company/account.

## Features

- Google OAuth login with email allowlist
- Google Drive integration (read/upload Excel files via service account)
- Tag-based transaction classification and aggregation
- Grafana-style filter bar (date, account, tag, type, search)
- Sortable transaction table with inline tag editing
- Resizable tag summary panel with totals
- P&L view grouped by company/account
- DB Ledger tracking via Google Sheets

## Stack

- SvelteKit + TypeScript
- TailwindCSS
- Google Drive API + Sheets API (service account)
- SheetJS (xlsx parsing)

## Setup

```sh
npm install
cp .env.example .env
# Fill in .env with your Google Cloud credentials
npm run dev
```

See `.env.example` for required configuration.

## License

Proprietary. See [LICENSE](LICENSE).
