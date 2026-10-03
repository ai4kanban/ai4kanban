# 检查 main 上的 telemetry 改动是否已上线

## Setup

- **凭据**：本机已 `npx wrangler login`，或 `telemetry/.env` 里有 Cloudflare 凭据；`telemetry/node_modules` 已安装（工作区没有时借用主检出的）。
- **线上状态**：本次运行时 `t.ai4kanban.dev` 还没用 `npm run deploy` 部署过，`/health` 不报提交号；「落后若干提交」和「已是最新」两种结果要等部署后才能实跑。

## Steps

1. 在 `telemetry/` 下运行 `npm run check:live`。
   第一行写线上提交（此时为 `unknown`）和已应用的迁移数；随后说明线上 Worker 没有报出提交号、不是用 `npm run deploy` 部署的；退出码 1。
   [01-check-live.log](01-check-live.log)

2. 看 `npm run deploy` 会带上什么：运行 `node scripts/deploy.mjs --dry-run --env=""`（`deploy` 在迁移之后跑的就是它）。
   绑定里多了 `COMMIT` 环境变量（wrangler 隐藏了值），`COPY` 仍是 `production`；`--dry-run` 不上传。
   [02-deploy-dry-run.log](02-deploy-dry-run.log)

3. 用同样算出的提交号在本地起 Worker（`wrangler dev --var COMMIT:<提交号>`），请求 `/health`。
   返回里多一个 `commit` 字段，值是 HEAD 的短提交号。
   [03-health-with-commit.log](03-health-with-commit.log)（没有真的部署线上：那是对外发布）

4. 在一份没装依赖的新副本里运行 `npm run check:live`。
   只输出一行原因「wrangler is not installed: run `npm install` in telemetry/.」，退出码 2。
   [04-cannot-check.log](04-cannot-check.log)

5. 等每日「上线检查」Agent 跑过一次，打开看板的「待分拣」。
   出现一条「Telemetry is behind main」，正文是第 1 步输出的第一行加「Run `cd telemetry && npm run check:live` to see what is waiting.」。
   未证明：这一步要起真实的定时 Agent，本次没有运行。

## Feedback

- **一条命令就知道该不该部署**：几秒出结果，第一行就是线上停在哪里，退出码可以直接接脚本。
- **第一次跑必然报「落后」**：落地后、首次 `npm run deploy` 前，检查一直报提交号未知；输出说了原因，但没直接说「运行 `npm run deploy` 即可」。
- **工作区里也能跑**：没有 `node_modules` 时自动借主检出的 wrangler，不用先装依赖。
- **`--dry-run` 看不到提交号**：wrangler 把 `COMMIT` 的值隐藏了，想确认带的是哪个提交只能部署后看 `/health`。
- **落后与最新两种结果未实跑**：要等线上用新脚本部署一次后再补。
