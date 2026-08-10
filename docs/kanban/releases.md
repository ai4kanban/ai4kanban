# Releases

The versions this board is planning, in the order they ship — one line per release.
`release new <id>` adds one to the end. Closing a release takes its line away, so this
file only ever shows what is still ahead.

A card says which release it ships in. A card that says nothing is in no release —
wanted, but not promised to a version.

The order is whatever the lines say, so a hand edit is how you reorder. What comes after
the em dash is the release's goal — what this version is for, in your own words.

- **0.6.0** — - [ ] UI优先（或者说看板优先）：通过Skill进行首次安装和配置的不可控因素太多，用户的主要操作应该通过GUI，Skill只作为后续可选项。 - [ ] 桌面端：考虑到人负责取舍而非执行，人应该可以在任意设备上提供决策，而不仅是web浏览器。 - [ ] CLI：与agent harness的交互、看板管理都封装在CLI中，UI后端通过CLI进行看板/agent操作，这使得Skill能够实现UI同样的功能。 实现上述功能。
