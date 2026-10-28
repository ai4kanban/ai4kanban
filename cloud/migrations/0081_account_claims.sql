-- The account rides in the sign-in token (#2116).
--
-- Every signed-in request used to call `api.account_for_session` after the Worker verified the
-- token. Auth now asks this hook for the claims whenever it issues or refreshes a token, and an
-- admitted account gets `account_id`, `admitted` and `handle` written in, so the Worker reads
-- them off the verified token. A token without them — older, or not admitted yet — still takes
-- the database path.
--
-- Enabled in the project's auth settings, not here (README.md, "Sign-in token claims"). Turning
-- the hook off is the rollback.

-- Its own schema: Auth's role needs USAGE on the hook's schema, and USAGE on `api` or `cloud`
-- would hand it every function there.
create schema if not exists hooks;
revoke all on schema hooks from public;
revoke all on schema hooks from anon, authenticated, service_role;

-- Never fails a sign-in: anything going wrong — the write budget spent, a missing identity —
-- hands Auth the claims it sent, and the Worker looks the account up as before.
create or replace function hooks.access_token_claims(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claims jsonb := coalesce(event -> 'claims', '{}'::jsonb) - 'account_id' - 'admitted' - 'handle';
  v_row json;
begin
  begin
    -- The Worker's `DAILY_WRITE_BUDGET`; a first sign-in writes the account row.
    v_row := api.account_for_session((event ->> 'user_id')::uuid, 20000);
    if (v_row ->> 'admitted')::boolean and v_row ->> 'account_id' is not null
       and v_row ->> 'handle' is not null then
      v_claims := v_claims || jsonb_build_object(
        'account_id', v_row ->> 'account_id',
        'admitted', true,
        'handle', v_row ->> 'handle');
    end if;
  exception when others then
    null;
  end;
  return jsonb_set(event, '{claims}', v_claims);
end;
$$;
revoke all on function hooks.access_token_claims(jsonb) from public;
revoke all on function hooks.access_token_claims(jsonb) from anon, authenticated, service_role;

grant usage on schema hooks to supabase_auth_admin;
grant execute on function hooks.access_token_claims(jsonb) to supabase_auth_admin;
