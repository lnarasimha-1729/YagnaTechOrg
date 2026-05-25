# YagnaTech LMS — Database Architecture Documentation

> **Document type:** Reverse-engineered enterprise database architecture report
> **Date:** 2026-05-22
> **Scope:** All backend microservices under `backend/`
> **Authoring source:** Live codebase only (no external assumptions)

---

## Executive Summary

YagnaTech is a multi-service Learning Management System built on **MySQL 8 (AWS RDS)** with **Sequelize ORM** in Node.js. The architecture is *microservice-style with shared physical infrastructure*: every service points at the same RDS instance (`lucy-devdb.cu1kcwwqaaqb.us-east-1.rds.amazonaws.com`), but is logically partitioned across **two MySQL schemas**:

| Schema | Owner Service | Role |
|---|---|---|
| `lucy_devdb` | `auth-service`, `course-service`, `assessment-service`, `college-service`, `organization-service`, `payment-service` | Identity, catalog, assessments, college org-tree |
| `lms_admin` | `admin-service` | LMS content (Laravel-style: categories, lessons, sections, certificates, forums, progress) |

Cross-schema referential integrity is **not enforced at the DB layer**; foreign keys spanning schemas are enforced at the application/service layer (a pattern explicitly documented in many model files). The `admin-service` opens a **second Sequelize handle** (`authDb`) to read/write `lucy_devdb` directly when cross-schema queries are needed (e.g. College Dashboard KPIs, instructor profile photos, program request workflows).

There are **24 ORM-defined tables + 1 undeclared raw-SQL table** (`program_requests`), for a documented total of **25 tables** across the two schemas. Schema is propagated by `sequelize.sync()` on boot; explicit migration files exist only for backfills on already-deployed databases.

---

## 1. Database Overview

### 1.1 Databases in Use

| # | Database | Engine | Host | Schema Type | Purpose |
|---|---|---|---|---|---|
| 1 | **`lucy_devdb`** | MySQL 8 | `lucy-devdb.cu1kcwwqaaqb.us-east-1.rds.amazonaws.com:3306` | Identity + Catalog + Org | Users, Roles, Courses (canonical), Enrollments, Colleges, Branches, Organisations, Assessments, Questions, QuestionSets, Pre-Assessment Registrations, Program Requests |
| 2 | **`lms_admin`** | MySQL 8 | Same RDS host | LMS content + progress | Categories, Courses (Laravel-style), Lessons, Sections, Questions (quiz), Quiz Submissions, Live Classes, Coupons, Certificates, Forums, Forum Reports, User Progress, Lesson Completions, Lesson Watch Progress, Pre-Assessment Results, Settings, Languages, SEO Fields |

### 1.2 Database Technologies

| Technology | Where Used |
|---|---|
| **MySQL 8** (AWS RDS) | All services — `dialect: 'mysql'` in every Sequelize config |
| **Sequelize ORM (v6 style)** | All 7 services |
| **AWS RDS (us-east-1)** | Single managed instance hosts both schemas |
| **Raw SQL (via `sequelize.query`)** | Cross-schema joins (`StudentService`, `CollegeDashboardService`), idempotent ALTERs (`server.js` boot hooks), `program_requests` CRUD |
| **bcryptjs / bcrypt** | Password hashing in user tables (both schemas have separate `users`) |

### 1.3 Connection Architecture

```
┌─────────────────────────────────────────────────────────────┐
│            AWS RDS — lucy-devdb (us-east-1, MySQL 8)         │
│                                                              │
│   ┌─────────────────┐         ┌───────────────────────┐     │
│   │  lucy_devdb     │         │  lms_admin            │     │
│   │  (auth schema)  │         │  (admin schema)       │     │
│   └────────┬────────┘         └──────────┬────────────┘     │
└────────────┼─────────────────────────────┼──────────────────┘
             │                             │
       Writers/Readers              Writer/Reader
             │                             │
 ┌───────────┴───────────┐     ┌──────────┴─────────┐
 │ auth-service          │     │ admin-service      │
 │ course-service        │     │  ├─ primary db→    │
 │ assessment-service    │     │  │   lms_admin     │
 │ college-service       │     │  └─ authDb→        │
 │ organization-service  │     │      lucy_devdb    │
 │ payment-service       │     │      (read+write)  │
 └───────────────────────┘     └────────────────────┘
```

`Bastion-server` is an HTTP proxy/gateway only — **no database connection**.

### 1.4 Environment-Based Configuration Switching

Every service reads `DB_HOST / DB_PORT / DB_USER / DB_PASS / DB_NAME` from its own `.env`. There is no formal "dev/stage/prod" matrix file; switching environments is done by swapping the `.env` values. Admin-service additionally reads `AUTH_DB_NAME` (defaults to `lucy_devdb`) to wire the cross-schema handle in [backend/admin-service/src/config/env.js:22-29](backend/admin-service/src/config/env.js#L22-L29).

### 1.5 Multi-Tenant / Multi-DB Pattern

- **Logical tenancy:** by `clgId` (college) propagated through:
  - `users.collegeId` (auth)
  - `courses.clgIds` JSON array (course-service)
  - `courses.clg_ids` JSON array (admin-service `lms_admin.courses`)
  - `categories.clg_ids` JSON array (admin-service)
  - `colleges.branchIds` JSON array
- **Multi-DB:** dual-schema as described above. `admin-service` is the only service that holds TWO Sequelize handles.

---

## 2. Database Configuration Analysis

### 2.1 Connection Files

| Service | File | Notes |
|---|---|---|
| auth-service | [backend/auth-service/src/db/index.js](backend/auth-service/src/db/index.js) | Hardened: retry matchers, keep-alive, pool {max:10} |
| course-service | [backend/course-service/src/db/index.js](backend/course-service/src/db/index.js) | Minimal — no pool/retry |
| assessment-service | [backend/assessment-service/src/db/index.js](backend/assessment-service/src/db/index.js) | Minimal |
| college-service | [backend/college-service/src/db/sequelize.js](backend/college-service/src/db/sequelize.js) | Minimal |
| organization-service | [backend/organization-service/src/db/index.js](backend/organization-service/src/db/index.js) | Minimal |
| payment-service | [backend/payment-service/src/db/sequelize.js](backend/payment-service/src/db/sequelize.js) | Minimal |
| admin-service (primary) | [backend/admin-service/src/config/database.js](backend/admin-service/src/config/database.js) | Hardened: pool, retry, keep-alive |
| admin-service (auth handle) | [backend/admin-service/src/config/authDatabase.js](backend/admin-service/src/config/authDatabase.js) | Cross-schema reader/writer — pool {max:5} |

### 2.2 Environment Variables

| Variable | Used By | Sample |
|---|---|---|
| `DB_HOST` | all DB services | `lucy-devdb.cu1kcwwqaaqb.us-east-1.rds.amazonaws.com` |
| `DB_PORT` | all | `3306` |
| `DB_USER` | all | `SimaxLMSAdmin` |
| `DB_PASS` | all | (leaked plaintext — see §9 security) |
| `DB_NAME` | all | `lucy_devdb` / `lms_admin` |
| `DB_DIALECT` | admin-service | `mysql` (default) |
| `AUTH_DB_NAME` | admin-service only | `lucy_devdb` |
| `COLLEGE_SERVICE_HOST/PORT` | course-service | App-layer validation peer |

### 2.3 Pooling Configuration

| Service | max | min | acquire | idle | evict |
|---|---|---|---|---|---|
| auth-service | 10 | 0 | 60000 | 10000 | 15000 |
| admin-service (primary) | 10 | 0 | 60000 | 10000 | 15000 |
| admin-service (authDb) | 5 | 0 | 60000 | 10000 | — |
| course/college/assessment/org/payment | *Sequelize defaults* (max 5) | — | — | — | — |

### 2.4 ORM Configuration

- **Sequelize v6**, ESM in `auth/course/assessment/college/organization/payment`, CommonJS in `admin-service`.
- `logging: false` everywhere.
- admin-service uses `{ underscored: false, freezeTableName: true }` and `created_at` / `updated_at` column names (Laravel convention).
- All other services use Sequelize defaults (`createdAt` / `updatedAt`).
- `dialectOptions: { connectTimeout: 60000, enableKeepAlive: true, keepAliveInitialDelay: 10000 }` on hardened configs.

### 2.5 Migration Configuration

- **No `.sequelizerc`** anywhere in the repo.
- **No `seeders/`** directory.
- Schema is created/altered by `sequelize.sync()` at service boot ([auth-service/src/app.js:151](backend/auth-service/src/app.js#L151)), supplemented by:
  - 3 formal Sequelize-style migration files (with `up`/`down` exports).
  - 2 `.sql` companion files for the same migrations.
  - 3 ad-hoc one-shot migration runner scripts in `*/scripts/`.
  - Idempotent `ALTER TABLE` calls embedded in `admin-service/src/server.js` boot.

### 2.6 Seed Configuration

- No Sequelize seeder framework. Seeding is done by **standalone executable scripts**:
  - `auth-service/src/scripts/seedAdmin.js`
  - `auth-service/src/scripts/seedCollegeAdmin.js`
  - `admin-service/src/scripts/seedRootAdmin.js`
  - `admin-service/src/scripts/seedCollegeAdmin.js`
  - `admin-service/scripts/seed-category10-courses.js`
- Roles in `lucy_devdb.roles` are seeded automatically on boot via `findOrCreate` ([auth-service/src/app.js:154-160](backend/auth-service/src/app.js#L154-L160)).

---

## 3. Tables Overview

### 3.1 Total Tables

**25** tables (24 declared via Sequelize models + 1 raw-SQL-only `program_requests`).

### 3.2 Full Table List by Schema

#### Schema `lucy_devdb` (12 tables)

`users`, `roles`, `colleges`, `branches`, `organisations`, `courses` (course-service flavor), `enrollments`, `assessments`, `questions` (assessment flavor), `questionsets`, `pre_assessment_registrations`, `program_requests` *(implicit)*

> Additionally `users.instructorPhoto` and `users.studentPhoto` columns are added **at runtime** by `admin-service`'s boot hook via `ALTER TABLE`.

#### Schema `lms_admin` (13 tables)

`users` (Laravel-style), `categories`, `courses` (LMS flavor), `sections`, `lessons`, `questions` (quiz flavor), `quiz_submissions`, `settings`, `live_classes`, `coupons`, `certificates`, `pre_assessment_results`, `user_progress`, `lesson_completions`, `lesson_watch_progress`, `languages`, `forums`, `forum_reports`, `seo_fields`

> The `lms_admin.colleges` table is **defined in admin-service but bound to `authDb`** — i.e. it is the same physical row as `lucy_devdb.colleges` (see [backend/admin-service/src/models/College.js:8](backend/admin-service/src/models/College.js#L8)).

### 3.3 Categorisation

| Category | Tables |
|---|---|
| **Core business** | `courses` (×2), `categories`, `sections`, `lessons`, `assessments`, `questionsets`, `questions` (×2), `live_classes`, `certificates`, `coupons` |
| **Authentication / Identity** | `users` (×2 — `lucy_devdb` and `lms_admin`), `roles` |
| **Org / Multi-tenant** | `organisations`, `colleges`, `branches` |
| **Transaction / Enrollment** | `enrollments`, `user_progress` |
| **Mapping / Junction (logical only)** | `lesson_completions`, `lesson_watch_progress`, `quiz_submissions`, `pre_assessment_results`, `pre_assessment_registrations`, `forum_reports`, `program_requests` |
| **Configuration / Settings** | `settings`, `languages`, `seo_fields` |
| **Discussion / UGC** | `forums`, `forum_reports` |
| **Audit / Timestamp** | None dedicated. All tables (except `roles`, `branches`) use Sequelize `timestamps: true` for `createdAt/updatedAt`. |
| **Cache / Temporary** | None at DB layer. `admin-service/course-content/watchStore.js` is in-memory only with DB persistence. |

---

## 4. Complete Table Documentation

> Tables are organised by owning schema. Columns reflect the ORM model (the live schema source-of-truth via `sync()`).

---

### 4.1 `lucy_devdb` Schema

#### 4.1.1 Table: `users` (auth-service)

**Purpose:** Canonical identity table for the entire platform — students, instructors, admins, auditors. All cross-service user references key on `userId` (STRING).
**Business logic:** Login, role lookup, profile data, pre/post assessment scores, instructor and student profile photo (added at runtime by admin-service), program assignment state, college mapping.

| Column | Type | Length | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|---|
| `userId` | STRING | — | NO | — | **PK** | App-generated user id (e.g. `usr_…` or 11-digit numeric) |
| `name` | STRING | — | NO | — | — | Display name |
| `email` | STRING | — | NO | — | **UNIQUE** | Login email |
| `passwordHash` | STRING | — | NO | — | — | bcrypt hash |
| `phone` | STRING | — | YES | — | — | — |
| `dob` | DATEONLY | — | YES | — | — | Date of birth |
| `gender` | ENUM | `male`/`female` | YES | — | — | — |
| `yearOfEducation` | STRING | — | YES | — | — | Free text |
| `branchId` | STRING | — | YES | — | logical FK → `branches.branchId` | — |
| `collegeId` | STRING | — | YES | — | logical FK → `colleges.clgId` | Used by dashboard/student listing |
| `yearOfStudy` | INTEGER | — | YES | — | — | — |
| `educationLevel` | ENUM | `inter,bachelor,master,phd,other` | YES | — | — | Added by migration 20260421 |
| `branch` | STRING | — | YES | — | — | Free-text branch override |
| `collegeName` | STRING | — | YES | — | — | Free-text college fallback |
| `graduationYear` | STRING | — | YES | — | — | — |
| `collegeCode` | STRING | — | YES | — | — | — |
| `orgId` | STRING | — | YES | — | logical FK → `organisations.orgId` | — |
| `assessmentId` | STRING | — | YES | — | logical FK → `assessments.assessmentId` | — |
| `programInterested` | STRING | — | YES | — | — | — |
| `expertise` | STRING | 255 | YES | — | — | Instructor field |
| `bio` | STRING | 1000 | YES | — | — | Instructor field |
| `yearsOfExperience` | INTEGER | — | YES | — | — | Instructor field |
| `linkedinUrl` | STRING | 255 | YES | — | — | Instructor field |
| `profileStatus` | ENUM | `active,inactive,pending` | YES | `pending` | — | — |
| `location` | STRING | — | YES | — | — | — |
| `address` | STRING | 255 | YES | — | — | — |
| `lastLogin` | DATE | — | YES | — | — | — |
| `preScore` | INTEGER | — | YES | — | — | Pre-assessment score (auth-service writes) |
| `preScoreDuration` | INTEGER | — | YES | — | — | Seconds spent on pre-assessment |
| `postScore` | INTEGER | — | YES | — | — | — |
| `refreshToken` | STRING | 1024 | YES | — | — | JWT refresh token |
| `roleId` | STRING | — | NO | — | **FK → `roles.roleId`** | — |
| `assignedProgram` | STRING | — | YES | — | — | *(undeclared in model — written by raw SQL in StudentService)* |
| `programResponseStatus` | STRING | — | YES | — | — | *(undeclared)* |
| `programRespondedAt` | DATETIME | — | YES | — | — | *(undeclared)* |
| `instructorPhoto` | VARCHAR(255) | — | YES | — | — | Added at admin-service boot |
| `studentPhoto` | VARCHAR(255) | — | YES | — | — | Added at admin-service boot |
| `createdAt` / `updatedAt` | DATE | — | NO | now | — | Sequelize timestamps |

**Key Analysis**

- **Primary key:** `userId`
- **Unique:** `email`
- **FKs (DB-enforced):** `roleId` → `roles.roleId`
- **Logical FKs:** `collegeId`, `branchId`, `orgId`, `assessmentId`
- **Indexes:** *only* the implicit PK and unique on email. No index on `collegeId`/`roleId` — N+1/scan risk on `StudentService` joins.

**Relationships**

- `User.belongsTo(Role)` — many-to-one ([User.js:135](backend/auth-service/src/db/models/User.js#L135))
- Implicit: many-to-one with `Organisation`, `College`, `Branch` (no Sequelize association declared).

---

#### 4.1.2 Table: `roles`

**Purpose:** Lookup of role names. Seeded automatically at auth-service boot for `student, instructor, admin, auditor`.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `roleId` | STRING | NO | — | **PK** |
| `role` | ENUM(`student,instructor,admin,auditor`) | NO | — | — |

**Relationships:** `Role.hasMany(User)`.
**Timestamps:** Disabled (`timestamps: false`).

---

#### 4.1.3 Table: `colleges`

**Purpose:** Canonical college record. Same row shape declared by `college-service`, `payment-service`, AND `admin-service` (via `authDb` handle) — see §9 for the duplication risk.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `clgId` | STRING | NO | — | **PK** |
| `accesskey` | STRING | NO | — | **UNIQUE** |
| `clgName` | STRING | NO | — | — |
| `clgAddress` | TEXT | YES | — | — |
| `orgId` | STRING | YES | — | logical FK → `organisations.orgId` *(declared as `references`)* |
| `branchIds` | JSON | YES | — | Array like `["CSE","ECE"]` — denormalized child-list |

**Notes:** Multi-tenant anchor for everything else (`courses.clgIds`, `categories.clg_ids`, `users.collegeId`).

---

#### 4.1.4 Table: `branches`

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `branchId` | STRING | NO | — | **PK** |
| `branchName` | STRING | NO | — | **UNIQUE** |

**Timestamps:** Disabled.

---

#### 4.1.5 Table: `organisations`

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `orgId` | STRING | NO | — | **PK** |
| `accesskey` | STRING | NO | — | **UNIQUE** |
| `orgName` | STRING | NO | — | — |
| `orgState` | STRING | YES | — | — |
| `orgCountry` | STRING | YES | — | — |
| `orgAddress` | TEXT | YES | — | — |
| `orgPin` | STRING | YES | — | — |

---

#### 4.1.6 Table: `courses` (course-service flavor — `lucy_devdb.courses`)

**Purpose:** Course-service's catalog. Distinct from `lms_admin.courses` — both physically exist.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `courseId` | STRING | NO | — | **PK** |
| `title` | STRING | NO | — | — |
| `description` | TEXT | YES | — | — |
| `duration` | INTEGER | NO | — | hours/minutes |
| `isPreAssessmentNeeded` | BOOLEAN | YES | `false` | — |
| `modules` | JSON | YES | — | Array of module objects |
| `clgIds` | JSON | NO | `[]` | Added by 20260515 migration |
| `instructorId` | STRING | YES | — | logical FK → `users.userId`. Added by 20260516 migration |

---

#### 4.1.7 Table: `enrollments`

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `enrollmentId` | STRING | NO | — | **PK** |
| `userId` | STRING | NO | — | logical FK → `users.userId` (cross-DB, no DB FK) |
| `courseId` | STRING | NO | — | **FK → `courses.courseId`** |
| `status` | ENUM(`enrolled,in-progress,completed,dropped`) | NO | `enrolled` | — |
| `enrolledAt` | DATE | YES | now | — |
| `completedAt` | DATE | YES | — | — |

**Relationships:** `Enrollment.belongsTo(Course)`.

---

#### 4.1.8 Table: `assessments`

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `assessmentId` | STRING | NO | — | **PK** |
| `type` | ENUM(`pre,post`) | NO | — | — |
| `setId` | STRING | NO | — | **FK → `questionsets.setId`** |
| `startAt` | DATE | YES | — | — |
| `endAt` | DATE | YES | — | — |
| `score` | FLOAT | YES | — | — |
| `timer` | INTEGER | YES | — | — |
| `status` | ENUM(`not-started,available,in-progress,completed,expired`) | NO | `not-started` | — |

---

#### 4.1.9 Table: `questionsets`

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `setId` | STRING | NO | — | **PK** |
| `setName` | STRING | NO | — | — |
| `category` | STRING | YES | — | — |
| `questions` | JSON | NO | `[]` | Array of `quesId` strings — embedded many-to-many |

---

#### 4.1.10 Table: `questions` (assessment-service flavor — `lucy_devdb.questions`)

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `quesId` | STRING | NO | — | **PK** |
| `question` | TEXT | NO | — | — |
| `correctAns` | STRING | NO | — | — |
| `options` | JSON | NO | — | `{option1, option2, …}` |
| `category` | STRING | YES | — | — |
| `questionSeverity` | ENUM(`easy,medium,hard`) | YES | — | — |

---

#### 4.1.11 Table: `pre_assessment_registrations`

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `registrationId` | STRING | NO | — | **PK** |
| `userId` | STRING | YES | — | Optional — walk-in registrations |
| `fullName` | STRING(120) | NO | — | validator: len[2,120] |
| `email` | STRING(160) | NO | — | validator: isEmail |
| `phoneNumber` | STRING(20) | NO | — | validator: regex |
| `gender` | ENUM | NO | — | from `GENDERS` constant |
| `selectedProgram` | ENUM | NO | — | from `PROGRAMS` constant |
| `uploadedCollegeProof` | JSON | NO | — | `{fileName,originalName,mimeType,size,url,storedAt}` |
| `declarationAccepted` | BOOLEAN | NO | `false` | custom validator (must be true) |
| `assessmentStatus` | ENUM | NO | `registered` | from `ASSESSMENT_STATUSES` constant |
| `assessmentStartedAt` | DATE | YES | — | — |
| `submittedFromIp` | STRING(64) | YES | — | Audit field |
| `submittedUserAgent` | STRING(255) | YES | — | Audit field |

**Indexes:** `[userId]`, `[email]`, `[selectedProgram]`, `[assessmentStatus]`.

---

#### 4.1.12 Table: `program_requests` *(undeclared — raw SQL only)*

**Purpose:** Admin-to-student program requests with accept/reject workflow. Defined only via raw SQL in [admin-service/src/services/StudentService.js:368-447](backend/admin-service/src/services/StudentService.js#L368-L447).
**Inferred schema:**

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `user_id` | STRING | NO | — | **PK** (`ON DUPLICATE KEY UPDATE` implies unique on `user_id`) — logical FK → `users.userId` |
| `program` | ENUM | NO | — | `AI Frontier Program / AI Frontier Plus Program / Elite AI Residency` |
| `requested_by` | STRING | YES | — | admin userId |
| `status` | ENUM | NO | `sent` | `sent / accepted / rejected / cancelled` |
| `responded_at` | DATETIME | YES | — | — |
| `created_at` / `updated_at` | TIMESTAMP | NO | now | — |

> **⚠️ Missing model file** — table is not managed by `sync()`. Must be created manually before `sendProgramRequest` works.

---

### 4.2 `lms_admin` Schema

> All admin-service tables use Laravel-style `created_at` / `updated_at`.

#### 4.2.1 Table: `users` (admin-service Laravel flavor)

**Purpose:** Admin-service's own user table (distinct from `lucy_devdb.users`). Houses root admin and college admin login records.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | INTEGER | NO | autoIncr | **PK** |
| `role` | STRING(100) | NO | — | — |
| `email` | STRING(255) | NO | — | **UNIQUE** |
| `status` | INTEGER | YES | — | — |
| `name` | STRING(255) | YES | — | — |
| `phone` | STRING(255) | YES | — | — |
| `website` | STRING(255) | YES | — | — |
| `skills` | TEXT | YES | — | — |
| `facebook` | TEXT | YES | — | — |
| `twitter` | STRING(255) | YES | — | — |
| `linkedin` | STRING(255) | YES | — | — |
| `address` | STRING(255) | YES | — | — |
| `college_name` | STRING(255) | YES | — | — |
| `college_id` | STRING(255) | YES | — | logical FK → `lucy_devdb.colleges.clgId` |
| `about` | TEXT | YES | — | — |
| `biography` | TEXT('long') | YES | — | — |
| `educations` | TEXT('long') | YES | — | — |
| `photo` | STRING(255) | YES | — | — |
| `email_verified_at` | DATE | YES | — | — |
| `password` | STRING(255) | YES | — | bcrypt |
| `remember_token` | STRING(100) | YES | — | — |
| `paymentkeys` | TEXT('long') | YES | — | — |
| `video_url` | STRING(255) | YES | — | — |

**Relationships:** `User.hasMany(Course, {fk: user_id, as: 'courses'})`.

---

#### 4.2.2 Table: `categories`

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | INTEGER | NO | autoIncr | **PK** |
| `parent_id` | INTEGER | YES | — | **self FK** → `categories.id` |
| `title` | STRING(255) | NO | — | — |
| `slug` | STRING(255) | YES | — | — |
| `icon` | STRING(255) | YES | — | — |
| `sort` | INTEGER | YES | `0` | — |
| `status` | STRING(50) | YES | `active` | — |
| `keywords` | STRING(400) | YES | — | — |
| `description` | STRING(500) | YES | — | — |
| `thumbnail` | STRING(255) | YES | — | — |
| `category_logo` | STRING(255) | YES | — | — |
| `clg_ids` | JSON | YES | `[]` | logical multi-FK → colleges |

**Relationships:** self-referencing (`childs`/`parent`); `hasMany(Course)`.

---

#### 4.2.3 Table: `courses` (lms_admin flavor)

**Purpose:** Laravel-style LMS catalog — feeds the public catalog pages and the admin curriculum builder.

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | INTEGER | NO | autoIncr | **PK** |
| `title` | STRING(255) | NO | — | — |
| `slug` | STRING(255) | YES | — | (used as lookup key by public detail page; should be unique but isn't enforced) |
| `short_description` | TEXT | YES | — | — |
| `user_id` | INTEGER | YES | — | FK → `users.id` |
| `category_id` | INTEGER | YES | — | FK → `categories.id` |
| `course_type` | STRING(50) | YES | `general` | — |
| `status` | STRING(50) | YES | `active` | — |
| `level` | STRING(50) | YES | — | — |
| `language` | STRING(50) | YES | — | — |
| `is_paid` | BOOLEAN | YES | `false` | — |
| `is_best` | BOOLEAN | YES | `false` | — |
| `price` | FLOAT | YES | `0` | — |
| `discounted_price` | FLOAT | YES | `0` | — |
| `discount_flag` | BOOLEAN | YES | `false` | — |
| `enable_drip_content` | BOOLEAN | YES | `false` | — |
| `drip_content_settings` | TEXT | YES | — | — |
| `meta_keywords` | TEXT | YES | — | — |
| `meta_description` | TEXT | YES | — | — |
| `thumbnail` | STRING(255) | YES | — | — |
| `banner` | STRING(255) | YES | — | — |
| `preview` | STRING(255) | YES | — | — |
| `description` | TEXT('long') | YES | — | — |
| `requirements` | TEXT | YES | — | — |
| `outcomes` | TEXT | YES | — | — |
| `faqs` | TEXT | YES | — | — |
| `instructor_ids` | TEXT | YES | — | CSV / JSON-as-text |
| `clg_ids` | JSON | YES | `[]` | Added by `run-clgIds-migration.js` |
| `average_rating` | FLOAT | YES | `0` | — |
| `expiry_period` | INTEGER | YES | — | days |

**Relationships:** `belongsTo(Category)`, `belongsTo(User, as: creator)`.

---

#### 4.2.4 Table: `sections`

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| `id` | INTEGER | NO | **PK**, autoIncr |
| `user_id` | INTEGER | YES | — |
| `course_id` | INTEGER | YES | FK → `courses.id` |
| `title` | STRING(255) | YES | — |
| `sort` | INTEGER | YES | — |

**Relationships:** `belongsTo(Course)`, `hasMany(Lesson, as: lessons)`.

---

#### 4.2.5 Table: `lessons`

| Column | Type | Nullable | Constraints |
|---|---|---|---|
| `id` | INTEGER | NO | **PK**, autoIncr |
| `title` | STRING(255) | YES | — |
| `user_id` | INTEGER | YES | — |
| `course_id` | INTEGER | YES | FK → `courses.id` |
| `section_id` | INTEGER | YES | FK → `sections.id` |
| `lesson_type` | STRING(255) | YES | (video / quiz / text …) |
| `duration` | STRING(255) | YES | — |
| `total_mark` | INTEGER | YES | quiz |
| `pass_mark` | INTEGER | YES | quiz |
| `retake` | INTEGER | YES | quiz |
| `lesson_src` | STRING(255) | YES | url/path |
| `attachment` | TEXT('long') | YES | — |
| `attachment_type` | STRING(255) | YES | — |
| `video_type` | TEXT | YES | — |
| `thumbnail` | STRING(255) | YES | — |
| `is_free` | INTEGER | YES | 0/1 |
| `sort` | INTEGER | YES | — |
| `description` | TEXT('long') | YES | — |
| `summary` | TEXT('long') | YES | — |
| `status` | INTEGER | YES | — |

---

#### 4.2.6 Table: `questions` (quiz flavor — `lms_admin.questions`)

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | **PK** |
| `quiz_id` | INTEGER | logical FK → `lessons.id` (where lesson_type = quiz) |
| `title` | TEXT('long') | — |
| `type` | STRING(255) | — |
| `answer` | TEXT('medium') | — |
| `options` | TEXT('long') | JSON-as-text |
| `sort` | INTEGER | — |

---

#### 4.2.7 Table: `quiz_submissions`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | **PK** |
| `quiz_id` | INTEGER | logical FK → `lessons.id` |
| `user_id` | INTEGER | — |
| `correct_answer` | TEXT('long') | JSON-as-text |
| `wrong_answer` | TEXT('long') | — |
| `submits` | TEXT('long') | full attempt blob |
| `score` | INTEGER | — |
| `total` | INTEGER | — |

---

#### 4.2.8 Table: `settings`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | **PK** |
| `type` | STRING(255) | row key (e.g. `certificate_template`) |
| `description` | TEXT('long') | value blob |

Key-value config store.

---

#### 4.2.9 Table: `live_classes`

| Column | Type | Constraints |
|---|---|---|
| `id` | INTEGER | **PK** |
| `user_id` | **BIGINT** | logical FK → `lucy_devdb.users.userId` — widened from INT at boot |
| `course_id` | INTEGER | FK → `courses.id` |
| `class_topic` | STRING(255) | — |
| `provider` | STRING(255) | zoom/meet/… |
| `class_date_and_time` | DATE | — |
| `additional_info` | TEXT('long') | — |
| `note` | TEXT | — |

---

#### 4.2.10 Table: `coupons`

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | INTEGER | NO | autoIncr | **PK** |
| `user_id` | INTEGER | NO | — | — |
| `code` | STRING(255) | NO | — | **UNIQUE** |
| `discount` | INTEGER | NO | — | — |
| `expiry` | BIGINT | NO | — | epoch ms |
| `status` | TINYINT | YES | `1` | — |

---

#### 4.2.11 Table: `certificates`

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | INTEGER | NO | autoIncr | **PK** |
| `user_id` | STRING(255) | YES | — | logical FK → `lucy_devdb.users.userId` |
| `course_id` | INTEGER | YES | — | FK → `courses.id` |
| `identifier` | STRING(100) | YES | — | **UNIQUE** |
| `title` | STRING(255) | YES | — | — |
| `description` | TEXT | YES | — | — |
| `template_image` | STRING(255) | YES | — | legacy slot |
| `status` | TINYINT | YES | `1` | 1=active, 0=hidden |
| `issued_at` | DATE | YES | — | — |

**Relationships:** `belongsTo(User, as: user)`, `belongsTo(Course, as: course)`.

---

#### 4.2.12 Table: `pre_assessment_results`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INTEGER | NO | autoIncr | PK |
| `user_id` | BIGINT | NO | — | logical FK → `users.userId` |
| `program_id` | INTEGER | YES | — | — |
| `score` | FLOAT | NO | `0` | — |
| `passed` | BOOLEAN | NO | `false` | — |
| `duration_seconds` | INTEGER | YES | — | — |

**Indexes:** `[user_id, program_id]`.

---

#### 4.2.13 Table: `user_progress`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INTEGER | NO | autoIncr | PK |
| `user_id` | BIGINT | NO | — | logical FK |
| `program_id` | INTEGER | NO | — | — |
| `course_id` | INTEGER | YES | — | logical FK → `lms_admin.courses.id` |
| `last_lesson_id` | INTEGER | YES | — | — |
| `enrolled` | BOOLEAN | NO | `false` | — |

**Indexes:** **UNIQUE** `[user_id, program_id]`; index `[user_id]`.

---

#### 4.2.14 Table: `lesson_completions`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | INTEGER | NO | PK |
| `user_id` | BIGINT | NO | — |
| `course_id` | INTEGER | NO | — |
| `lesson_id` | INTEGER | NO | — |

**Indexes:** **UNIQUE** `[user_id, lesson_id]`; index `[user_id, course_id]`.

---

#### 4.2.15 Table: `lesson_watch_progress`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | INTEGER | NO | autoIncr | PK |
| `user_id` | BIGINT | NO | — | — |
| `course_id` | INTEGER | NO | — | — |
| `lesson_id` | INTEGER | NO | — | — |
| `current_duration` | INTEGER | NO | `0` | highest playback second reached |

**Indexes:** **UNIQUE** `[user_id, lesson_id]`; index `[user_id, course_id]`.

---

#### 4.2.16 Table: `languages`

| Column | Type | Nullable | Default | Constraints |
|---|---|---|---|---|
| `id` | INTEGER | NO | autoIncr | PK |
| `name` | STRING(100) | NO | — | **UNIQUE** |
| `code` | STRING(20) | YES | — | — |
| `direction` | ENUM(`ltr,rtl`) | NO | `ltr` | — |
| `is_default` | BOOLEAN | NO | `false` | — |

---

#### 4.2.17 Table: `forums`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | INTEGER | NO | PK |
| `course_id` | INTEGER | YES | logical FK |
| `user_id` | BIGINT | YES | logical FK → `lucy_devdb.users.userId` |
| `parent_id` | INTEGER | YES | self FK — NULL = question, set = reply |
| `title` | STRING(255) | YES | "reply" literal for replies |
| `description` | TEXT('long') | YES | — |
| `likes` | TEXT('long') | YES | JSON-as-text of user-id strings |
| `dislikes` | TEXT('long') | YES | JSON-as-text |

**Relationships:** `belongsTo(Course)`, self-ref (`parent`/`children`).

---

#### 4.2.18 Table: `forum_reports`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | INTEGER | NO | PK |
| `forum_id` | INTEGER | NO | FK → `forums.id` |
| `user_id` | BIGINT | NO | reporter |
| `reason` | TEXT | YES | — |

**Indexes:** **UNIQUE** `[forum_id, user_id]` — one report per (post, reporter).

---

#### 4.2.19 Table: `seo_fields`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER | PK |
| `course_id` | INTEGER | logical FK |
| `route` | STRING(255) | — |
| `name_route` | STRING(255) | — |
| `meta_title` | STRING(255) | — |
| `meta_description` | TEXT | — |
| `meta_keywords` | TEXT | — |
| `meta_robot` | STRING(100) | — |
| `canonical_url` | STRING(255) | — |
| `custom_url` | STRING(255) | — |
| `json_ld` | TEXT | — |
| `og_title` | STRING(255) | — |
| `og_description` | TEXT | — |
| `og_image` | STRING(255) | — |

---

## 5. Migration Analysis

### 5.1 Migration Inventory

| # | File | Type | Service |
|---|---|---|---|
| 1 | [20260421-add-academic-info-to-users.js](backend/auth-service/src/db/migrations/20260421-add-academic-info-to-users.js) | Sequelize migration (up/down) | auth-service |
| 2 | [20260421-add-academic-info-to-users.sql](backend/auth-service/src/db/migrations/20260421-add-academic-info-to-users.sql) | Raw SQL companion | auth-service |
| 3 | [20260515-add-clgIds-to-courses.js](backend/course-service/src/db/migrations/20260515-add-clgIds-to-courses.js) | Sequelize migration | course-service |
| 4 | [20260515-add-clgIds-to-courses.sql](backend/course-service/src/db/migrations/20260515-add-clgIds-to-courses.sql) | Raw SQL companion | course-service |
| 5 | [20260516-add-instructorId-to-courses.js](backend/course-service/src/db/migrations/20260516-add-instructorId-to-courses.js) | Sequelize migration | course-service |
| 6 | `course-service/scripts/run-clgIds-migration.js` | One-shot runner | course-service |
| 7 | `admin-service/scripts/run-clgIds-migration.js` | One-shot runner | admin-service |
| 8 | `admin-service/scripts/add-category-clgIds-column.js` | One-shot runner | admin-service |
| – | Boot ALTERs in `admin-service/src/server.js` | Inline idempotent ALTERs | admin-service |

### 5.2 Migration Detail

| Filename | Purpose | Up | Down | Tables Affected |
|---|---|---|---|---|
| `20260421-add-academic-info-to-users.js/sql` | Add Academic Information columns to users | `ADD COLUMN educationLevel ENUM(...), branch, collegeName, graduationYear, collegeCode` — all nullable | `DROP COLUMN` each | `lucy_devdb.users` |
| `20260515-add-clgIds-to-courses.js/sql` | Multi-college course offering support | `ADD COLUMN clgIds JSON NOT NULL DEFAULT JSON_ARRAY()` + backfill `UPDATE … WHERE IS NULL` | `DROP COLUMN clgIds` | `lucy_devdb.courses` |
| `20260516-add-instructorId-to-courses.js` | Assign instructor to course | `ADD COLUMN instructorId STRING NULL` | `DROP COLUMN instructorId` | `lucy_devdb.courses` |
| `run-clgIds-migration.js` (course-service) | One-shot equivalent of #2 for fresh DBs | Raw `ALTER TABLE courses ADD COLUMN clgIds JSON NOT NULL DEFAULT (JSON_ARRAY())` | none | `lucy_devdb.courses` |
| `run-clgIds-migration.js` (admin-service) | Mirror in `lms_admin` | Raw `ALTER TABLE courses ADD COLUMN clg_ids JSON NULL AFTER instructor_ids` | none | `lms_admin.courses` |
| `add-category-clgIds-column.js` | Mirror clg_ids on categories | Raw `ALTER TABLE categories ADD COLUMN clg_ids JSON NULL AFTER category_logo` | none | `lms_admin.categories` |
| **Boot-time ALTERs** in `admin-service/server.js` | Runtime schema patches | (1) `users.instructorPhoto VARCHAR(255)`, (2) `users.studentPhoto VARCHAR(255)` (in `lucy_devdb`); (3) widen `live_classes.user_id` INT→BIGINT | none | `lucy_devdb.users`, `lms_admin.live_classes` |

### 5.3 Migration Execution Order

There is **no migration log table** (no `SequelizeMeta`). Order is implicit by date prefix:

1. `20260421-add-academic-info-to-users` — auth
2. `20260515-add-clgIds-to-courses` — course
3. `20260516-add-instructorId-to-courses` — course

Auxiliary runners and boot-time ALTERs are **idempotent** (`describeTable` guard or `SHOW COLUMNS` guard) and safe to re-run.

### 5.4 Rollback Behaviour

All formal migrations expose `down()` removing the column. The auxiliary `scripts/*.js` runners have **no rollback** (one-way ALTER). Boot-time ALTERs are one-way.

### 5.5 Pending / Incomplete Migrations

- **`program_requests` table has no migration.** It's referenced by raw SQL but never created by `sync()` — must be created manually before the Send-Program-Request flow works in a fresh environment.
- **`users.assignedProgram`, `programResponseStatus`, `programRespondedAt`** are written by `StudentService.sendProgramRequest` but not in the `User` model — no migration creates them.

---

## 6. Seeder & Initial Data Analysis

### 6.1 Boot-Time Seeds

| Seed | Mechanism | File | Behaviour |
|---|---|---|---|
| Roles (`student/instructor/admin/auditor`) | `Role.findOrCreate` in `initDb()` | [auth-service/src/app.js:154-160](backend/auth-service/src/app.js#L154-L160) | Runs on every boot, idempotent |

### 6.2 Manual Seed Scripts

| Script | Creates | Default Credentials |
|---|---|---|
| `auth-service/src/scripts/seedAdmin.js` | Admin user in `lucy_devdb.users` (role=admin) | `admin@gmail.com` / `admin123` |
| `auth-service/src/scripts/seedCollegeAdmin.js` | College-scoped admin in `lucy_devdb.users` | `college-admin@gmail.com` / `college123` / `COLLEGE001` |
| `admin-service/src/scripts/seedRootAdmin.js` | Admin in `lms_admin.users` | `root@admin.com` / `password123` |
| `admin-service/src/scripts/seedCollegeAdmin.js` | College admin in `lms_admin.users` | `college-admin@gmail.com` / `college123` / `COLLEGE001` |
| `admin-service/scripts/seed-category10-courses.js` | Clones course id=10 with 2 new slugs | — |

### 6.3 Static Lookup Tables

- `roles` — bootstrapped automatically.
- `languages` — created via `Language.sync()` on admin-service boot (no data seeded).
- `branches` — no seed; populated by college-service flow.

---

## 7. Database Relationships & ERD

### 7.1 ERD (text)

```
                        lucy_devdb schema
┌───────────────────┐
│   organisations   │
│ ─────────────────│
│ orgId (PK)        │
└─────────┬─────────┘
          │1
          │
          │N
┌─────────┴─────────┐    ┌────────────────┐    ┌──────────────────┐
│     colleges      │    │    branches    │    │      roles       │
│ ─────────────────│    │ ──────────────│    │ ───────────────── │
│ clgId (PK)        │    │ branchId (PK)  │    │ roleId (PK)      │
│ orgId (logical FK)│    │ branchName     │    │ role             │
│ branchIds (JSON)  │    └────────────────┘    └─────┬────────────┘
└─────────┬─────────┘                                │1
          │ logical N                                │
          │                                          │N
          ▼                                  ┌───────┴────────┐
┌──────────────────────────────────────────► │     users      │
│                                            │ ──────────────│
│                                            │ userId (PK)    │
│  logical                                   │ email (UNIQUE) │
│   FK                                       │ roleId (FK)    │
│ via clgIds[]                               │ collegeId      │
│                                            │ orgId          │
│                                            │ assessmentId   │
│                                            │ preScore       │
│                                            └─┬──┬────────┬──┘
┌─────────┴─────────┐                          │  │        │
│      courses      │                          │  │        │
│ (course-service)  │                          │  │        ▼
│ ─────────────────│                          │  │  ┌─────────────┐
│ courseId (PK)     │                          │  │  │ assessments │
│ clgIds[] (JSON)   │                          │  │  │ ───────────│
│ instructorId (FK) │◄─────────────────────────┘  │  │ assessmentId│
└─────────┬─────────┘                              │  │ setId (FK)  │
          │1                                       │  └──────┬──────┘
          │N                                       │         │N
┌─────────┴─────────┐                              │         │1
│   enrollments     │                              │  ┌──────┴──────┐
│ ─────────────────│                              │  │ questionsets│
│ enrollmentId (PK) │                              │  │ ───────────│
│ courseId (FK)     │                              │  │ setId (PK)  │
│ userId (logical)  │──────────────────────────────┘  │ questions[] │
│ status            │                                 └──────┬──────┘
└───────────────────┘                                        │ embed
                                                             │ many
                                                      ┌──────┴──────┐
                                                      │  questions  │
                                                      │ (assess)    │
                                                      └─────────────┘

  pre_assessment_registrations:  userId (logical FK → users)
  program_requests (raw SQL):    user_id (logical FK → users)

────────────────────────────────────────────────────────────────────
                        lms_admin schema

┌──────────────────┐
│      users       │1───N ┌──────────────────────┐
│ (Laravel-style)  │      │       courses        │
│ id (PK, auto)    ├─────►│ id (PK, auto)        │
│ college_id       │      │ user_id (FK)         │
└──────────────────┘      │ category_id (FK)     │
                          │ clg_ids[] (JSON)     │
                  ┌──────►│ instructor_ids       │
                  │       └──┬──┬────────┬───────┘
┌─────────────────┴┐         │  │        │
│   categories     │         │N │1       │1
│ id (PK)          │         │  │        │
│ parent_id (self) │         │  ▼        ▼
│ clg_ids[] (JSON) │         │ ┌──────────┐ ┌──────────────┐
└──────────────────┘         │ │ sections │ │  certificates│
                             │ │ id (PK)  │ │ id (PK)      │
                             │ │ course_id│ │ user_id (str)│
                             │ └────┬─────┘ │ course_id    │
                             │      │1      │ identifier   │
                             │      │       └──────────────┘
                             │      │N
                             │ ┌────┴────┐
                             │ │ lessons │
                             │ │ id (PK) │
                             │ │ section │
                             │ │ course  │
                             │ └────┬────┘
                             │      │N
                             │      │
                             │      │ logical (quiz_id = lesson.id)
                             │      ▼
                             │ ┌────────────┐  ┌─────────────────┐
                             │ │ questions  │  │quiz_submissions │
                             │ └────────────┘  └─────────────────┘
                             │
                             ▼ N
                  ┌───────────────┐  ┌─────────────────────┐
                  │  live_classes │  │ lesson_completions  │
                  │ user_id BIGINT│  │  (user, lesson)U    │
                  └───────────────┘  └─────────────────────┘

                  ┌──────────────────────┐  ┌────────────────────┐
                  │ lesson_watch_progress│  │  user_progress     │
                  │  (user, lesson) U    │  │ (user, program) U  │
                  └──────────────────────┘  └────────────────────┘

                  ┌──────────────────────┐  ┌──────────────────┐
                  │ pre_assessment_results│  │  forums (self)   │
                  └──────────────────────┘  └─────┬────────────┘
                                                  │1
                                                  │N
                                            ┌─────┴────────┐
                                            │ forum_reports│
                                            │ (forum,user)U│
                                            └──────────────┘
                  ┌────────────┐ ┌──────────┐ ┌─────────────┐
                  │  settings  │ │ languages│ │  coupons    │
                  └────────────┘ └──────────┘ └─────────────┘
                  ┌────────────┐
                  │ seo_fields │
                  └────────────┘
```

### 7.2 Relationship Summary

| Type | Pairs |
|---|---|
| **One-to-One** | none declared |
| **One-to-Many (DB FK)** | `roles → users`, `courses (course-service) → enrollments`, `questionsets → assessments`, `categories → courses (admin)`, `users (admin) → courses (admin)`, `courses (admin) → sections`, `courses (admin) → lessons`, `sections → lessons`, `forums → forum_reports`, `users (admin) → certificates`, `courses (admin) → certificates` |
| **Many-to-Many (logical via JSON arrays)** | `colleges ↔ courses` via `courses.clgIds[]` / `courses.clg_ids[]`; `colleges ↔ categories` via `categories.clg_ids[]`; `questionsets ↔ questions` via `questionsets.questions[]`; `colleges ↔ branches` via `colleges.branchIds[]` |
| **Self-referencing** | `categories.parent_id → categories.id`; `forums.parent_id → forums.id` |
| **Cross-schema logical FKs** | `lms_admin.users.college_id → lucy_devdb.colleges.clgId`; `lms_admin.certificates.user_id → lucy_devdb.users.userId`; `lms_admin.user_progress.user_id → lucy_devdb.users.userId`; `lms_admin.forums.user_id → lucy_devdb.users.userId`; `lms_admin.live_classes.user_id → lucy_devdb.users.userId`; `lms_admin.pre_assessment_results.user_id → lucy_devdb.users.userId`; `lucy_devdb.courses.instructorId → lucy_devdb.users.userId`; `lucy_devdb.users.collegeId → lucy_devdb.colleges.clgId` |

### 7.3 Cascade Behaviour

**None defined.** No model declares `onDelete` / `onUpdate`. Deleting a parent leaves orphan child rows on all logical relationships.

---

## 8. Data Flow Analysis

### 8.1 Frontend → Backend → DB

```
React (frontend/) ──HTTP──► Bastion-server (gateway :8000)
                              │
                              ├──► auth-service (:8001)    → lucy_devdb
                              ├──► course-service (:8002)  → lucy_devdb
                              ├──► assessment-service (:8003) → lucy_devdb
                              ├──► admin-service (:4000)
                              │      ├──► lms_admin       (primary)
                              │      └──► lucy_devdb      (authDb handle)
                              ├──► college-service (:8005) → lucy_devdb
                              ├──► organization-service   → lucy_devdb
                              └──► payment-service        → lucy_devdb
```

### 8.2 CRUD Flow Examples

| Operation | Path |
|---|---|
| Student signup | `POST /signup` → auth-service → `lucy_devdb.users` INSERT |
| Pre-assessment registration | assessment-service → `lucy_devdb.pre_assessment_registrations` INSERT |
| Pre-assessment score write | auth-service → updates `users.preScore`, `preScoreDuration` |
| Pre-assessment audit row | admin-service → `lms_admin.pre_assessment_results` INSERT |
| Public catalog | `GET /api/public/courses` → admin-service queries `lms_admin.courses` (with `clg_ids` filter) |
| Student profile | reads `users` + `colleges` LEFT JOIN + `program_requests` LEFT JOIN |
| Watch a lesson | `POST /api/public/player/progress` → `watchStore` (in-mem) → async persist to `lesson_watch_progress` + `lesson_completions` + `user_progress.last_lesson_id` |
| Quiz attempt | `POST /api/public/player/quiz-submit` → `quiz_submissions` INSERT |
| Issue certificate | `POST /api/public/certificate/issue` → `certificates` INSERT |
| Send program request | `StudentService.sendProgramRequest` → raw `INSERT … ON DUPLICATE KEY UPDATE program_requests` + UPDATE `users` mirror columns |

### 8.3 Authentication / Session Storage

- Login issues JWT signed with `JWT_ACCESS_SECRET` (auth-service) — secret value `change-me-access` is shared with admin-service (env file note).
- Refresh tokens persisted as `users.refreshToken` (STRING 1024).
- No DB-side session table; stateless JWT only.

### 8.4 File / Media Storage

- Uploads served from `admin-service/uploads/` via `express.static('/uploads')` ([server.js:32](backend/admin-service/src/server.js#L32)).
- DB columns store only relative paths/URLs: `courses.thumbnail/banner/preview`, `lessons.lesson_src/attachment/thumbnail`, `categories.thumbnail/category_logo`, `users.photo/instructorPhoto/studentPhoto`.
- `pre_assessment_registrations.uploadedCollegeProof` is JSON describing the file, not BLOB.

### 8.5 Transaction Flow

**No explicit `sequelize.transaction()` blocks anywhere** in the read sample. Multi-step writes (e.g. `sendProgramRequest`: INSERT into `program_requests` followed by UPDATE of `users`) run as independent statements with no atomicity guarantee.

### 8.6 User Data Lifecycle

| Stage | Tables touched |
|---|---|
| Signup | `lucy_devdb.users`, `roles` (lookup) |
| Pre-assessment registration | `pre_assessment_registrations` |
| Pre-assessment attempt | `users.preScore/preScoreDuration` + `pre_assessment_results` |
| Program request sent | `program_requests` + mirror `users.assignedProgram/programResponseStatus/programRespondedAt` |
| Enrollment | `user_progress (enrolled=true)` |
| Watching lessons | `lesson_watch_progress`, `lesson_completions`, `user_progress.last_lesson_id` |
| Forum participation | `forums`, `forum_reports` |
| Course completion → cert | `certificates` |
| Logout / refresh | `users.refreshToken`, `users.lastLogin` |
| Deletion | Not implemented (no soft-delete flag, no DELETE flows seen) |

---

## 9. Schema Quality & Performance Review

### 9.1 Missing Indexes

- `lucy_devdb.users.collegeId` — heavily filtered in `StudentService` JOINs, no index.
- `lucy_devdb.users.roleId` — joined in every student dashboard query, no index.
- `lms_admin.courses.slug` — used as lookup key by `publicCourseService.detailsBySlug`, no UNIQUE / index.
- `lms_admin.courses.category_id` and `lms_admin.lessons.course_id`, `lessons.section_id`, `sections.course_id` — FK columns without explicit indexes (Sequelize auto-creates index on `references:` only when declared; these are declared via raw `foreignKey:` association without `references:` block).
- `lucy_devdb.courses.instructorId` — used by instructor course list, no index.
- `program_requests.user_id` — needs UNIQUE (implicit assumption of `ON DUPLICATE KEY UPDATE`) but no migration creates it.

### 9.2 Redundant / Duplicated Columns

- `users.collegeId` (FK-style string) **vs** `users.collegeName` (free text) **vs** `users.collegeCode` — three near-synonyms for the same concept.
- `users.educationLevel` + `users.yearOfEducation` + `users.yearOfStudy` + `users.graduationYear` — overlapping academic fields.
- `users.branchId` + `users.branch` (free text) — same overlap pattern.
- `colleges.branchIds[]` denormalised list (already covered by `branches` rows, depending on usage).
- `lucy_devdb.courses` and `lms_admin.courses` are two distinct catalogs of "courses" with no clear ownership boundary — same business entity stored twice.

### 9.3 Normalization Issues

- `Forum.likes` / `dislikes` stored as JSON-in-TEXT — not queryable, race-prone on concurrent likes.
- `Course.instructor_ids` (admin schema) as TEXT — opaque, can't FK or JOIN.
- `Course.clgIds[]` / `clg_ids[]` JSON arrays — denormalised many-to-many; no junction table for `course_colleges` makes the inverse query (`all courses for college X`) require `JSON_CONTAINS`.

### 9.4 Denormalization (intentional)

- `users.preScore` mirrored from `pre_assessment_results.score` — for sort/list performance ([StudentService.js:50-78](backend/admin-service/src/services/StudentService.js#L50-L78)).
- `program_requests` mirrors into `users.assignedProgram/programResponseStatus/programRespondedAt`.

### 9.5 Unused Tables / Models

- `Enrollment` (course-service `lucy_devdb.enrollments`) is **modeled but the actual enrollment flow uses `user_progress` in `lms_admin`** — appears dormant. Worth confirming usage.
- `Assessment` / `QuestionSet` / `Question` (assessment-service): Modeled, but the live pre-assessment flow uses `pre_assessment_registrations` + raw scoring. The structured assessment engine may be partial.

### 9.6 N+1 / Hot Spot Risks

- `/api/public/student/overview-stats` does one query per user but its per-course lesson tally pulls every enrolled course's lesson rows — fine when grouped, but reads the watchStore in-memory which is per-process (won't scale beyond one node).
- `watchStore` is **in-process memory** ([watchStore.js:9-10](backend/admin-service/src/course-content/watchStore.js#L9-L10)). Multi-instance deployment will fork divergent caches.
- College dashboard ([CollegeDashboardService.js](backend/admin-service/src/services/CollegeDashboardService.js)): performs 1 raw query + 2 grouped queries; acceptable.

### 9.7 Security Concerns

- **Plaintext DB credentials committed in every `.env`** (e.g. [backend/college-service/.env:6](backend/college-service/.env#L6)). Rotate immediately and add `.env` to `.gitignore`.
- **JWT secret `change-me-access`** committed in `.env` files and explicitly shared cross-service.
- No SSL/TLS options on Sequelize → MySQL connection (`dialectOptions.ssl` not set despite RDS support).
- `cors({ origin: true })` on auth-service ([app.js:125-128](backend/auth-service/src/app.js#L125-L128)) and `cors()` (wide-open) on admin-service ([server.js:29](backend/admin-service/src/server.js#L29)).
- Password column nullable in `lms_admin.users` ([User.js:26](backend/admin-service/src/models/User.js#L26)).
- BIGINT-typed `user_id` in admin tables is used to store `lucy_devdb.users.userId` (STRING) — risk of silent type coercion failures (already happened on `live_classes.user_id` INT clamp).

### 9.8 Data Consistency Risks

- Cross-DB writes are **not transactional** — e.g. `sendProgramRequest` can leave `program_requests` updated but `users` mirror untouched on partial failure.
- Two `users` tables with overlapping logical identity (`lucy_devdb.users` vs `lms_admin.users`) — root admin login in admin-service ignores the canonical user table; risk of stale role state.
- Two `courses` tables — public catalog reads from `lms_admin.courses`, but `course-service` writes to `lucy_devdb.courses`. The frontend admin curriculum uses `lms_admin`.

### 9.9 Naming Inconsistencies

- `camelCase` (lucy_devdb): `userId`, `clgId`, `createdAt`
- `snake_case` (lms_admin): `user_id`, `created_at`
- `Organisation` (model name) vs `organisations` (table) — UK/US split.
- Mixed pluralisation: `questionsets` (no separator), `pre_assessment_results` (snake), `forums`, `seo_fields`.

### 9.10 Scalability Concerns

- Single RDS instance for everything — no read-replica routing in any Sequelize config.
- `watchStore` in-memory makes admin-service stateful → blocks horizontal scaling.
- `sequelize.sync()` on boot is risky on prod — accidental drift between model and live schema can corrupt data.
- No connection pool tuning on 5 of 8 services (Sequelize defaults: max=5) — under load they will saturate before auth-service does.

---

## 10. Recommendations

### 10.1 Schema Optimization

1. **Consolidate the two `courses` tables.** Pick a single owner (likely `lms_admin.courses`) and remove the duplicate to eliminate writer ambiguity.
2. **Replace JSON-array many-to-many** (`courses.clgIds`, `categories.clg_ids`, `questionsets.questions`) with proper junction tables (`course_colleges`, `category_colleges`, `questionset_questions`) — enables FK enforcement and standard JOINs.
3. **Drop redundant academic-info columns** (`yearOfEducation` OR `yearOfStudy`, `branchId` OR `branch`) — keep one canonical column each.
4. **Create the `program_requests` migration** and a Sequelize model. Add `assignedProgram` etc to `User.js`.
5. **Soft-delete pattern** (`deletedAt` + `paranoid: true`) on `users` and `courses` to support future retention/GDPR work.

### 10.2 Performance / Indexes

| Add Index On | Why |
|---|---|
| `lucy_devdb.users(roleId)` | every student-list JOIN |
| `lucy_devdb.users(collegeId)` | every dashboard filter |
| `lucy_devdb.courses(instructorId)` | instructor course listing |
| `lms_admin.courses(slug)` UNIQUE | the public detail-page lookup key |
| `lms_admin.courses(category_id)`, `lessons(course_id)`, `lessons(section_id)`, `sections(course_id)` | declared associations but no index |
| `lms_admin.certificates(user_id, course_id)` UNIQUE | enforce one cert per (user, course) |
| `program_requests(user_id)` UNIQUE | required for `ON DUPLICATE KEY UPDATE` |

### 10.3 Relationship Improvements

- Declare `onDelete: 'CASCADE'` for parent–child relationships within a schema (`courses → sections → lessons`, `forums → forum_reports`).
- Make all logical cross-schema FKs explicit in service-layer guards (use `findByPk` on parent before writes).
- Replace `forums.likes/dislikes` JSON arrays with a `forum_reactions` join table (`forum_id, user_id, kind`).

### 10.4 Security

1. **Rotate the leaked DB password and JWT secret immediately.** Move secrets to AWS Secrets Manager or SSM Parameter Store; remove from `.env`.
2. Enable TLS on the MySQL connection — `dialectOptions: { ssl: { rejectUnauthorized: true } }`.
3. Tighten CORS — per-service explicit origin allow-list, not `*` / `true`.
4. Enforce `password NOT NULL` on `lms_admin.users` once existing rows are validated.
5. Audit cross-schema raw SQL for injection risk — current code uses parameterized `:replacements`, which is good — keep that discipline.

### 10.5 Operational / Best Practices

- Adopt `umzug` or `sequelize-cli` for **real migrations with a `SequelizeMeta` log** — replace the boot-time `ALTER TABLE` patches in `server.js`, which silently drift schema across environments.
- Centralise DB config: a shared `@yagnatech/db-config` module instead of seven near-identical `sequelize.js` files.
- Externalise the `watchStore` to Redis (or directly to MySQL with a write-through cache) so admin-service can run multi-instance.
- Wrap multi-statement writes in `sequelize.transaction()` — especially `sendProgramRequest` and any future enrollment/cert issuance flow.

### 10.6 Scalability

- Introduce an RDS read-replica and route read-heavy services (`course-service`, catalog queries in `admin-service`) through it.
- Increase `pool.max` to 20–30 on services serving public traffic; current defaults of 5 will throttle under modest load.
- Consider sharding `colleges → courses` data by `clgId` once the JSON-array many-to-many is replaced with a junction table.

---

### Appendix A — Files Referenced

| Layer | Path |
|---|---|
| Connection — auth | [backend/auth-service/src/db/index.js](backend/auth-service/src/db/index.js) |
| Connection — admin primary | [backend/admin-service/src/config/database.js](backend/admin-service/src/config/database.js) |
| Connection — admin cross-schema | [backend/admin-service/src/config/authDatabase.js](backend/admin-service/src/config/authDatabase.js) |
| Models — admin index | [backend/admin-service/src/models/index.js](backend/admin-service/src/models/index.js) |
| Boot hooks | [backend/admin-service/src/server.js](backend/admin-service/src/server.js) |
| Cross-schema raw SQL | [backend/admin-service/src/services/StudentService.js](backend/admin-service/src/services/StudentService.js), [backend/admin-service/src/services/CollegeDashboardService.js](backend/admin-service/src/services/CollegeDashboardService.js) |
| Migrations | [backend/auth-service/src/db/migrations/](backend/auth-service/src/db/migrations/), [backend/course-service/src/db/migrations/](backend/course-service/src/db/migrations/) |
| Seed scripts | [backend/auth-service/src/scripts/](backend/auth-service/src/scripts/), [backend/admin-service/src/scripts/](backend/admin-service/src/scripts/) |

---

*End of report.*
