-- Hosted music (#1822) spends from the same monthly pool and is recorded like the others.

alter table cloud.credit_spends drop constraint credit_spends_use_check;
alter table cloud.credit_spends add constraint credit_spends_use_check check (use in ('speech', 'image', 'music'));

alter table cloud.ai_calls drop constraint ai_calls_capability_check;
alter table cloud.ai_calls add constraint ai_calls_capability_check
  check (capability in ('judge', 'speech', 'image', 'music'));
