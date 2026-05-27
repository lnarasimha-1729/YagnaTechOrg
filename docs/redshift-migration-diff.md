# Redshift Migration — Schema Diff Report

Generated: 2026-05-25T08:13:41.264Z

Source (MySQL): `lms_admin` + `lucy_devdb`
Target (Redshift): `lms_admin` + `lucy_devdb` schemas in `dev` database

Identifier comparison is case-insensitive (Redshift folds to lowercase).

---

## lms_admin  (MySQL: lms_admin)

### Tables MISSING in Redshift (would lose data on cutover)

- `batch_members` — has 5 columns in MySQL, 0 in Redshift
- `batches` — has 9 columns in MySQL, 0 in Redshift
- `programs` — has 12 columns in MySQL, 0 in Redshift

### `certificates`

**Type mismatches:**

| Column | MySQL | Redshift |
|---|---|---|
| `issued_at` | datetime | date |

### `courses`

**Columns in MySQL but missing in Redshift:**

| Column (MySQL) | Type | Nullable |
|---|---|---|
| `has_certificate` | tinyint | NO |

**Type mismatches:**

| Column | MySQL | Redshift |
|---|---|---|
| `is_paid` | tinyint | bool |
| `is_best` | tinyint | bool |
| `discount_flag` | tinyint | bool |
| `enable_drip_content` | tinyint | bool |

### `languages`

**Type mismatches:**

| Column | MySQL | Redshift |
|---|---|---|
| `is_default` | tinyint | bool |

### `live_classes`

**Type mismatches:**

| Column | MySQL | Redshift |
|---|---|---|
| `class_date_and_time` | datetime | date |

### `pre_assessment_results`

**Type mismatches:**

| Column | MySQL | Redshift |
|---|---|---|
| `passed` | tinyint | bool |

### `user_progress`

**Type mismatches:**

| Column | MySQL | Redshift |
|---|---|---|
| `enrolled` | tinyint | bool |

### `users`

**Type mismatches:**

| Column | MySQL | Redshift |
|---|---|---|
| `email_verified_at` | datetime | date |

## lucy_devdb  (MySQL: lucy_devdb)

### Tables MISSING in Redshift (would lose data on cutover)

- `certificates` — has 12 columns in MySQL, 0 in Redshift
- `settings` — has 5 columns in MySQL, 0 in Redshift

### `assessments`

**Columns in MySQL but missing in Redshift:**

| Column (MySQL) | Type | Nullable |
|---|---|---|
| `clgIds` | json | NO |
| `courseIds` | json | NO |

### `courses`

**Type mismatches:**

| Column | MySQL | Redshift |
|---|---|---|
| `isPreAssessmentNeeded` | tinyint | bool |

### `pre_assessment_registrations`

**Type mismatches:**

| Column | MySQL | Redshift |
|---|---|---|
| `declarationAccepted` | tinyint | bool |

### `program_requests`

**Columns in MySQL but missing in Redshift:**

| Column (MySQL) | Type | Nullable |
|---|---|---|
| `id` | int | NO |
| `note` | varchar(500) | YES |

### `users`

**Columns in MySQL but missing in Redshift:**

| Column (MySQL) | Type | Nullable |
|---|---|---|
| `quizScores` | json | YES |
| `postScoreDuration` | int | YES |

---

## Summary

- Tables missing in Redshift: **5** (each one = data loss on cutover)
- Columns missing in Redshift: **7** (each one = data loss on cutover)
- Type mismatches: **12** (may cause COPY failures or silent truncation)

## What to do

1. For each missing table, decide: create in Redshift (write DDL) or accept feature breaking?
2. For each missing column, decide: add to Redshift, or accept the data going away?
3. For each type mismatch, design the cast (usually safe but worth confirming numeric/date columns).
