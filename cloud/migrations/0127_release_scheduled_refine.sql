-- A refine already marked on a card starts when a write takes a blocker off it (#149), on the
-- terms a blocker that ends starts it; the write knows the card by number.

create function api.v1_release_scheduled_refine(p_project text, p_number integer, p_notes text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_task text;
begin
  select id into v_task from cloud.tasks where project_id = p_project and number = p_number;
  if v_task is null then return jsonb_build_object('started', false); end if;
  return api.v1_release_task(v_task, 'refine', p_notes);
end;
$$;

revoke all on function api.v1_release_scheduled_refine(text, integer, text) from public;
grant execute on function api.v1_release_scheduled_refine(text, integer, text) to service_role;
