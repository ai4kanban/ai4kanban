-- The training page's bookings (#683).
--
-- A visitor with no Cloud account picks an hour on ai4kanban.dev/training and books it. That
-- needs a shared record — two browsers must not both come away holding the same hour — so it
-- lives here beside the preview's own tables, in its own corner of `cloud`.
--
-- What it is NOT: a workspace, a board, or anything an account owns. No row here has an
-- `owner_id` and no function here takes a subject. The Worker's public routes are the only
-- callers, and every one of them is narrow: the availability read answers with instants and
-- nothing else, and reading or cancelling one booking needs the unguessable token that went
-- out in its email.
--
-- The author's own schedule is NOT in the database. It is UTC+8 weekly hours and dated
-- exceptions in `cloud/src/training-schedule.ts` — deployed configuration, not data a route
-- can write. What this schema holds is the other half of the subtraction: which hours are
-- already taken.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per booking, live or cancelled. `slot_at` is the absolute instant the hour starts;
-- the visitor's own timezone is kept beside it so a later message can be written in the words
-- they read it in, and never so the hour itself is stored as local time.
create table cloud.training_bookings (
  id uuid primary key default gen_random_uuid(),
  -- What a person quotes back at us. Not a secret: `manage_token_hash` is what authorizes.
  reference text not null unique,
  slot_at timestamptz not null,
  service text not null check (service in ('single', 'monthly')),
  -- What the page charged, in cents, settled by the server rather than taken from the form.
  price_cents integer not null check (price_cents >= 0),
  visitor_name text not null,
  visitor_email text not null,
  -- The IANA zone the page was read in — what the confirmation is written in.
  visitor_timezone text not null,
  project text not null default '',
  -- SHA-256 of the token in the manage link, hex. The token itself is never stored, so a
  -- copy of this table is not a set of working links.
  manage_token_hash text not null,
  state text not null default 'booked' check (state in ('booked', 'cancelled')),
  -- The submit this row came from. A retry of the same submit finds it and changes nothing.
  op_id text not null unique,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
alter table cloud.training_bookings enable row level security;

-- The whole of the hold. Two submits racing for one hour are one insert and one unique
-- violation, inside their own transactions — there is no read-then-write to lose.
create unique index training_bookings_one_per_slot
  on cloud.training_bookings (slot_at)
  where state = 'booked';

-- The availability read's index: booked hours inside a week.
create index training_bookings_slot on cloud.training_bookings (slot_at);

-- What a booking still owes somebody. One row per message, so a booking that owes the visitor
-- a confirmation and the coach a notice is two records that fail and retry apart — the same
-- shape #327's invitation outbox has, for the same reason.
create table cloud.training_notices (
  booking_id uuid not null references cloud.training_bookings (id) on delete cascade,
  kind text not null check (kind in ('visitor', 'coach', 'cancelled', 'cancelled_coach')),
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  primary key (booking_id, kind)
);
alter table cloud.training_notices enable row level security;

create index training_notices_unsent on cloud.training_notices (queued_at) where sent_at is null;

-- What one caller has tried lately. The Worker hands in a fingerprint it derived from the
-- request and never the address itself, so this table cannot be read as a log of who visited.
create table cloud.training_attempts (
  fingerprint text primary key,
  window_start timestamptz not null default now(),
  attempts integer not null default 0
);
alter table cloud.training_attempts enable row level security;

-- ---------------------------------------------------------------------------
-- Reading what is taken
-- ---------------------------------------------------------------------------

-- The booked hours in a window, and nothing else about them. This is the one function a
-- stranger's request reaches with no proof of anything, so it answers with instants: no name,
-- no address, no project text, and no count of what the schedule offers.
create or replace function api.training_booked_slots(p_from timestamptz, p_to timestamptz)
returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(json_agg(to_char(b.slot_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                           order by b.slot_at), '[]'::json)
  from cloud.training_bookings b
  where b.state = 'booked' and b.slot_at >= p_from and b.slot_at < p_to;
$$;
revoke all on function api.training_booked_slots(timestamptz, timestamptz) from public;
grant execute on function api.training_booked_slots(timestamptz, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Taking an hour
-- ---------------------------------------------------------------------------

-- What every caller is given back about a booking of their own. The manage token is not in
-- it: the caller minted it, and after this it exists nowhere we can read it back from.
create or replace function cloud.training_booking_json(p_booking cloud.training_bookings)
returns json
language sql
immutable
set search_path = ''
as $$
  select json_build_object(
    'reference', p_booking.reference,
    'slot_at', to_char(p_booking.slot_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'service', p_booking.service,
    'price_cents', p_booking.price_cents,
    'name', p_booking.visitor_name,
    'email', p_booking.visitor_email,
    'timezone', p_booking.visitor_timezone,
    'project', p_booking.project,
    'state', p_booking.state,
    'created_at', to_char(p_booking.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'cancelled_at', case
      when p_booking.cancelled_at is null then null
      else to_char(p_booking.cancelled_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    end
  );
$$;
revoke all on function cloud.training_booking_json(cloud.training_bookings) from public;

-- Count one submit against a caller's window, and refuse past the limit. Raising aborts the
-- caller's transaction, so a refused submit rolls its own increment back — the counter stops
-- at the limit rather than climbing forever while somebody hammers it.
create or replace function cloud.count_training_attempt(
  p_fingerprint text,
  p_window_seconds integer,
  p_limit integer
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
begin
  if p_fingerprint is null or p_fingerprint = '' then return; end if;

  insert into cloud.training_attempts as a (fingerprint, window_start, attempts)
  values (p_fingerprint, now(), 1)
  on conflict (fingerprint) do update
    set window_start = case
          when a.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else a.window_start
        end,
        attempts = case
          when a.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else a.attempts + 1
        end
  returning a.attempts into v_attempts;

  if v_attempts > p_limit then
    raise exception 'Too many booking attempts. Try again shortly.' using errcode = 'AKB18';
  end if;
end;
$$;
revoke all on function cloud.count_training_attempt(text, integer, integer) from public;

/*
 * Hold one hour, or say who got there first.
 *
 * The whole check-and-take is this one insert. A second submit for the same hour runs into
 * `training_bookings_one_per_slot` and comes back as AKB17, which is the page's "this hour was
 * just booked" — never a silent overwrite and never a second live row.
 *
 * Idempotent on `p_op_id`: a submit whose reply was lost is retried with the same id, finds
 * its own row and is answered with it unchanged. The same id against a different hour is a
 * reused operation (AKB07), because two different bookings cannot be one submit.
 */
create or replace function api.book_training(
  p_op_id text,
  p_slot_at timestamptz,
  p_service text,
  p_price_cents integer,
  p_name text,
  p_email text,
  p_timezone text,
  p_project text,
  p_manage_token_hash text,
  p_fingerprint text,
  p_attempt_window_seconds integer,
  p_attempt_limit integer,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking cloud.training_bookings;
  v_reference text;
  v_tries integer := 0;
begin
  -- A retry of a submit that landed. Answered before anything is counted, so re-asking costs
  -- neither the day's budget nor the caller's rate window.
  select * into v_booking from cloud.training_bookings b where b.op_id = p_op_id;
  if v_booking.id is not null then
    if v_booking.slot_at <> p_slot_at then
      raise exception 'That submission id was already used for another booking.'
        using errcode = 'AKB07';
    end if;
    return cloud.training_booking_json(v_booking);
  end if;

  perform cloud.count_training_attempt(p_fingerprint, p_attempt_window_seconds, p_attempt_limit);

  if p_slot_at <= now() then
    raise exception 'That hour has already passed.' using errcode = 'AKB17';
  end if;

  perform cloud.count_write(p_daily_write_budget);

  -- The reference is what a person quotes, not what authorizes anything, so a readable six
  -- characters is enough. The unique index is the arbiter; a collision is retried.
  loop
    v_tries := v_tries + 1;
    v_reference := 'TR-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    begin
      insert into cloud.training_bookings (
        reference, slot_at, service, price_cents, visitor_name, visitor_email,
        visitor_timezone, project, manage_token_hash, op_id
      ) values (
        v_reference, p_slot_at, p_service, p_price_cents, p_name, p_email,
        p_timezone, coalesce(p_project, ''), p_manage_token_hash, p_op_id
      )
      returning * into v_booking;
      exit;
    exception when unique_violation then
      -- The hour, not the reference: whoever holds it holds it.
      if exists (select 1 from cloud.training_bookings b
                  where b.slot_at = p_slot_at and b.state = 'booked') then
        raise exception 'That hour was just booked.' using errcode = 'AKB17';
      end if;
      if v_tries >= 5 then raise; end if;
    end;
  end loop;

  insert into cloud.training_notices (booking_id, kind) values (v_booking.id, 'visitor');
  insert into cloud.training_notices (booking_id, kind) values (v_booking.id, 'coach');

  return cloud.training_booking_json(v_booking);
end;
$$;
revoke all on function api.book_training(text, timestamptz, text, integer, text, text, text, text, text, text, integer, integer, integer) from public;
grant execute on function api.book_training(text, timestamptz, text, integer, text, text, text, text, text, text, integer, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- The manage link
-- ---------------------------------------------------------------------------

-- One booking, to whoever holds its token. A wrong reference and a wrong token answer
-- identically — an empty result — so the pair cannot be used to find out which references
-- exist.
create or replace function api.read_training_booking(p_reference text, p_manage_token_hash text)
returns json
language sql
security definer
set search_path = ''
as $$
  select cloud.training_booking_json(b)
  from cloud.training_bookings b
  where b.reference = p_reference and b.manage_token_hash = p_manage_token_hash;
$$;
revoke all on function api.read_training_booking(text, text) from public;
grant execute on function api.read_training_booking(text, text) to service_role;

/*
 * Give the hour back. Only the token holder can, and cancelling twice is the same answer as
 * cancelling once — the update matches on `state = 'booked'` and the read below reports
 * whatever the row now is.
 *
 * A cancelled hour is only offered again when it is still in the future and the schedule
 * still opens it: the row leaves `booked`, and the availability read subtracts what is left.
 */
create or replace function api.cancel_training_booking(
  p_reference text,
  p_manage_token_hash text,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking cloud.training_bookings;
begin
  select * into v_booking
  from cloud.training_bookings b
  where b.reference = p_reference and b.manage_token_hash = p_manage_token_hash;
  if v_booking.id is null then return null; end if;

  if v_booking.state = 'booked' then
    perform cloud.count_write(p_daily_write_budget);
    update cloud.training_bookings
       set state = 'cancelled', cancelled_at = now()
     where id = v_booking.id and state = 'booked'
    returning * into v_booking;

    insert into cloud.training_notices (booking_id, kind)
    values (v_booking.id, 'cancelled'), (v_booking.id, 'cancelled_coach')
    on conflict (booking_id, kind) do nothing;
  end if;

  return cloud.training_booking_json(v_booking);
end;
$$;
revoke all on function api.cancel_training_booking(text, text, integer) from public;
grant execute on function api.cancel_training_booking(text, text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- The outbox
-- ---------------------------------------------------------------------------

-- What is still owed. Everything a message needs travels with it, so the Worker writes the
-- mail without a second read.
create or replace function api.pending_training_mail(p_limit integer, p_max_attempts integer)
returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(json_agg(row_to_json(q) order by q.queued_at), '[]'::json)
  from (
    select n.kind,
           b.id as booking_id,
           b.reference,
           to_char(b.slot_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as slot_at,
           b.service,
           b.price_cents,
           b.visitor_name as name,
           b.visitor_email as email,
           b.visitor_timezone as timezone,
           b.project,
           b.state,
           to_char(n.queued_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as queued_at
    from cloud.training_notices n
    join cloud.training_bookings b on b.id = n.booking_id
    where n.sent_at is null and n.attempts < p_max_attempts
    order by n.queued_at
    limit p_limit
  ) q;
$$;
revoke all on function api.pending_training_mail(integer, integer) from public;
grant execute on function api.pending_training_mail(integer, integer) to service_role;

create or replace function api.mark_training_mail_sent(p_booking uuid, p_kind text)
returns void
language sql
security definer
set search_path = ''
as $$
  update cloud.training_notices
     set sent_at = now(), attempts = attempts + 1, last_error = null
   where booking_id = p_booking and kind = p_kind and sent_at is null;
$$;
revoke all on function api.mark_training_mail_sent(uuid, text) from public;
grant execute on function api.mark_training_mail_sent(uuid, text) to service_role;

create or replace function api.mark_training_mail_failed(p_booking uuid, p_kind text, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update cloud.training_notices
     set attempts = attempts + 1, last_error = left(coalesce(p_error, ''), 500)
   where booking_id = p_booking and kind = p_kind and sent_at is null;
$$;
revoke all on function api.mark_training_mail_failed(uuid, text, text) from public;
grant execute on function api.mark_training_mail_failed(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- The operator's own read
-- ---------------------------------------------------------------------------

-- Every booking in a window, in full — who asked, what they wrote, and where they read it.
-- The Worker only reaches this behind an admitted account that is also named an operator in
-- its own configuration, which is why nothing here takes a subject: an account check that
-- lived in two places would be two answers to one question.
create or replace function api.list_training_bookings(p_from timestamptz, p_to timestamptz)
returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(json_agg(cloud.training_booking_json(b) order by b.slot_at), '[]'::json)
  from cloud.training_bookings b
  where b.slot_at >= p_from and b.slot_at < p_to;
$$;
revoke all on function api.list_training_bookings(timestamptz, timestamptz) from public;
grant execute on function api.list_training_bookings(timestamptz, timestamptz) to service_role;
