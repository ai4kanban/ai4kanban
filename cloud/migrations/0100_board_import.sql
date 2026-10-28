-- Import a local board into a project (#2123): its open cards become tasks that do not run,
-- numbered in the order the board sent them.
--
-- - **Numbers**: each card names the number it expects; one that is not the project's next
--   refuses the whole call, so a task made meanwhile never shifts the cards' references.
-- - **Rerun**: a task keeps its card's old number as `source_context.import`; a card already
--   imported from the same board answers its task.
-- - **Target**: the project holds no task, or only tasks imported from the same board.
-- - **Next**: the call answers the project's next number, so a client asks it with no cards first.
-- - **Review**: `v1_import_reviews` puts an imported card on review once its file is indexed, as a
--   task that runs, so the answer or approval goes on to the Runner.

create or replace function api.v1_import_tasks(p_account uuid, p_project text, p_board text, p_cards jsonb,
                                               p_workflows jsonb, p_daily_write_budget integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p cloud.projects;
  e jsonb;
  t cloud.tasks;
  v_ws text := cloud.v1_workspace_of(p_account, 'project', p_project);
  v_out jsonb := '[]';
begin
  perform cloud.v1_write(p_account, v_ws, p_daily_write_budget);
  select * into p from cloud.projects where id = p_project for update;
  if exists (select 1 from cloud.tasks x where x.project_id = p_project
             and x.source_context #>> '{import,board}' is distinct from p_board) then
    perform cloud.v1_refuse('This project already has tasks of its own; import into an empty project.');
  end if;
  for e in select * from jsonb_array_elements(coalesce(p_cards, '[]')) loop
    select * into t from cloud.tasks x where x.project_id = p_project
      and x.source_context #>> '{import,board}' = p_board and x.source_context #>> '{import,number}' = e ->> 'ref';
    if t.id is null then
      select * into p from cloud.projects where id = p_project;
      if p.next_number <> (e ->> 'number')::integer then
        perform cloud.v1_refuse(format('Card %s expected number %s, but the project''s next number is %s.',
          e ->> 'ref', e ->> 'number', p.next_number));
      end if;
      perform api.v1_create_task(p_account, jsonb_build_object('title', e ->> 'title', 'project', p_project, 'source', 'api',
          'source_context', jsonb_build_object('import', jsonb_build_object('board', p_board, 'number', (e ->> 'ref')::integer))),
        p_workflows -> (e ->> 'workflow'), p_daily_write_budget);
      select * into t from cloud.tasks x where x.project_id = p_project
        and x.source_context #>> '{import,board}' = p_board and x.source_context #>> '{import,number}' = e ->> 'ref';
    end if;
    v_out := v_out || jsonb_build_object('ref', (e ->> 'ref')::integer, 'task', t.id, 'number', t.number,
      'carded', t.card_path is not null);
    t := null;
  end loop;
  return jsonb_build_object('cards', v_out, 'next', (select x.next_number from cloud.projects x where x.id = p_project));
end;
$$;

/** `[{ task, review }]`: each imported task not yet on review goes there; `review` null asks to
 *  approve the plan, as a finished plan does. */
create or replace function api.v1_import_reviews(p_account uuid, p_project text, p_reviews jsonb, p_daily_write_budget integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  e jsonb;
  t cloud.tasks;
  r jsonb;
  n integer := 0;
begin
  perform cloud.v1_write(p_account, cloud.v1_workspace_of(p_account, 'project', p_project), p_daily_write_budget);
  for e in select * from jsonb_array_elements(coalesce(p_reviews, '[]')) loop
    select * into t from cloud.tasks where id = e ->> 'task' and project_id = p_project and source_context ? 'import';
    if t.id is null or t.review_status is not null then continue; end if;
    -- Run, so its answer or approval goes on to the Runner as a planned task's does.
    update cloud.tasks set run = true where id = t.id;
    r := e -> 'review';
    perform cloud.v1_submit_draft(t.id, case
      when jsonb_typeof(r) = 'object' then jsonb_build_object('question', r ->> 'question',
        'options', (select jsonb_agg(jsonb_build_object('label', o.label, 'approve', false) order by o.n)
                    from jsonb_array_elements_text(r -> 'options') with ordinality o(label, n)),
        'card_question', (r ->> 'position')::integer)
      when t.title ~ '[一-鿿]' then
        '{"question": "批准这份方案？", "options": [{"label": "确认", "approve": true}, {"label": "需要修改", "approve": false}]}'
      else '{"question": "Approve this plan?", "options": [{"label": "Approve", "approve": true},
             {"label": "Request changes", "approve": false}]}' end);
    n := n + 1;
  end loop;
  return n;
end;
$$;

do $grants$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'api' and p.proname like 'v1\_%') or (n.nspname = 'cloud' and p.proname like 'v1\_%')
  loop
    execute format('revoke all on function %s from public', f);
    if f::text like 'api.%' then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end
$grants$;
