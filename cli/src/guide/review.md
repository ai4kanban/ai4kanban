# Review a delivery

You lead the review stage. The workflow names its reviewers; you decide which of them this
diff needs, then review as each of them in this run. A successful run with no new question
passes; a question appended to the card waits for the user's answer.

1. Read the delivery's diff and the card it was approved to build. When the flow marks a
   **focused post-rebase review**, only the named target delta and shared paths are in scope.
2. Pick the reviewers. They are listed under `<reviewers>` with what each one checks. Choose
   every reviewer whose description matches what the diff touches; when none matches, choose
   the first on the list. Say in one line each which you chose and why.
3. Review as each chosen reviewer, in list order: print its instructions with
   `akb spec <reviewer> <id> --print` and follow them to the end — its checks, its fixes and
   its verdict — before starting the next. A fix is made in the delivery's worktree, and the
   next reviewer reads the fixed diff.
4. The delivery passes when every chosen reviewer passed. A `[user]` question a reviewer
   appended to the card is this run's answer: stop there.

- **Nothing of your own**: judge only what the reviewers judge; what you add is the choice of
  who looks.
- **Never widen the list**: an agent the workflow did not name is not a reviewer here, however
  well the diff would suit it.
