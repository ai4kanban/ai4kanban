# What `ui-design` was corrected on

One line per correction: the mistake, then the design to use instead.

## Before drawing

- **Redrew a confirmed mockup for a later copy round**: the confirmed screen stays; the other language is aligned to it.
- **Drew for a card that had already landed**: check the card is still in `todo/` first.
- **Revised only part of the affected screens**: a revision refreshes every affected screen and shared copy at once.
- **A second control for a job an existing one does**: reuse that feature's shape and interactions, changing only copy and actions.
- **Restyled shared chrome, or redrew a sibling's from memory**: shared chrome is out of scope; reread the sibling's frame, since siblings are compared side by side.
- **Changed a layer the user did not name** (asked for white paper, also removed the watercolour): change only what was named; when unsure, take the literal, smallest change.
- **Invented the app's words**: take strings from the app's i18n in the board's language; CLI-supplied delivery text stays English.
- **Invented branding, or a lookalike where a capture was wanted**: use the real logo and reference, or run the real surface and shoot it.
- **Drew a frame the app never shows**: the board cut at the edge, a card page inside its rail and chat, a dialog over what is behind it, a landed card still on its card page (it moves to its archive page).
- **Split one moment into several screens**: find the one state where they co-exist.
- **Drew a shared component for one content case, or skipped a workflow the scope lists**: draw every variant it renders (with and without images, slides), and for each listed workflow every draft component it actually produces.
- **One language for a card asking for 中英文**: draw each surface in both, sized against the English, which runs about a quarter longer.
- **A CLI workflow drawn as a screen**: keep commands as a short text block in the card.
- **A guide entry drawn as a link to the website**: reuse the app's in-place guide.

## What a screen may do

- **Never pick for the user**: where two answers are real, show both, and the one that throws work away says so.
- **A new fact earns a new mark or nothing**: never overload a slot; a mark needs a tip.
- **A typed name lives in one box on its action**: generated text beside it never repeats it.
- **A value to copy and its copy button read as one**: a long path is cut from the left.
- **Saving reads where the user typed**: an in-flight start relabels the pressed button.
- **No bulk retry over failures**: each row is a different run.
- **A source is a type plus key/value pairs**: never one free-text string.
- **Split content into fields its agent's rules never require**: render it as Markdown; one agent's habit is not a format.
- **Every item repeated actions and counts under stacked toolbars**: actions only on the focused item, one control row.
- **A form opened inside an item, or a new-item form as a panel under the list**: forms open outside the item; a new item is a row in the list, added by a control that matches the list.
- **A secondary action laid over content drawn with a text label**: draw it icon-only, its name in the tooltip.
- **批准按钮和「执行」难以区分**：批准放在待答问题的位置，按钮写明批准什么（如「批准线框」），与「执行」一眼可分，和同页的「修订」「移除」一样大。
- **手机上一组图横滑却看不出还有下一张**：改为单列竖排，或让下一张露出边缘。
- **tab 和页码用墨色胶囊或褐色底分段按钮**：用户嫌黑色重、褐色底难看；按 design.md「Tabs and pages」画成文字加短条，放在标题行右侧，手机落到标题下、可横向滚动。
- **Controls over an enlarged view drawn as white boxes with shadows** (page arrows, close, counter): semi-transparent dark round icons with a white glyph, darker on hover.
- **A switch that only fits two options**: a choice whose count can grow, such as language, goes in a dropdown showing the current value.

## Refusals, empty and after states

- **A refusal answers where it was pressed**: in the slot the thing would fill, or what replaced it; the page band is only for what has no control.
- **A refusal naming agents shows each one's character**: an agent name can equal a step name.
- **Removing a title row**: still keep a window name and a close.
- **An empty list gives no instruction that cannot be followed**: one honest line where the space is.
- **A config error hidden behind a hover tip, or as its own greyed row**: a page banner stating the cause, a warning icon on its list row.
- **Skipped the state after success**: draw it, saying what did NOT happen.
- **A waiting state missing facts the failure state asks for**: one panel, one submit, and the "nothing was made, and where it stuck" path drawn.

## Covering and clipping

- **An overlay always leaves a way off**: one in the pane head, one back in the top row, never a second close.
- **An enlarged panel covered the chat's input and its handoff buttons**: it stops above the input, which stays usable, and what is behind fades out whole, leaving no clipped fragments.
- **A thing gets a standing warning or a confirmation, never both**: a confirmation never hides what must be read first.
- **A hover bubble covered a rule or a clipped row's last item**: place it clear of both.
- **Cut a scroll through body text, never a caption**: fade a clipped panel into its ground.
- **A popover in a scrolling row got clipped**: it escapes via a copy drawn over the scroller.

## Characters and scenes

- **Characters differ by silhouette, pose and prop**: never a recolour or swapped hat.
- **Roster art comes from `kanban-ui/agent-art.md`**: an agent with none keeps its lettered card; an inherited art module must first inline what the new card needs.
- **Correct a sprite sheet against the base art**: keep proportions and shading, change only what the sheet adds.
- **A crowded activity scene with permanent detail panes**: spacious room, recent successes only, details on demand; draw capacity and completion states.
- **Labels stacked under a figure**: role and harness above the head, card id at the feet.
- **A busy machine drawn as a still, or a loop opening on an empty frame**: animate it and start on its telling frame, so a still render and reduced motion show it working.

## Explainer animations

- **Abstract metaphors, or uneven detail across pages**: every page plays one concrete product scene at the same level of detail.
- **A prop with a second reading**: mark what is spared as spared, and keep destructive words out of unrelated scenes.
- **Behaviour the product lacks, or a generic outcome**: show the real trigger and destination, such as a note landing in a named agent's memory.
- **翻页动画只挪高亮，或翻到一页就停住**：整份草稿按每一页重画，在 2–3 页间往返循环，页码、标题和备注跟着变。

## Wording and width

- **Vague or childish phrasing about mistakes**: professional Chinese that names the issue, e.g. "需求理解偏差".
- **提示与旁边的按钮自相矛盾**（「无需再次购买」配「恢复续费」）：按状态分别写提示，让文字和操作一致。
- **英文提示写得生硬、不像标准说法**（「No need to buy again」）：用产品界面常见的说法（「You're already subscribed to Pro.」）；介绍文案不写「五页」这类页数。
- **界面说明照搬内部机制**：用户不需要知道的直接删，不换说法。
- **A Chinese line written to its limit**: keep it a few characters under, or it orphans two or three.
- **Event words stay English in Chinese notification rows**: ids stay lowercase.
- **A one-line fact bar drawn for desktop only**: on a surface phones open, draw the narrow state too, one fact per line, nothing dropped.

## Figures and charts

- **A home-page figure invented a surface or a fictional sample task**: draw only real product surfaces, with sample content from AI4Kanban's own work.
- **AI4Kanban's pixel bots drawn for a rival or a generic agent**: the bots are our mascot; draw a generic agent figure.
- **A rival drawn with a ready flow it lacks**: draw what the user must build, e.g. an empty form, so it never reads as equal support.
- **Private memories drawn linked, as if shared**: each stays with its agent; shared memory connects only to the agents.
- **A comparison with prose, uneven diagrams and many inner borders**: one verdict line per column, aligned diagrams, only the outer frame.
- **Measured numbers and reported claims drawn alike**: a sourced figure links out; a reported one is unlinked and names who reported it.
- **Chart labels and arrows that break at phone width**: label as a legend on the heading row; the arrow stays inside the sentence.
- **A growing series drawn as bars**: use a line, with text kept outside the graphic.
- **首页一段只有文字没有画面，或给它硬配装饰小图**：并入相邻一节的导语，或整段删掉。
- **A figure longer than the one it replaced**: spend no extra lines.
- **A UI crop or multi-tile collage unreadable at the shown width**: crop to the one block, or show text instead; shrunken screenshots as card covers are noise.
- **Annotating a picture like markdown**: one whole-file note control, one numbering across both anchors.
- **A machine verdict mixed into the user's notes**: set it apart and say what it feeds into the next round.

## Rendering a mockup

- **Finished without looking at the render**: overflow only shows there; if no browser starts, say the frame was never seen.
- **A recording flattened to a still**: embed it so it still plays.
- **低清素材撑满整栏，放大后发糊**（如动效片段）：按素材原尺寸的一半左右封顶显示，旁边放侧栏。
- **Boxes stretched to fill**: give fixed heights, or copied panes collapse or clip.
- **Plain-text drawings re-wrapped**: hard-wrap them as the file would be.
- **Edited only a file the entry mockup imports**: the board redraws only when the entry file changes, so touch it too; never leave an image slot as an empty box.
