-- 一个 Cloud workspace：1 号在看板上，2–5 号已归档，每张卡都有交付记录。
-- 交付走的是机器真实调用的 api.open_delivery / api.confirm_delivery。
insert into cloud.accounts (id, handle) values ('00000000-0000-4000-8000-0000000000a1', 'qa-owner');
select api.create_workspace('00000000-0000-4000-8000-0000000000a1', 'qa-create', 'QA board', 100000) is not null as workspace_created \gset
select id as ws from cloud.workspaces where name = 'QA board' \gset
select api.write_cards('00000000-0000-4000-8000-0000000000a1', :'ws', 'qa-cards', null, $j$[
  {"id":1,"expect":"","data":{"title":"still on the board"}},
  {"id":2,"expect":"","data":{"title":"shipped"}},
  {"id":3,"expect":"","data":{"title":"shipped too"}},
  {"id":4,"expect":"","data":{"title":"archived last week"}},
  {"id":5,"expect":"","data":{"title":"deleted before the upgrade"}}
]$j$::jsonb, 100000) is not null as cards_written \gset
create temp table qa_open (n serial, card int, outcome text);
insert into qa_open (card, outcome) values
  (2, 'completed'), (2, null), (3, 'failed'), (4, 'completed'), (5, 'completed'), (5, null);
do $$
declare r record; v json;
begin
  for r in select * from qa_open order by n loop
    v := api.open_delivery('00000000-0000-4000-8000-0000000000a1', (select id from cloud.workspaces where name = 'QA board'),
                           'qa-open-' || r.n, null, r.card, 100000);
    if r.outcome is not null then
      perform api.confirm_delivery('00000000-0000-4000-8000-0000000000a1', (select id from cloud.workspaces where name = 'QA board'),
                                   'qa-confirm-' || r.n, null, (v ->> 'id')::uuid, r.outcome, '{}'::jsonb, 100000);
    end if;
  end loop;
end $$;
-- 2–5 号归档（看板把卡写成 archived 的同一个入口）。
select api.write_cards('00000000-0000-4000-8000-0000000000a1', :'ws', 'qa-archive', null, (
  select jsonb_agg(jsonb_build_object('id', card_id, 'expect', revision::text, 'archived', true, 'data', data))
  from cloud.workspace_cards where workspace_id = :'ws' and card_id between 2 and 5
), 100000) is not null as archived \gset
