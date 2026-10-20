---
name: Coding
description: Use for software changes, and for any work no other workflow covers. Plans the change, then builds it.
needsArtifact: false
delivers: execute
pro: false
stages:
  plan:
    lead: software-planner
    helpers: every
  execute:
    lead: builder
scheduled:
  - agent: qa-manager
---
