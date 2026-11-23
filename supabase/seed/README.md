# Trigger Desk seed files

Not run automatically. Apply by hand (Supabase SQL editor or `psql`) only after the
`20261124120000_trigger_desk_screens` migration is live and Tom has said go.

- `rep_card_to_sql.py` turns the 🎯 rep-card callouts at the top of the Notion CRM records
  into `rep_cards` upserts, matched to `trigger_events` by `notion_page_id`.
- `rep_cards_input_2026-11-23.json` / `rep_cards_2026-11-23.sql`: worked example (Joe Levy).

On switch day, re-pull every Ready-to-send card from Notion (send orders changed on
Nov 23 when Kwik Lok and EchoNous were closed out, so the Nov 17 cards are stale), save
them in the same JSON shape, and regenerate:

    python -I rep_card_to_sql.py cards.json > rep_cards_<date>.sql
