-- Pre-DC records (one row per CSV row from pre_dc_notes_data.csv)
create table if not exists pre_dc_records (
  id             text primary key,
  imported_at    timestamptz not null default now(),
  fields         jsonb not null
);

-- Post-DC records (one row per CSV row from post_dc_notes_data.csv)
create table if not exists post_dc_records (
  id              text primary key,
  matched_call_id text,
  imported_at     timestamptz not null default now(),
  fields          jsonb not null
);

-- RLS: service role (FastAPI) bypasses RLS; anon has no access by default
alter table pre_dc_records  enable row level security;
alter table post_dc_records enable row level security;
