-- Sample rows for this case: four made-up accounts, dated back from today.
create table if not exists auth.users (id uuid primary key, email text);
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@example.com');

-- alice pays monthly, bob yearly, dave monthly; carol's Pro was gifted.
insert into cloud.subscriptions (id, user_id, customer_id, period, status, current_period_end) values
  ('sub_a', '00000000-0000-0000-0000-00000000000a', 'cus_a', 'monthly', 'active', now() + interval '20 days'),
  ('sub_b', '00000000-0000-0000-0000-00000000000b', 'cus_b', 'yearly', 'active', now() + interval '200 days'),
  ('sub_d', '00000000-0000-0000-0000-00000000000d', 'cus_d', 'monthly', 'active', now() + interval '5 days');

insert into cloud.ai_calls (user_id, month, capability, ok, usage, cost_usd, generation_id, at)
-- alice: heavy Jev use, 140 calls over the last 7 days
select '00000000-0000-0000-0000-00000000000a'::uuid, date_trunc('month', now())::date, 'judge', true, 9000, 0.003, null::text,
       now() - (n % 7) * interval '1 day' from generate_series(1, 140) n
union all -- bob: 10 Jev calls
select '00000000-0000-0000-0000-00000000000b'::uuid, date_trunc('month', now())::date, 'judge', true, 9000, 0.003, null::text,
       now() - (n % 5) * interval '1 day' from generate_series(1, 10) n
union all -- carol: 6 Jev calls, one refused upstream
select '00000000-0000-0000-0000-00000000000c'::uuid, date_trunc('month', now())::date, 'judge', n <> 6,
       case when n <> 6 then 9000 end, case when n <> 6 then 0.003 end, null,
       now() - (n % 3) * interval '1 day' from generate_series(1, 6) n
union all -- dave: 8 Jev calls, 20 days ago — outside 7 and 14 days, inside 30
select '00000000-0000-0000-0000-00000000000d'::uuid, date_trunc('month', now())::date, 'judge', true, 9000, 0.003, null::text,
       now() - interval '20 days' from generate_series(1, 8) n
union all -- alice: 4 narrations, the last one's cost never came back
select '00000000-0000-0000-0000-00000000000a'::uuid, date_trunc('month', now())::date, 'speech', true, 60,
       case when n <> 4 then 0.012 end, 'gen-sample-' || n, now() - n * interval '1 day' from generate_series(1, 4) n
union all -- alice: 2 cover images
select '00000000-0000-0000-0000-00000000000a'::uuid, date_trunc('month', now())::date, 'image', true, 1, 0.04, null,
       now() - n * interval '2 days' from generate_series(1, 2) n
union all -- carol: 1 cover image
select '00000000-0000-0000-0000-00000000000c'::uuid, date_trunc('month', now())::date, 'image', true, 1, 0.04, null,
       now() - interval '1 day';

insert into cloud.credit_spends (user_id, month, use, credits, at)
select '00000000-0000-0000-0000-00000000000a'::uuid, date_trunc('month', now())::date, 'speech', 60, now() - n * interval '1 day'
from generate_series(1, 4) n
union all
select '00000000-0000-0000-0000-00000000000a'::uuid, date_trunc('month', now())::date, 'image', 320, now() - n * interval '2 days'
from generate_series(1, 2) n
union all
select '00000000-0000-0000-0000-00000000000c'::uuid, date_trunc('month', now())::date, 'image', 320, now() - interval '1 day'
union all -- bob: narration from before calls were recorded — credits, no call row
select '00000000-0000-0000-0000-00000000000b'::uuid, date_trunc('month', now() - interval '40 days')::date, 'speech', 180,
       now() - interval '40 days';
