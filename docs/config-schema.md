# Config Schema

Last reviewed: 2026-05-15

## Role Profile

Role profiles live in `configs/roles/*.yaml`.

Required:

- `id`: stable CLI id.
- `label`: human-readable name.
- `must_have`, `should_have`, `nice_to_have`: positive weighted terms.
- `negative`: negative weighted terms.
- `hard_filters`: deterministic rejects.
- `review_policy`: how much ranked output Codex should review.
- `batch_policy`: queue defaults.

Example:

```yaml
id: embedded-linux
label: 嵌入式 Linux 驱动
version: 1
must_have:
  - term: "Linux"
    weight: 15
negative:
  - term: "销售"
    weight: -30
hard_filters:
  min_salary: null
  max_experience_years: null
  cities: []
  reject_internship: true
  reject_part_time: true
ranking_policy:
  use_default_terms: false
review_policy:
  codex_review_top_n: 40
  codex_review_borderline_n: 20
  require_evidence: true
  allow_uncertain: false
batch_policy:
  max_per_batch: 15
  batch_cooldown_ms: 45000
  jitter_ms: 10000
  stop_on_access_limited: true
```

## Batch Policy

Global defaults live in `configs/batch.yaml`. A role profile can override them.

Default behavior:

- `max_per_batch: 15`
- `batch_cooldown_ms: 45000`
- `jitter_ms: 10000`
- `stop_on_access_limited: true`

Use `--confirm-large` only when the user explicitly asked for more than 15 tabs per batch.

## Browser Config

Optional browser defaults live in `configs/browser.yaml`:

```yaml
browser_exe: null
browser_profile: null
```

Resolution order:

1. `JOB_BOARD_BROWSER_EXE`
2. `configs/browser.yaml` `browser_exe`
3. Edge Beta default path
4. Edge stable default path
5. Chrome default path

`JOB_BOARD_BROWSER_PROFILE` can override `browser_profile`.

## Site Adapters

Site modules live under `src/sites/` and are registered in `src/sites/registry.mjs`.
Current adapters are `boss`, `liepin`, and `51job`. Each adapter owns search URL
detection, detail URL canonicalization, and access-limit detection for its site.

## Validation Rules

- `must_have`, `should_have`, `nice_to_have`, and `negative` must be lists.
- Term weights must be numeric.
- `hard_filters.cities` must be a list.
- `reject_internship` and `reject_part_time` must be booleans.
- `hard_filters.min_salary` is interpreted as monthly K when salary text is parseable.
- `hard_filters.max_experience_years` rejects jobs whose stated maximum years exceed the configured value.
- `ranking_policy.use_default_terms` defaults to `false` for durable profiles so built-in demo terms do not leak into profile ranking.
- `review_policy.codex_review_top_n` and `codex_review_borderline_n` must be positive integers.
- `batch_policy.max_per_batch` must be between 1 and 20. Values above 15 still require `--confirm-large` at open time.
- `batch_cooldown_ms` and `jitter_ms` must be non-negative numbers.
- `stop_on_access_limited` must be boolean.
