---
name: job-feedback-update
description: Convert user feedback about opened jobs into profile update suggestions.
---

# Job Feedback Update

Use this when the user marks jobs as false positives, false negatives, or useful matches.

## Workflow

1. Read the run artifacts under `.tmp/job_board_harness/runs/<run_id>/` when available.
2. Record structured feedback with `.\tools\job-board.cmd feedback --run <run_id> --accepted <id> --false-positive <id> --false-negative <id> --suggest-profile-patch`.
3. Group feedback by signal: missing positive term, overly broad term, negative term needed, hard filter needed, or site extraction issue.
4. Review the generated `profile_patch.json`; keep it small and reasoned.
5. Save changes only after the user confirms:
   `.\tools\job-board.cmd profile apply-patch --profile <profile> --patch <profile_patch.json> --reason "user confirmed"`
6. Roll back with `.\tools\job-board.cmd profile rollback --profile <profile> --history <config_history.json>` if the patch harms ranking.

## Guardrails

Do not store raw contact values. Do not add external model/API configuration. Keep changes scoped to local YAML config and task reports.
