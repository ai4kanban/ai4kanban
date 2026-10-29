# 未登录调用公开 API

## Setup

- 终端里有 `curl`；不带任何登录令牌或 API key。

## Steps

1. 请求 `GET /health`、`GET /v1/session`、`GET /v1/projects`。
   预期：`/health` 返回 200 和 `ok: true`；另外两个返回 401，错误码 `unauthenticated`
   并提示先登录。
   证据：[01-signed-out.log](01-signed-out.log)
2. 带一个无效 API key（`Authorization: Bearer wck_…`）请求 `GET /v1/projects`。
   预期：401 `unauthenticated`，提示该 key 无效或已撤销。
   证据：[02-bad-key.log](02-bad-key.log)
3. 请求 `GET /v1/openapi.json`。
   预期：无需登录即可拿到 OpenAPI 文档（WildCrane API 1.0.0，列出全部路由）。
   证据：[03-openapi.log](03-openapi.log)

## Feedback

错误格式统一、可程序判断，无效 key 有单独的提示，OpenAPI 文档公开可取，接入门槛低。
小瑕疵：`/v1/session` 本来就是用来问「我是谁」的，未登录时却说「Sign in to reach this
workspace」，措辞不贴切。用有效 key 调用需要真实账号，本用例未覆盖。
