#!/bin/zsh
# Builds the scratch project for this case: card #2 shows a desktop mockup with small print,
# a phone mockup and a 2400×1350 image.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>   (needs ffmpeg)
set -e
P=$1 CLI=$2
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
akb raw create --title "订单页改版" --slug order-page > /dev/null
A=$(node -e "import('$(dirname $CLI)/../dist/kanban.mjs').then(m=>console.log(m.assetsDir()))")
mkdir -p "$A/2"

cat > "$A/2/orders.tsx" <<'TSX'
export default function Orders() {
  const rows = Array.from({ length: 14 }, (_, i) => i + 1);
  return (
    <div className="min-h-screen bg-stone-50 p-8 font-sans text-stone-800">
      <h1 className="text-2xl font-bold">订单</h1>
      <p className="mt-1 text-[11px] text-stone-500">右下角小字：退款在 3 个工作日内原路退回</p>
      <table className="mt-6 w-full text-xs">
        <tbody>
          {rows.map((n) => (
            <tr key={n} className="border-b border-stone-200">
              <td className="py-2">#{1000 + n}</td><td>客户 {n}</td><td className="text-right">¥{n * 37}.00</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-6 text-right text-[10px] text-stone-400">第 1 / 9 页 · 每页 14 条</p>
    </div>
  );
}
TSX

cat > "$A/2/orders-phone.html" <<'HTML'
<!doctype html>
<html><body style="margin:0;font:14px system-ui;background:#fafaf9;color:#292524">
<h1 style="font-size:20px;margin:16px">订单</h1>
<p style="font-size:10px;margin:0 16px;color:#78716c">下拉刷新 · 最近 30 天</p>
<ul style="list-style:none;padding:0 16px">
<li style="padding:10px 0;border-bottom:1px solid #e7e5e4">#1001 客户 1 · ¥37.00</li>
<li style="padding:10px 0;border-bottom:1px solid #e7e5e4">#1002 客户 2 · ¥74.00</li>
<li style="padding:10px 0;border-bottom:1px solid #e7e5e4">#1003 客户 3 · ¥111.00</li>
</ul></body></html>
HTML

ffmpeg -loglevel error -f lavfi -i "color=c=0x2a9d8f:s=2400x1350" -frames:v 1 \
  -vf "drawbox=x=0:y=600:w=2400:h=150:c=black:t=fill,drawbox=x=1150:y=0:w=100:h=1350:c=0xe9c46a:t=fill" "$A/2/sales-chart.png"

awk 'f < 2 { print } /^---$/ { f++ }' docs/kanban/todo/2-order-page.md > card.new
cat >> card.new <<'CARD'

订单页换成表格，手机上改成列表。

<Asset src=".assets/2/orders.tsx" label="订单页（桌面）" device="desktop" />

<Asset src=".assets/2/orders-phone.html" label="订单页（手机）" device="mobile" />

<Asset src=".assets/2/sales-chart.png" label="销售趋势图" />

<!-- agent -->

## Scope

- **订单页**：表格分页。

## Todo

- [ ] 改订单页

## Decided by the agent

### Overruled by the user
CARD
mv card.new docs/kanban/todo/2-order-page.md
git add -A && git commit -qm init
