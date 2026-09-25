-- A card finished in planning is accepted by archiving it, not by a build (#1057).

alter table cloud.events drop constraint events_decision_check;
alter table cloud.events
  add constraint events_decision_check check (decision in ('implement', 'answer', 'archive'));

alter table cloud.event_actions drop constraint event_actions_decision_check;
alter table cloud.event_actions
  add constraint event_actions_decision_check check (decision in ('implement', 'answer', 'archive'));
