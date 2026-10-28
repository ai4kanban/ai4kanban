-- The public template catalog on ai4kanban.dev/templates (#1711).
--
-- `showcase` is what a maintainer registers for the site apart from the template itself: a
-- cover and the original and recreation shown side by side. Its files sit in the
-- `TEMPLATES` bucket under `showcase/<name>/<id>/<file>`. A replacement keeps it; a delete
-- drops the row with it.

alter table cloud.templates add column showcase jsonb not null default '{}';

/* Every published template, newest first: only what the public catalog shows. */
create or replace function api.template_catalog()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(json_agg(json_build_object(
    'name', t.name, 'category', t.category, 'tags', t.tags, 'title', t.title,
    'summary', t.summary, 'access', t.access, 'previews', t.previews,
    'revision', t.revision, 'showcase', t.showcase, 'published_at', t.published_at
  ) order by t.published_at desc, t.name), '[]'::json)
  from cloud.templates t;
$$;

/* Register a template's showcase, whole. Answers the one it replaced, or null when the
   template does not exist. */
create or replace function api.set_template_showcase(
  p_name text,
  p_showcase jsonb,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
begin
  select showcase into v_old from cloud.templates where name = p_name for update;
  if v_old is null then return null; end if;
  perform cloud.count_write(p_daily_write_budget);
  update cloud.templates set showcase = p_showcase where name = p_name;
  return json_build_object('replaced', v_old);
end;
$$;

revoke all on function api.template_catalog() from public;
revoke all on function api.set_template_showcase(text, jsonb, integer) from public;
grant execute on function api.template_catalog() to service_role;
grant execute on function api.set_template_showcase(text, jsonb, integer) to service_role;
