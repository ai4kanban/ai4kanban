# 在 Cloud 看板上，删掉的归档卡片带走它已结束的交付记录

## Setup

- **看板**：一个存储在 Cloud workspace 里的看板；1 号卡在看板上，2–5 号已归档，每张卡都有交付记录，其中 2 号和 5 号各有一次还在进行（`open`）。
- **触发**：归档卡片满 30 天由看板的每日清理向 Cloud 发删除请求（见 [skill 的用例](../../skill/undated-archived-cards-expire-on-a-cloud-board/case.md)）；本用例看的是 Cloud 收到请求后，workspace 的交付记录（`GET /workspaces/<id>/deliveries`，即 `api.read_deliveries`）还剩什么。
- **本次证据的来源**：这台机器没有 Cloud 凭据。证据由 [run.sh](run.sh) 在一次性 PostgreSQL 上跑出：装上 Supabase 桩和 `cloud/migrations/` 的真实迁移，用 [seed.sql](seed.sql) 通过机器真实调用的 `api.*` 函数建 workspace、卡片和交付，再调用每日清理所走的 `api.delete_archived_cards`。没有经过 Worker，也没有对线上 Cloud 验证。重现：`docs/qa/cloud/deleted-archived-cards-take-their-deliveries-with-them/run.sh`（需要 PATH 上有 `initdb`、`pg_ctl`、`psql`）。

## Steps

1. 升级前（迁移装到 0037），查看归档和交付记录。
   归档有 2–5 号，六条交付记录分属 2–5 号。
   [01-before.log](01-before.log)

2. 升级前，每日清理删掉到期的 5 号。
   5 号从归档消失，但它的两条交付记录（`completed`、`open`）都还在，指向一张不存在的卡。
   [02-old-delete-leaves-records.log](02-old-delete-leaves-records.log)

3. 升级 Cloud（应用 0038、0039）。
   5 号已结束的那条记录被清掉；仍在进行的那条留下。其他卡的记录不变。
   [03-upgrade-clears-old-records.log](03-upgrade-clears-old-records.log)

4. 升级后，每日清理删掉到期的 2、3 号（4 号未到期）。
   2 号已结束的记录和 3 号的记录随卡一起删除；2 号仍在进行的记录、未到期 4 号的记录都留下。
   [04-delete-takes-records.log](04-delete-takes-records.log)

## Feedback

- **用户感知不到，这是对的**：清理的是指向已删除卡片的内部数据，看板上的卡片、归档的剩余卡片都不受影响。
- **仍在进行的记录会一直留着**：卡片已删、交付还是 `open` 的记录（本例的 2 号、5 号）没有人收尾，用户也看不到它们，只能等那台机器自己报告结束。
- **删掉无法恢复，也不提示**：已删除卡片的落地记录一并消失，之后想查「那张卡当初是怎么落地的」在 Cloud 上已无从查起；删除时没有任何提示。
- **未在真实 Cloud 上验证**：证据来自一次性数据库上的真实迁移，Worker 的路由和线上迁移是否已应用没有核对过。
