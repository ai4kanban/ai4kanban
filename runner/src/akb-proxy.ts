// Preloaded into every akb the Runner starts (#435), so its lease renewals and syncs take the
// Runner's proxy route on every supported Node, and pick up a changed proxy within a minute.

import { followProxy } from './proxy'

followProxy()
setInterval(() => followProxy(), 60_000).unref()
