-- Seed partners (#1039): an application is a contact message, and an accepted partner gets six
-- months of Pro by hand.
--
-- The application form on the site's /seed page is the contact form's `seed` reason, carrying
-- a GitHub handle. The grant is its own table, never a subscription: it is keyed on the handle,
-- so the partner need not have signed in yet, and it is matched on whatever GitHub attests at
-- read time (`cloud.attested`). A handle gets one grant, ever. Whether it is Pro is decided when
-- read (src/billing.ts), so expiry needs nothing.

alter table cloud.contact_messages drop constraint contact_messages_reason_check;
alter table cloud.contact_messages
  add constraint contact_messages_reason_check check (reason in ('support', 'customize', 'seed'));
-- Only a `seed` submit carries one.
alter table cloud.contact_messages add column github text not null default '';

drop function api.submit_contact(text, text, text, text, text, text, text, integer, integer, integer);

create or replace function api.submit_contact(
  p_op_id text,
  p_reason text,
  p_email text,
  p_message text,
  p_workflow text,
  p_github text,
  p_ip_key text,
  p_email_key text,
  p_attempt_window_seconds integer,
  p_attempt_limit integer,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row cloud.contact_messages;
begin
  select * into v_row from cloud.contact_messages m where m.op_id = p_op_id;
  if v_row.id is null then
    perform cloud.count_training_attempt(p_ip_key, p_attempt_window_seconds, p_attempt_limit);
    perform cloud.count_training_attempt(p_email_key, p_attempt_window_seconds, p_attempt_limit);
    perform cloud.count_write(p_daily_write_budget);

    insert into cloud.contact_messages (reason, email, message, workflow, github, op_id)
    values (p_reason, p_email, p_message, coalesce(p_workflow, ''), coalesce(p_github, ''), p_op_id)
    on conflict (op_id) do nothing
    returning * into v_row;
    if v_row.id is null then
      select * into v_row from cloud.contact_messages m where m.op_id = p_op_id;
    end if;
  end if;

  return json_build_object(
    'id', v_row.id,
    'created_at', to_char(v_row.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
end;
$$;
revoke all on function api.submit_contact(text, text, text, text, text, text, text, text, integer, integer, integer) from public;
grant execute on function api.submit_contact(text, text, text, text, text, text, text, text, integer, integer, integer) to service_role;

create or replace function api.pending_contact_mail(p_limit integer, p_max_attempts integer)
returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(json_agg(row_to_json(q) order by q.created_at), '[]'::json)
  from (
    select m.id, m.reason, m.email, m.message, m.workflow, m.github,
           to_char(m.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
    from cloud.contact_messages m
    where m.sent_at is null and m.attempts < p_max_attempts
    order by m.created_at
    limit p_limit
  ) q;
$$;
revoke all on function api.pending_contact_mail(integer, integer) from public;
grant execute on function api.pending_contact_mail(integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

create table cloud.seed_grants (
  handle text primary key,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  check (ends_at > starts_at)
);
alter table cloud.seed_grants enable row level security;

create unique index seed_grants_lower_handle on cloud.seed_grants (lower(handle));

/* Grant six months from now. Refused for a handle that has ever had one, expired or not. Run by
 * hand (scripts/seed.mjs); not reachable over REST. */
create or replace function cloud.grant_seed(p_handle text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handle text := ltrim(btrim(coalesce(p_handle, '')), '@');
  v_row cloud.seed_grants;
begin
  if v_handle !~ '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$' then
    raise exception '"%" is not a GitHub handle', p_handle;
  end if;
  select * into v_row from cloud.seed_grants g where lower(g.handle) = lower(v_handle);
  if v_row.handle is not null then
    raise exception '@% already had a grant, % to % — a handle gets one', v_row.handle,
      to_char(v_row.starts_at at time zone 'utc', 'YYYY-MM-DD'),
      to_char(v_row.ends_at at time zone 'utc', 'YYYY-MM-DD');
  end if;

  insert into cloud.seed_grants (handle, starts_at, ends_at)
  values (v_handle, now(), now() + interval '6 months')
  returning * into v_row;
  return json_build_object('handle', v_row.handle, 'starts_at', v_row.starts_at, 'ends_at', v_row.ends_at);
end;
$$;
revoke all on function cloud.grant_seed(text) from public;

/* The grant on this user's GitHub handle, lapsed or not, or null. */
create or replace function api.seed_grant_for(p_user_id uuid)
returns json
language sql
security definer
set search_path = ''
as $$
  select json_build_object(
           'starts_at', to_char(g.starts_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'ends_at', to_char(g.ends_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  from cloud.attested(p_user_id) a
  join cloud.seed_grants g on lower(g.handle) = lower(a.handle);
$$;
revoke all on function api.seed_grant_for(uuid) from public;
grant execute on function api.seed_grant_for(uuid) to service_role;
