-- Adds location identifier column for itinerary activities so maps can resolve POIs
alter table if exists public.plan_segments
  add column if not exists location_id text;

create index if not exists idx_plan_segments_location
  on public.plan_segments(location_id)
  where location_id is not null;
