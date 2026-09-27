-- Generated video covers (#1114) spend from the same monthly pool as narration.

alter table cloud.credit_spends drop constraint credit_spends_use_check;
alter table cloud.credit_spends add constraint credit_spends_use_check check (use in ('speech', 'image'));
