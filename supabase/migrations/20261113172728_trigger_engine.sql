-- Trigger engine tables for MarketSense Trigger Desk (Atomic CRM project zdzcubhkvrmxsjdzklds)
--
-- Moves the Notion CRM + Company Watchlist model into Supabase alongside Atomic CRM.
-- Atomic's own tables (companies, contacts, contact_notes, deals, tasks, sales) are only EXTENDED
-- with new nullable columns, so the app keeps working unchanged. Everything trigger-specific lives
-- in new tables:
--
--   clients          who the watching is for (MarketSense itself first; client markets later)
--   trigger_events   one row per detected change (a person can have several over time)
--   outreach_touches one row per email / LinkedIn touch, replacing Email 1/2/3 Date columns
--   trigger_events_live (view)  adds Day Count, Window and Days Since Contact, computed live
--
-- Every new table carries client_id so a client's data can be isolated later. For now, access
-- rules match Atomic's (any signed-in user), because only MarketSense staff log in.

begin;

-- ---------------------------------------------------------------- clients
create table public.clients (
  id          bigint generated always as identity primary key,
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);
insert into public.clients (name, slug) values ('MarketSense', 'marketsense');

-- ---------------------------------------------------------------- companies (Atomic) + watchlist fields
alter table public.companies
  add column client_id          bigint references public.clients(id),
  add column notion_page_id     text unique,
  add column segment            text check (segment in ('manufacturer','industrial_agency_or_vendor','recruiting_firm','retirement_plan_provider','other')),
  add column sub_sector         text,
  add column size_band          text check (size_band in ('11-50','51-200','201-500','501-1000','outside_range')),
  add column employees          integer,
  add column ownership          text check (ownership in ('private','pe_owned','subsidiary','public')),
  add column market             text check (market in ('b2b_industrial','consumer_brand')),
  add column watch_status       text not null default 'active' check (watch_status in ('active','paused','excluded')),
  add column on_apify_tracker   boolean not null default false,
  add column on_sales_nav_list  boolean not null default false,
  add column last_detection_run date;

create index companies_client_watch_idx on public.companies (client_id, watch_status);

-- ---------------------------------------------------------------- contacts (Atomic) + lead fields
alter table public.contacts
  add column client_id       bigint references public.clients(id),
  add column notion_page_id  text unique,
  add column location        text,
  add column icp             text check (icp in ('manufacturing','industrial_agency_vendor','recruiting_exec_search')),
  add column lead_source     text check (lead_source in ('trigger_new_leader','linkedin_sendpilot','linkedin_organic','referral','inbound','event','other')),
  add column cohort          text check (cohort in ('trigger_list','house_list')),
  add column engine_fit      text check (engine_fit in ('strong','maybe','no')),
  add column email_status    text check (email_status in ('verified','catch_all','unknown','invalid','not_verified')),
  add column buyer_universe  text,
  add column niche           text;

create index contacts_client_idx on public.contacts (client_id);

-- ---------------------------------------------------------------- trigger_events
create table public.trigger_events (
  id                    bigint generated always as identity primary key,
  client_id             bigint not null references public.clients(id),
  contact_id            bigint references public.contacts(id) on delete cascade,
  company_id            bigint references public.companies(id) on delete set null,
  notion_page_id        text unique,

  -- 1. Trigger: who changed
  trigger_type          text not null check (trigger_type in ('new_sales_leader','new_marketing_leader','new_ceo_or_president','none_house_list')),
  trigger_detail        text,
  hire_or_promotion     text check (hire_or_promotion in ('new_hire','internal_promotion','unknown')),
  start_month           date,
  detected_date         date,
  detected_via          text check (detected_via in ('apify_tracker','sales_navigator','press_release','business_journal','trade_press','other')),
  trigger_source        text,

  -- 2. Live check: is it real?
  live_check_detail     text,
  verified_date         date,
  verified_by           bigint references public.sales(id),

  -- 3. Second signal: why now
  second_signal         text check (second_signal in ('roles_posted_under_leader','web_or_search_weakness','growth_event','agency_or_vendor_in_use','predecessor_exit','none')),
  second_signal_detail  text,
  second_signal_date    date,
  second_signal_source  text,

  -- 4. Gate and pipeline stage (Notion "MS Stage")
  gate                  text check (gate in ('pass','fail','hold')),
  gate_note             text,
  stage                 text not null default 'needs_check' check (stage in ('needs_check','hold','ready_to_send','in_sequence','replied','meeting_set','opportunity','closed_out')),
  send_order            integer,
  next_action           text,
  next_action_date      date,
  priority              text check (priority in ('low','medium','high')),

  -- Offer asset (one-pager / brief)
  asset_url             text,
  asset_sent            boolean not null default false,
  send_offer            boolean not null default false,
  offer_queued          date,

  -- Results
  replied               boolean not null default false,
  positive_reply        boolean not null default false,
  meeting               boolean not null default false,
  opportunity           boolean not null default false,
  deal_id               bigint references public.deals(id) on delete set null,
  estimated_value       numeric(12,2),
  expected_close        date,

  sales_id              bigint references public.sales(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index trigger_events_client_stage_idx on public.trigger_events (client_id, stage);
create index trigger_events_contact_idx      on public.trigger_events (contact_id);
create index trigger_events_company_idx      on public.trigger_events (company_id);
create index trigger_events_detected_idx     on public.trigger_events (detected_date);

-- ---------------------------------------------------------------- outreach_touches
create table public.outreach_touches (
  id                bigint generated always as identity primary key,
  client_id         bigint not null references public.clients(id),
  trigger_event_id  bigint references public.trigger_events(id) on delete cascade,
  contact_id        bigint not null references public.contacts(id) on delete cascade,
  channel           text not null check (channel in ('email','linkedin','phone','other')),
  touch             text not null check (touch in ('email_1','email_2','email_3','linkedin_connect','reply_sent','other')),
  touched_on        date not null,
  note              text,
  sales_id          bigint references public.sales(id),
  created_at        timestamptz not null default now()
);

create index outreach_touches_contact_idx on public.outreach_touches (contact_id, touched_on desc);
create index outreach_touches_event_idx   on public.outreach_touches (trigger_event_id);

-- ---------------------------------------------------------------- updated_at + sales_id defaults
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trigger_events_updated_at before update on public.trigger_events
  for each row execute function public.touch_updated_at();

-- Reuse Atomic's helper: fills sales_id from the signed-in user when left empty.
create trigger set_trigger_events_sales_id before insert on public.trigger_events
  for each row execute function public.set_sales_id_default();
create trigger set_outreach_touches_sales_id before insert on public.outreach_touches
  for each row execute function public.set_sales_id_default();

-- ---------------------------------------------------------------- live view: Day Count, Window, Days Since Contact
-- Day Count = days since the later of Start Month and Detected Date (as in Notion).
-- Window    = Hold until 15 days into the role (from Start Month, or Detected Date if none);
--             Write to day 60; Expiring 61-75; Expired after 75. Matches the MarketSense site.
--             (Notion's description said Write to 45 / Expiring to 60; Tom set 60 on Nov 13, 2026.)
create view public.trigger_events_live with (security_invoker = on) as
select
  te.*,
  (current_date - greatest(te.start_month, te.detected_date))           as day_count,
  case
    when coalesce(te.start_month, te.detected_date) is null             then null
    when current_date - coalesce(te.start_month, te.detected_date) < 15 then 'hold'
    when current_date - greatest(te.start_month, te.detected_date) <= 60 then 'write'
    when current_date - greatest(te.start_month, te.detected_date) <= 75 then 'expiring'
    else 'expired'
  end                                                                    as window_status,
  lc.last_contact,
  (current_date - lc.last_contact)                                       as days_since_contact
from public.trigger_events te
left join lateral (
  select max(ot.touched_on) as last_contact
  from public.outreach_touches ot
  where ot.contact_id = te.contact_id
) lc on true;

-- ---------------------------------------------------------------- access rules (match Atomic for now)
alter table public.clients          enable row level security;
alter table public.trigger_events   enable row level security;
alter table public.outreach_touches enable row level security;

create policy "clients read"   on public.clients for select to authenticated using (true);

create policy "trigger_events read"   on public.trigger_events for select to authenticated using (true);
create policy "trigger_events insert" on public.trigger_events for insert to authenticated with check (true);
create policy "trigger_events update" on public.trigger_events for update to authenticated using (true) with check (true);
create policy "trigger_events delete" on public.trigger_events for delete to authenticated using (true);

create policy "outreach_touches read"   on public.outreach_touches for select to authenticated using (true);
create policy "outreach_touches insert" on public.outreach_touches for insert to authenticated with check (true);
create policy "outreach_touches update" on public.outreach_touches for update to authenticated using (true) with check (true);
create policy "outreach_touches delete" on public.outreach_touches for delete to authenticated using (true);

commit;
