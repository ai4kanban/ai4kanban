# Turns a scratch board back into one from before the social post illustrator shipped: its
# Social post plan helpers written down with no illustrator, and the illustrator not yet
# recorded as added. Run from the project folder while the board UI is closed or idle.
import json
f = '.akb/boards/docs/kanban/ui.config.json'
d = json.load(open(f))
w = d['workflows']
w['stages']['carousel-post'] = {'plan': {'helpers': []}}
w['shipped'] = [s for s in w['shipped'] if s != 'social-illustrator']
json.dump(d, open(f, 'w'), indent=2, ensure_ascii=False)
