-- Ensure voice_notes table allows owners to insert/update rows while keeping RLS protections

alter table public.voice_notes enable row level security;

drop policy if exists "Voice notes: owner access" on public.voice_notes;

create policy "Voice notes: owner read" on public.voice_notes
  for select using (
    exists (
      select 1 from public.plans p
      where p.id = voice_notes.plan_id and p.user_id = auth.uid()
    )
  );

create policy "Voice notes: owner mutate" on public.voice_notes
  for all using (
    exists (
      select 1 from public.plans p
      where p.id = voice_notes.plan_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.plans p
      where p.id = voice_notes.plan_id and p.user_id = auth.uid()
    )
  );
