-- The shared template catalog (#1708): what each template is, and where its files sit in R2.
--
-- The files themselves live in the Worker's `TEMPLATES` bucket under
-- `<kind>/<name>/<revision>/<file>`; a row names the revision it points at, so a replacement
-- lands whole or not at all. `files` is the template's own download list; `previews` (catalog
-- images) and `evidence` (what the reference looked like when captured) are kept apart from it.

create table cloud.templates (
  name text primary key check (name ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category text not null check (category ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  tags text[] not null default '{}',
  title text not null check (length(title) between 1 and 200),
  summary text not null check (length(summary) between 1 and 300),
  description text not null check (length(description) between 1 and 4000),
  source jsonb not null,
  access text not null check (access in ('free', 'pro')),
  -- [{ "path", "size", "sha256" }] for each list.
  files jsonb not null,
  previews jsonb not null default '[]',
  evidence jsonb not null default '[]',
  revision text not null,
  published_by text not null,
  published_at timestamptz not null default now()
);
create index templates_tags on cloud.templates using gin (tags);
alter table cloud.templates enable row level security;

/* Every tag in a category, with how many templates carry it. */
create or replace function api.template_tags(p_category text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(json_agg(json_build_object('tag', tag, 'count', n) order by n desc, tag), '[]'::json)
  from (
    select tag, count(*) as n
    from cloud.templates t, unnest(t.tags) as tag
    where t.category = p_category
    group by tag
  ) x;
$$;

/* Templates in a category carrying any of the tags, those matching more topic words first.
   At most ten. */
create or replace function api.search_templates(
  p_category text,
  p_tags text[],
  p_words text[],
  p_limit integer
) returns json
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(json_agg(to_jsonb(m) - 'hits' order by m.hits desc, m.published_at desc), '[]'::json)
  from (
    select t.*, (
      select count(*) from unnest(coalesce(p_words, '{}')) w
      where position(lower(w) in lower(t.title || ' ' || t.summary || ' ' || t.description || ' '
                                       || array_to_string(t.tags, ' '))) > 0
    ) as hits
    from cloud.templates t
    where t.category = p_category and t.tags && p_tags
    order by hits desc, t.published_at desc
    limit least(greatest(coalesce(p_limit, 5), 1), 10)
  ) m;
$$;

create or replace function api.template(p_name text)
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select to_json(t) from cloud.templates t where t.name = p_name;
$$;

/* Publish one template. An existing name is refused (AKB19) unless `p_replace`; a replacement
   answers the revision it superseded so the Worker can drop those files. */
create or replace function api.publish_template(
  p_handle text,
  p_name text,
  p_category text,
  p_tags text[],
  p_title text,
  p_summary text,
  p_description text,
  p_source jsonb,
  p_access text,
  p_files jsonb,
  p_previews jsonb,
  p_evidence jsonb,
  p_revision text,
  p_replace boolean,
  p_daily_write_budget integer
) returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  select revision into v_old from cloud.templates where name = p_name for update;
  if v_old is not null and not p_replace then
    raise exception 'A template named % already exists.', p_name using errcode = 'AKB19';
  end if;
  perform cloud.count_write(p_daily_write_budget);
  insert into cloud.templates as t (
    name, category, tags, title, summary, description, source, access,
    files, previews, evidence, revision, published_by, published_at
  ) values (
    p_name, p_category, coalesce(p_tags, '{}'), p_title, p_summary, p_description, p_source, p_access,
    p_files, coalesce(p_previews, '[]'), coalesce(p_evidence, '[]'), p_revision, p_handle, now()
  )
  on conflict (name) do update set
    category = excluded.category, tags = excluded.tags, title = excluded.title,
    summary = excluded.summary, description = excluded.description, source = excluded.source,
    access = excluded.access, files = excluded.files, previews = excluded.previews,
    evidence = excluded.evidence, revision = excluded.revision,
    published_by = excluded.published_by, published_at = excluded.published_at;
  return json_build_object('revision', p_revision, 'replaced', v_old);
end;
$$;

/* Take a template out of the catalog. Answers the revision it held, or null. */
create or replace function api.delete_template(p_name text, p_daily_write_budget integer)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  delete from cloud.templates where name = p_name returning revision into v_old;
  if v_old is null then return null; end if;
  perform cloud.count_write(p_daily_write_budget);
  return json_build_object('revision', v_old);
end;
$$;

revoke all on function api.template_tags(text) from public;
revoke all on function api.search_templates(text, text[], text[], integer) from public;
revoke all on function api.template(text) from public;
revoke all on function api.publish_template(text, text, text, text[], text, text, text, jsonb, text, jsonb, jsonb, jsonb, text, boolean, integer) from public;
revoke all on function api.delete_template(text, integer) from public;
grant execute on function api.template_tags(text) to service_role;
grant execute on function api.search_templates(text, text[], text[], integer) to service_role;
grant execute on function api.template(text) to service_role;
grant execute on function api.publish_template(text, text, text, text[], text, text, text, jsonb, text, jsonb, jsonb, jsonb, text, boolean, integer) to service_role;
grant execute on function api.delete_template(text, integer) to service_role;
