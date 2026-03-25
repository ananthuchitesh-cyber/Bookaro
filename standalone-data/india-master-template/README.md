India Master Data Template

These files are standalone templates for building all-India travel budget and transport data.
They are not connected to the app backend.

Files

- `india_state_master.csv`: one row per state or union territory
- `india_city_district_hubs.csv`: important hubs inside each state
- `india_interstate_transport_matrix.csv`: hub-to-hub transport options between states
- `india_budget_rules.csv`: state-level daily budget rules

Recommended workflow

1. Fill `india_state_master.csv` first.
2. Add 2-5 main hubs per state in `india_city_district_hubs.csv`.
3. Add interstate routes only between major hubs first.
4. Fill `india_budget_rules.csv` with budget, comfort, and luxury ranges.
5. Expand route coverage only after the core hubs are complete.

How to keep this manageable

- Do not create district-to-district routes for the whole country.
- First connect district -> nearest hub inside the state.
- Then connect hub -> hub across states.
- Let the app later combine local + interstate segments.

Suggested budget logic

- `budget_total = travel_cost + (hotel_budget + food_budget + local_transport_budget + sightseeing_buffer) * days`
- Keep one budget row per state and revise later for premium cities if needed.

Suggested transport logic

- Add one row per route and mode.
- Example: Chennai -> Bengaluru can have separate rows for bus, train, flight, and taxi.
- Use ranges for fares where prices fluctuate.

Status

These are starter templates only. They are safe to edit without affecting the backend.
