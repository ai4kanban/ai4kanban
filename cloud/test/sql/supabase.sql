-- What a Supabase project gives the migrations, and nothing else (#329).
--
-- The checks beside this file run the real migrations against a real Postgres, so what they
-- assert is what the SQL functions and the RLS policies actually do — which the faked
-- PostgREST in cloud/test/*.mjs cannot answer. This file stands up only the pieces of a
-- Supabase project those migrations lean on:
--
--   • the three roles the lockdown in 0001 revokes from and grants to;
--   • `auth.identities` and `auth.uid()`, which admission and both Realtime policies read;
--   • `realtime.messages`, `realtime.send()` and `realtime.topic()`, which the hints and the
--     policies guarding a private topic are written against.
--
-- Each is written to match the project's own definition. It is a stand-in for the platform,
-- never for anything of ours: every table, function and policy under test comes from
-- cloud/migrations/ exactly as it is deployed. Applied only to a throwaway database; a real
-- project has all of this already, and `npm run test:sql -- --project` skips this file.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

-- ---------------------------------------------------------------------------
-- Auth
-- ---------------------------------------------------------------------------

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

-- The provider's own record, which Auth rewrites on every sign-in. Admission reads the
-- handle from here rather than from a token, because a token carries only what the account
-- holder can rewrite.
create table auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null,
  identity_data jsonb not null default '{}'::jsonb,
  last_sign_in_at timestamptz default now()
);

-- The signed-in subject, as the project defines it: the claim, however it was set.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

create schema realtime;
grant usage on schema realtime to anon, authenticated, service_role;

-- One broadcast. Realtime checks a socket's right to a topic by reading this table as the
-- signed-in role, which is what makes the policies in 0004 and 0005 the whole of a private
-- topic's authorization.
create table realtime.messages (
  id bigserial,
  topic text not null,
  extension text not null,
  payload jsonb,
  event text,
  private boolean not null default false,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, inserted_at)
);
alter table realtime.messages enable row level security;
grant select on realtime.messages to authenticated;

/** The topic the socket is asking about. */
create or replace function realtime.topic() returns text
language sql stable as $$
  select nullif(current_setting('realtime.topic', true), '');
$$;

/** Say something on a topic. */
create or replace function realtime.send(
  payload jsonb,
  event text,
  topic text,
  private boolean default true
) returns void
language sql as $$
  insert into realtime.messages (topic, extension, payload, event, private)
  values (topic, 'broadcast', payload, event, private);
$$;
