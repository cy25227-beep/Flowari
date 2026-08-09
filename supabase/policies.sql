-- Run this after the tables have been created and RLS is enabled.
-- The share URL's group UUID is sent in the standard x-client-info header by the app.

create or replace function public.flowari_group_id()
returns uuid
language sql stable
as $$
  select nullif(regexp_replace(current_setting('request.headers', true)::json->>'x-client-info', '^flowari-group/', ''), '')::uuid
$$;

create policy "flowari group access" on public.groups
  for all to anon, authenticated
  using (id = public.flowari_group_id())
  with check (id = public.flowari_group_id());

create policy "flowari member access" on public.members
  for all to anon, authenticated
  using (group_id = public.flowari_group_id())
  with check (group_id = public.flowari_group_id());

create policy "flowari expense access" on public.expenses
  for all to anon, authenticated
  using (group_id = public.flowari_group_id())
  with check (group_id = public.flowari_group_id());

create policy "flowari payment access" on public.payments
  for all to anon, authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id and e.group_id = public.flowari_group_id()))
  with check (exists (select 1 from public.expenses e where e.id = expense_id and e.group_id = public.flowari_group_id()));

alter publication supabase_realtime add table public.expenses;
