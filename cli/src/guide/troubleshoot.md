# Troubleshoot software failures

Trace the causal chain from the observed failure, distinguishing its trigger from any system gap that lets it persist or spread.
Use code, logs, or reproduction evidence to test candidate causes; when evidence is insufficient, state what remains uncertain and the next check that would distinguish them.
For example, if an external API outage leaves a job stuck retrying forever, check whether fault handling is missing or ineffective rather than assuming the outage alone explains the failure or that one mechanism is always the answer.
Identify the system behavior that needs to change and how reproducing the trigger would verify recovery or bounded failure, keeping investigation and any actual changes within the current session's operating boundaries.
