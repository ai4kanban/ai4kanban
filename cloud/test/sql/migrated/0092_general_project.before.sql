-- Built-in projects as they stood before #2141: one still `No project`, one the user renamed.

insert into cloud.accounts (id, handle) values
  ('a0000000-2141-4141-8141-214121412141', 'mig2141a'),
  ('b0000000-2141-4141-8141-214121412141', 'mig2141b');
select cloud.v1_unfiled(cloud.v1_personal('a0000000-2141-4141-8141-214121412141')),
       cloud.v1_unfiled(cloud.v1_personal('b0000000-2141-4141-8141-214121412141'));
update cloud.projects set name = 'Inbox'
 where unfiled and account_id = 'b0000000-2141-4141-8141-214121412141';
