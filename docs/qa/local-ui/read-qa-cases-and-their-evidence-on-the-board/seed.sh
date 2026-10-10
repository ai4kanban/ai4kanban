#!/bin/zsh
# Builds the scratch project for this case: a fresh board with two QA cases under
# docs/qa/checkout/. "pay-with-a-saved-card" has its screenshot and log under .akb/qa/ (this
# computer ran it); "apply-a-coupon-at-checkout" has none here (run on another computer).
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md

case_md() { # <slug> <title> <first step> <first result> <second step> <second result>
  mkdir -p docs/qa/checkout/$1
  cat > docs/qa/checkout/$1/case.md <<MD
# $2

## Setup

- **商店**：一个测试账号，购物车里有一件 39 元的 T 恤。

## Steps

1. $3
   $4
   ![结算页](01-checkout.png)

2. $5
   $6
   [支付日志](02-pay.log)

## Feedback

- **按钮好找**：结算按钮就在购物车底部。
MD
}
case_md pay-with-a-saved-card "用保存的银行卡付款" "打开购物车，点「去结算」。" "结算页列出已保存的银行卡。" "选尾号 4242 的卡，点「付款」。" "页面显示「支付成功」。"
case_md apply-a-coupon-at-checkout "在结算时使用优惠券" "打开购物车，点「去结算」。" "结算页有「优惠券」输入框。" "输入 SAVE10，点「使用」。" "总价从 39 元变成 29 元。"

# Evidence for the first case only, outside git (#1550).
E=.akb/qa/checkout/pay-with-a-saved-card
mkdir -p $E
node -e '
// A 480x160 PNG: a light card with a dark bar, enough to see an image is drawn.
const zlib = require("zlib"), fs = require("fs"), W = 480, H = 160
const raw = Buffer.alloc((W * 3 + 1) * H)
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const o = y * (W * 3 + 1) + 1 + x * 3, bar = y > 60 && y < 100 && x > 40 && x < 440
  raw[o] = bar ? 230 : 245; raw[o + 1] = bar ? 90 : 240; raw[o + 2] = bar ? 40 : 230
}
const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2
fs.writeFileSync(process.argv[1], Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]))
' $E/01-checkout.png
printf 'POST /pay card=4242 amount=39.00\n200 OK {"status":"paid"}\n' > $E/02-pay.log
git add -A && git commit -qm init
