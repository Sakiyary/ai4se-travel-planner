with upsert_user as (
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'demo@example.com',
    crypt('DemoPass123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    updated_at = now()
  returning id, email
)
insert into public.profiles (id, email, display_name)
select
  id,
  email,
  'Demo User'
from upsert_user
on conflict (id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  updated_at = now();

insert into public.plans (id, user_id, title, destination, start_date, end_date, party_size, budget)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Demo Trip', 'Shanghai', '2025-11-01', '2025-11-05', 2, 5000)
on conflict (id) do update set
  title = excluded.title,
  destination = excluded.destination,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  party_size = excluded.party_size,
  budget = excluded.budget,
  updated_at = now();

insert into public.plan_segments (id, plan_id, day_index, time_slot, activity_type, details)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'morning', 'sightseeing', '{"title": "The Bund Walk", "notes": "Enjoy skyline"}'::jsonb)
on conflict (id) do update set
  day_index = excluded.day_index,
  time_slot = excluded.time_slot,
  activity_type = excluded.activity_type,
  details = excluded.details;

insert into public.expenses (id, plan_id, amount, currency, category, method, source, notes)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 250, 'CNY', 'Food', 'Card', 'manual', 'Brunch at Yuyuan')
on conflict (id) do update set
  amount = excluded.amount,
  currency = excluded.currency,
  category = excluded.category,
  method = excluded.method,
  source = excluded.source,
  notes = excluded.notes;

insert into public.voice_notes (id, plan_id, storage_path, transcript, duration_seconds)
values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'voice-notes/demo-note.wav', 'Remember to book hotel near People''s Square', 32)
on conflict (id) do update set
  storage_path = excluded.storage_path,
  transcript = excluded.transcript,
  duration_seconds = excluded.duration_seconds;
