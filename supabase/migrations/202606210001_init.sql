create extension if not exists pgcrypto;

create type public.booking_source as enum ('sop', 'engsoc', 'wise', 'utsu', 'custom');
create type public.booking_status as enum ('new', 'in_review', 'submitted', 'booked', 'needs_alternatives', 'declined');
create type public.photo_kind as enum ('external', 'upload');

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  building text not null,
  display_name text not null,
  capacity integer check (capacity is null or capacity > 0),
  room_type text not null,
  booking_source public.booking_source not null,
  details_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_photos (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  kind public.photo_kind not null,
  url text not null,
  storage_path text,
  alt_text text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create table public.room_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.room_tag_assignments (
  room_id uuid not null references public.rooms(id) on delete cascade,
  tag_id uuid not null references public.room_tags(id) on delete cascade,
  primary key (room_id, tag_id)
);

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  email text not null,
  requester_name text,
  team text not null check (team in ('PD', 'Outreach', 'Conference', 'Finance', 'Marketing', 'Internal')),
  purpose text not null,
  event_date date not null,
  start_time time not null,
  end_time time not null,
  attendees integer not null check (attendees > 0),
  requires_av boolean not null default false,
  av_details text,
  av_estimate_cents integer check (av_estimate_cents is null or av_estimate_cents >= 0),
  av_acknowledged boolean not null default false,
  primary_room_id uuid references public.rooms(id) on delete set null,
  primary_custom_room text,
  urgency_reasons text[] not null default '{}',
  is_urgent boolean not null default false,
  status public.booking_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint primary_choice_required check (primary_room_id is not null or primary_custom_room is not null)
);

create table public.booking_request_alternatives (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null references public.booking_requests(id) on delete cascade,
  preference_rank integer not null check (preference_rank between 1 and 3),
  room_id uuid references public.rooms(id) on delete set null,
  custom_room text,
  constraint alternative_choice_required check (room_id is not null or custom_room is not null),
  unique (booking_request_id, preference_rank)
);

create index booking_requests_urgent_created_at_idx on public.booking_requests (is_urgent desc, created_at desc);
create index booking_requests_status_created_at_idx on public.booking_requests (status, created_at desc);
create index room_photos_room_id_sort_order_idx on public.room_photos (room_id, sort_order);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger rooms_set_updated_at before update on public.rooms
for each row execute procedure public.set_updated_at();

create trigger booking_requests_set_updated_at before update on public.booking_requests
for each row execute procedure public.set_updated_at();

alter table public.rooms enable row level security;
alter table public.room_photos enable row level security;
alter table public.room_tags enable row level security;
alter table public.room_tag_assignments enable row level security;
alter table public.booking_requests enable row level security;
alter table public.booking_request_alternatives enable row level security;

insert into storage.buckets (id, name, public)
values ('room-photos', 'room-photos', true)
on conflict (id) do nothing;
