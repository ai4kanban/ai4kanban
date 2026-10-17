#!/bin/zsh
# Builds the scratch project for this case: card #2 holds a 4:3 deck whose pages are an HTML
# page in a subfolder, a TSX page and a page whose file is missing, plus a two-page deck that
# sets no size.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
akb raw create --title "季度复盘演示文稿" --slug deck > /dev/null
A=$(node -e "import('$(dirname $CLI)/../dist/kanban.mjs').then(m=>console.log(m.assetsDir()))")/2
mkdir -p "$A/pages"

# A circle and a frame on the canvas edge show whether the page is stretched or cropped.
cat > "$A/pages/cover.html" <<'HTML'
<!doctype html>
<html><body style="margin:0;width:1440px;height:1080px;box-sizing:border-box;border:12px solid #1d3557;background:#f1faee;font-family:system-ui;color:#1d3557">
<div style="position:absolute;left:520px;top:160px;width:400px;height:400px;border-radius:50%;background:#e63946"></div>
<h1 style="position:absolute;left:0;right:0;top:620px;text-align:center;font-size:96px;margin:0">2026 Q3 复盘</h1>
<p style="position:absolute;left:0;right:0;top:780px;text-align:center;font-size:40px;margin:0">产品组 · 十月</p>
<a id="data" href="https://example.com/q3" style="position:absolute;left:0;right:0;top:900px;text-align:center;font-size:36px">查看原始数据</a>
</body></html>
HTML

cat > "$A/pages/growth.tsx" <<'TSX'
export default function Growth() {
  const bars = [32, 48, 61, 87];
  return (
    <div style={{ width: 1440, height: 1080, background: "#fff", padding: 96, boxSizing: "border-box", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 72, margin: 0, color: "#1d3557" }}>周活跃增长 +87%</h1>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 64, height: 640, marginTop: 120 }}>
        {bars.map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, background: "#457b9d", color: "#fff", fontSize: 40, textAlign: "center" }}>Q{i + 1}</div>
        ))}
      </div>
    </div>
  );
}
TSX

cat > "$A/wide-1.html" <<'HTML'
<!doctype html>
<html><body style="margin:0;width:1920px;height:1080px;box-sizing:border-box;border:12px solid #2a9d8f;background:#fefae0;font-family:system-ui">
<div style="position:absolute;left:760px;top:140px;width:400px;height:400px;border-radius:50%;background:#e9c46a"></div>
<h1 style="position:absolute;left:0;right:0;top:640px;text-align:center;font-size:96px;margin:0;color:#264653">宽屏版</h1>
</body></html>
HTML
sed 's/宽屏版/谢谢/; s/#e9c46a/#f4a261/' "$A/wide-1.html" > "$A/wide-2.html"

slide() { printf '{"id":"%s","title":"%s","copy":["%s"],"layout":"%s","assets":[],"preview":{"src":".assets/2/%s","alt":"%s"}}' "$@" }
cat > "$A/deck.json" <<JSON
{"version":1,"size":{"width":1440,"height":1080},"slides":[
$(slide cover 封面 "2026 Q3 复盘" cover pages/cover.html 封面),
$(slide growth 增长 "周活跃增长 +87%" chart pages/growth.tsx 增长柱状图),
$(slide end 结尾 谢谢 cover pages/end.html 结尾页)
]}
JSON
cat > "$A/wide.json" <<JSON
{"version":1,"slides":[
$(slide wide1 封面 宽屏版 cover wide-1.html 宽屏封面),
$(slide wide2 结尾 谢谢 cover wide-2.html 宽屏结尾)
]}
JSON

awk 'f < 2 { print } /^---$/ { f++ }' docs/kanban/todo/2-deck.md > card.new
cat >> card.new <<'CARD'

季度复盘用的演示文稿，每页是一份静态页面。

<Storyboard src=".assets/2/deck.json" label="季度复盘 4:3" />

<Storyboard src=".assets/2/wide.json" label="宽屏版" />

<!-- agent -->

## Todo

- [ ] 写结尾页

## Decided by the agent

### Overruled by the user
CARD
mv card.new docs/kanban/todo/2-deck.md
git add -A && git commit -qm init
