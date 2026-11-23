-- Trigger Desk screens: rep cards, more touch types, and the Today list view.
--
--   rep_cards       one short card per trigger event (what a rep needs, ~200 words)
--   outreach_touches gains the Moment Play touches: card mailed, call, LinkedIn note
--   trigger_today   (view) one row per action that is due, for the Today screen
--
-- Moment Play cadence (launch plan, Nov 22, 2026), counted from the Email 1 date:
--   day 0 email 1 + LinkedIn connect, day 2 email 2, day 3 card, day 5 email 3,
--   day 7 call, day 14 LinkedIn closing note. A reply stops the sequence.

begin;

-- ---------------------------------------------------------------- rep_cards
create table public.rep_cards (
  id                bigint generated always as identity primary key,
  client_id         bigint not null references public.clients(id),
  trigger_event_id  bigint not null unique references public.trigger_events(id) on delete cascade,
  contact_id        bigint references public.contacts(id) on delete cascade,
  header            text check (char_length(header) <= 1200),
  go_call           text check (char_length(go_call) <= 1200),
  why_now           text check (char_length(why_now) <= 1200),
  know              text check (char_length(know) <= 1200),
  say               text check (char_length(say) <= 1200),
  watch_out         text check (char_length(watch_out) <= 1200),
  contact_clock     text check (char_length(contact_clock) <= 1200),
  open_before_send  text check (char_length(open_before_send) <= 1200),
  checked_on        date,
  sales_id          bigint references public.sales(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index rep_cards_contact_idx on public.rep_cards (contact_id);

create trigger rep_cards_updated_at before update on public.rep_cards
  for each row execute function public.touch_updated_at();
create trigger set_rep_cards_sales_id before insert on public.rep_cards
  for each row execute function public.set_sales_id_default();

alter table public.rep_cards enable row level security;
create policy "rep_cards read"   on public.rep_cards for select to authenticated using (true);
create policy "rep_cards insert" on public.rep_cards for insert to authenticated with check (true);
create policy "rep_cards update" on public.rep_cards for update to authenticated using (true) with check (true);
create policy "rep_cards delete" on public.rep_cards for delete to authenticated using (true);

-- ---------------------------------------------------------------- outreach_touches: Moment Play touches
alter table public.outreach_touches drop constraint outreach_touches_channel_check;
alter table public.outreach_touches add constraint outreach_touches_channel_check
  check (channel in ('email','linkedin','phone','mail','other'));

alter table public.outreach_touches drop constraint outreach_touches_touch_check;
alter table public.outreach_touches add constraint outreach_touches_touch_check
  check (touch in ('email_1','email_2','email_3','linkedin_connect','linkedin_note',
                   'card_mailed','call','reply_sent','other'));

-- ---------------------------------------------------------------- trigger_today view
-- One row per due action. `id` is a stable text key (event id + kind) for the app.
create view public.trigger_today with (security_invoker = on) as
with ev as (
  select
    te.id               as trigger_event_id,
    te.contact_id,
    te.company_id,
    te.stage,
    te.send_order,
    te.next_action,
    te.next_action_date,
    te.window_status,
    te.day_count,
    trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')) as contact_name,
    co.name             as company_name,
    t.email_1, t.email_2, t.email_3, t.card_mailed, t.call, t.linkedin_note
  from public.trigger_events_live te
  left join public.contacts  c  on c.id  = te.contact_id
  left join public.companies co on co.id = te.company_id
  left join lateral (
    select
      min(ot.touched_on) filter (where ot.touch = 'email_1')       as email_1,
      min(ot.touched_on) filter (where ot.touch = 'email_2')       as email_2,
      min(ot.touched_on) filter (where ot.touch = 'email_3')       as email_3,
      min(ot.touched_on) filter (where ot.touch = 'card_mailed')   as card_mailed,
      min(ot.touched_on) filter (where ot.touch = 'call')          as call,
      min(ot.touched_on) filter (where ot.touch = 'linkedin_note') as linkedin_note
    from public.outreach_touches ot
    where ot.trigger_event_id = te.id
       or (ot.trigger_event_id is null and ot.contact_id = te.contact_id)
  ) t on true
),
actions as (
  -- Email 1 for everything ready to send (Send Order decides the order)
  select ev.*, 'send_email_1'::text as kind, 'Send email 1 + LinkedIn connect'::text as label,
         current_date as due_date, 10 as sort_rank
  from ev where ev.stage = 'ready_to_send' and ev.email_1 is null

  -- Moment Play steps, counted from the Email 1 date, while the sequence is live
  union all
  select ev.*, 'email_2', 'Send email 2', ev.email_1 + 2, 20
  from ev where ev.email_1 is not null and ev.email_2 is null and ev.stage in ('ready_to_send','in_sequence')
  union all
  select ev.*, 'card_mailed', 'Mail the 5x7 card', ev.email_1 + 3, 30
  from ev where ev.email_1 is not null and ev.card_mailed is null and ev.stage in ('ready_to_send','in_sequence')
  union all
  select ev.*, 'email_3', 'Send email 3', ev.email_1 + 5, 40
  from ev where ev.email_1 is not null and ev.email_3 is null and ev.stage in ('ready_to_send','in_sequence')
  union all
  select ev.*, 'call', 'Make the call', ev.email_1 + 7, 50
  from ev where ev.email_1 is not null and ev.call is null and ev.stage in ('ready_to_send','in_sequence')
  union all
  select ev.*, 'linkedin_note', 'LinkedIn closing note', ev.email_1 + 14, 60
  from ev where ev.email_1 is not null and ev.linkedin_note is null and ev.stage in ('ready_to_send','in_sequence')

  -- A reply: answer the same day
  union all
  select ev.*, 'reply', 'Answer the reply today', current_date, 0
  from ev where ev.stage = 'replied'

  -- Write window running out
  union all
  select ev.*, 'expiring', 'Write window expiring (day ' || ev.day_count || ')', current_date, 70
  from ev where ev.window_status = 'expiring' and ev.stage not in ('closed_out','replied','meeting_set','opportunity')

  -- Whatever Next Action Date says, within the coming week
  union all
  select ev.*, 'next_action', coalesce(nullif(left(ev.next_action, 140), ''), 'Next action'), ev.next_action_date, 80
  from ev where ev.next_action_date is not null and ev.next_action_date <= current_date + 7
               and ev.stage <> 'closed_out'
               -- a Pass waiting for email 1 already has its row above
               and not (ev.stage = 'ready_to_send' and ev.email_1 is null)
)
select
  a.trigger_event_id || ':' || a.kind as id,
  a.trigger_event_id,
  a.contact_id,
  a.company_id,
  a.contact_name,
  a.company_name,
  a.stage,
  a.send_order,
  a.window_status,
  a.day_count,
  a.kind,
  a.label,
  a.due_date,
  (a.due_date < current_date) as overdue,
  a.sort_rank
from actions a;

-- ---------------------------------------------------------------- companies_summary: watchlist columns
-- The app lists companies through this view. It was built before the watchlist columns existed,
-- so add them at the end (CREATE OR REPLACE keeps existing columns and grants).
create or replace view public.companies_summary with (security_invoker = on) as
select
    c.id,
    c.created_at,
    c.name,
    c.sector,
    c.size,
    c.linkedin_url,
    c.website,
    c.phone_number,
    c.address,
    c.zipcode,
    c.city,
    c.state_abbr,
    c.sales_id,
    c.context_links,
    c.country,
    c.description,
    c.revenue,
    c.tax_identifier,
    c.logo,
    count(distinct d.id) as nb_deals,
    count(distinct co.id) as nb_contacts,
    c.client_id,
    c.segment,
    c.sub_sector,
    c.size_band,
    c.employees,
    c.ownership,
    c.watch_status
from public.companies c
    left join public.deals d on c.id = d.company_id
    left join public.contacts co on c.id = co.company_id
group by c.id;

-- ---------------------------------------------------------------- grants
-- Supabase no longer exposes new objects to the Data API automatically; grant explicitly.
-- Signed-in users only (no anon), as for the other trigger-engine objects.
grant select, insert, update, delete on table public.rep_cards to authenticated;
grant all on table public.rep_cards to service_role;
grant select on table public.trigger_today to authenticated;
grant all on table public.trigger_today to service_role;

commit;
