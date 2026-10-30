-- What 0122_rail_only_chats_you_wrote.before.sql left: only the chat the user wrote in is on the rail.

do $migrated$
begin
  assert not (select in_rail from cloud.task_chats where task_id = 'task_m0113a'), 'a request-only chat stayed on the rail';
  assert (select in_rail from cloud.task_chats where task_id = 'task_m0113b'), 'a chat the user wrote in left the rail';
  delete from cloud.accounts where id = 'a0000000-0113-4113-8113-011301130113';
end
$migrated$;
