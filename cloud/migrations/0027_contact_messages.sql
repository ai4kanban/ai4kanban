-- The site's contact form (#784).
--
-- A visitor with no account sends a message; it is mailed to support, and the reply is written
-- by hand from that mailbox. The row is written first so a refused send is retried by the
-- hourly run rather than lost. Each row is its own outbox record: one message, one send.
--
-- The rate limit reuses `cloud.count_training_attempt`. The Worker prefixes its keys with
-- `contact:`, so a contact submit never spends a booking's window.

create table cloud.contact_messages (
  id uuid primary key default gen_random_uuid(),
  reason text not null check (reason in ('support', 'customize')),
  email text not null,
  message text not null,
  -- Only a `customize` submit carries one.
  workflow text not null default '',
  -- The submit this row came from. A retry of the same submit finds it and changes nothing.
  op_id text not null unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text
);
alter table cloud.contact_messages enable row level security;

create index contact_messages_unsent on cloud.contact_messages (created_at) where sent_at is null;

/*
 * Take one message. Both keys are counted before the insert, and a key that is empty is not
 * counted at all — a request with no address is limited by its email alone. A refusal (AKB18)
 * rolls back both increments with the rest of the transaction.
 */
create or replace function api.submit_contact(
  p_op_id text,
  p_reason text,
  p_email text,
  p_message text,
  p_workflow text,
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

    insert into cloud.contact_messages (reason, email, message, workflow, op_id)
    values (p_reason, p_email, p_message, coalesce(p_workflow, ''), p_op_id)
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
revoke all on function api.submit_contact(text, text, text, text, text, text, text, integer, integer, integer) from public;
grant execute on function api.submit_contact(text, text, text, text, text, text, text, integer, integer, integer) to service_role;

create or replace function api.pending_contact_mail(p_limit integer, p_max_attempts integer)
returns json
language sql
security definer
set search_path = ''
as $$
  select coalesce(json_agg(row_to_json(q) order by q.created_at), '[]'::json)
  from (
    select m.id, m.reason, m.email, m.message, m.workflow,
           to_char(m.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
    from cloud.contact_messages m
    where m.sent_at is null and m.attempts < p_max_attempts
    order by m.created_at
    limit p_limit
  ) q;
$$;
revoke all on function api.pending_contact_mail(integer, integer) from public;
grant execute on function api.pending_contact_mail(integer, integer) to service_role;

create or replace function api.mark_contact_mail_sent(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update cloud.contact_messages
     set sent_at = now(), attempts = attempts + 1, last_error = null
   where id = p_id and sent_at is null;
$$;
revoke all on function api.mark_contact_mail_sent(uuid) from public;
grant execute on function api.mark_contact_mail_sent(uuid) to service_role;

create or replace function api.mark_contact_mail_failed(p_id uuid, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update cloud.contact_messages
     set attempts = attempts + 1, last_error = left(coalesce(p_error, ''), 500)
   where id = p_id and sent_at is null;
$$;
revoke all on function api.mark_contact_mail_failed(uuid, text) from public;
grant execute on function api.mark_contact_mail_failed(uuid, text) to service_role;
