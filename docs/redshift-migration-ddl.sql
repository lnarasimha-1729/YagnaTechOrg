-- =============================================================================
-- Redshift schema alignment DDL
--
-- Generated from docs/redshift-migration-diff.md.
-- Run this against the Redshift Serverless cluster (workgroup: lms-workgroup,
-- database: dev) in Query Editor v2 BEFORE migrating app data.
--
-- What this does:
--   1. Creates 3 missing tables in schema lms_admin:
--        batches, batch_members, programs
--   2. Adds 4 missing columns:
--        lms_admin.courses.has_certificate
--        lucy_devdb.program_requests.id  (new identity column)
--        lucy_devdb.program_requests.note
--        lucy_devdb.users.quizscores
--        lucy_devdb.users.postscoreduration
--        lucy_devdb.assessments.clgids
--        lucy_devdb.assessments.courseids
--
-- What this does NOT do:
--   - Create lucy_devdb.certificates or lucy_devdb.settings. These tables exist
--     in MySQL but are not referenced by any code in this repo (grep for
--     FROM settings / authDb...certificates returns nothing). Skipping.
--   - Migrate data. This is schema only. Data load is a separate runbook.
--   - Resolve type mismatches (tinyint↔bool, datetime↔date). These are handled
--     at COPY time with explicit casts; no DDL change needed.
--
-- Redshift notes:
--   - Identifiers fold to lowercase. We declare every column lowercase.
--   - VARCHAR sizes are bytes, not characters. Multi-byte content needs ≥3×
--     the char count. The original utf8mb4_unicode_ci columns are upsized
--     where practical (varchar(64) → varchar(255), varchar(160) → varchar(255))
--     because Redshift has no storage cost difference and avoids surprises.
--   - IDENTITY(seed, step) is used for auto-increment, but Redshift does NOT
--     guarantee gap-free or strictly-sequential values under concurrent insert.
--     If the app depends on sequential IDs anywhere, that needs review.
--   - No DISTKEY/SORTKEY is declared. Redshift defaults to AUTO distribution
--     and AUTO sortkey for new tables. Fine for low-volume admin tables;
--     revisit for the high-cardinality user_progress / lesson_completions
--     tables (out of scope here — they already exist in Redshift).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. lms_admin.batches
--    Cohort of students at a college. Owned by a college (clg_id refers to
--    lucy_devdb.colleges.clgid). Members live in batch_members.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lms_admin.batches (
    id          INTEGER       IDENTITY(1, 1) NOT NULL,
    clg_id      VARCHAR(255)  NOT NULL,
    name        VARCHAR(255)  NOT NULL,
    description VARCHAR(500),
    start_date  DATE,
    end_date    DATE,
    is_active   BOOLEAN       DEFAULT TRUE,
    created_at  TIMESTAMP     DEFAULT GETDATE(),
    updated_at  TIMESTAMP     DEFAULT GETDATE(),
    PRIMARY KEY (id)
);
-- NOTE: Redshift does NOT enforce the PK. The application must avoid duplicate
-- id values (IDENTITY is best-effort). It also does not auto-update updated_at;
-- the application is already setting that explicitly via Sequelize.


-- -----------------------------------------------------------------------------
-- 2. lms_admin.batch_members
--    Link table: batch ↔ student. (batch_id, user_id) is the natural key.
--    user_id is a string because lucy_devdb.users.userid is varchar.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lms_admin.batch_members (
    id         INTEGER      IDENTITY(1, 1) NOT NULL,
    batch_id   INTEGER      NOT NULL,
    user_id    VARCHAR(255) NOT NULL,
    created_at TIMESTAMP    DEFAULT GETDATE(),
    updated_at TIMESTAMP    DEFAULT GETDATE(),
    PRIMARY KEY (id),
    UNIQUE     (batch_id, user_id)  -- declared but NOT enforced by Redshift
);


-- -----------------------------------------------------------------------------
-- 3. lms_admin.programs
--    Public catalog of programs. JSON columns hold ordered lists (features,
--    clg_ids, course_ids). Redshift has no JSON type — store as SUPER for
--    structured access, or as VARCHAR(65535) and parse in code.
--    We use SUPER because the app already does .map/.filter over these arrays
--    and SUPER supports PartiQL access without a custom parser.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lms_admin.programs (
    id         INTEGER      IDENTITY(1, 1) NOT NULL,
    title      VARCHAR(255) NOT NULL,
    tagline    VARCHAR(500),
    icon       VARCHAR(64)  DEFAULT 'Globe2',
    features   SUPER,
    sort       INTEGER      DEFAULT 0,
    is_active  BOOLEAN      DEFAULT TRUE,
    clg_ids    SUPER,
    course_id  INTEGER,
    course_ids SUPER,
    created_at TIMESTAMP    DEFAULT GETDATE(),
    updated_at TIMESTAMP    DEFAULT GETDATE(),
    PRIMARY KEY (id)
);


-- -----------------------------------------------------------------------------
-- 4. Missing columns
--
-- 4a. lms_admin.courses.has_certificate — drives whether a course issues a cert
--     on completion. Without it, every course would default to "no certificate"
--     and the certificate-issuance flow breaks silently.
-- -----------------------------------------------------------------------------
ALTER TABLE lms_admin.courses
    ADD COLUMN has_certificate BOOLEAN DEFAULT FALSE;


-- -----------------------------------------------------------------------------
-- 4b. lucy_devdb.program_requests.id
--     MySQL has an auto-increment integer PK. Redshift schema only has
--     (user_id, program). The code (StudentService.programRequest) UPSERTs
--     and does not reference .id directly, BUT Sequelize models tend to assume
--     an `id` column exists. Adding one is cheap insurance.
--
--     IDENTITY is added as a new column with no backfill; existing rows would
--     have NULL. Workaround: drop & recreate the table is the only clean fix
--     because Redshift cannot retrofit IDENTITY onto an existing column.
--     Since the table is small and the app re-creates rows on upsert, the
--     simplest path is:
-- -----------------------------------------------------------------------------
-- (Only run if you're OK losing existing program_requests rows.)
-- DROP TABLE lucy_devdb.program_requests;
-- CREATE TABLE lucy_devdb.program_requests (
--     id           INTEGER      IDENTITY(1, 1) NOT NULL,
--     user_id      VARCHAR(255) NOT NULL,
--     program      VARCHAR(100) NOT NULL,
--     requested_by VARCHAR(255),
--     status       VARCHAR(20)  NOT NULL DEFAULT 'sent',
--     note         VARCHAR(500),
--     responded_at TIMESTAMP,
--     created_at   TIMESTAMP    DEFAULT GETDATE(),
--     updated_at   TIMESTAMP    DEFAULT GETDATE(),
--     PRIMARY KEY (id),
--     UNIQUE       (user_id, program)
-- );

-- Safer alternative: keep current shape, just add the missing `note` column.
ALTER TABLE lucy_devdb.program_requests
    ADD COLUMN note VARCHAR(500);


-- -----------------------------------------------------------------------------
-- 4c. lucy_devdb.users.quizscores  &  lucy_devdb.users.postscoreduration
--     quizscores is JSON in MySQL → SUPER in Redshift (per-quiz score map).
--     postscoreduration is the post-assessment duration in seconds, mirrors
--     the existing prescoreduration column.
-- -----------------------------------------------------------------------------
ALTER TABLE lucy_devdb.users
    ADD COLUMN quizscores SUPER;

ALTER TABLE lucy_devdb.users
    ADD COLUMN postscoreduration INTEGER;


-- -----------------------------------------------------------------------------
-- 4d. lucy_devdb.assessments.clgids  &  lucy_devdb.assessments.courseids
--     Scope an assessment to specific colleges / courses. JSON arrays in
--     MySQL → SUPER in Redshift.
-- -----------------------------------------------------------------------------
ALTER TABLE lucy_devdb.assessments
    ADD COLUMN clgids SUPER;

ALTER TABLE lucy_devdb.assessments
    ADD COLUMN courseids SUPER;


-- =============================================================================
-- Verification queries (run after the DDL applies cleanly)
-- =============================================================================

-- 1. All three new tables exist and are empty.
SELECT 'batches'        AS table_name, COUNT(*) AS rows FROM lms_admin.batches
UNION ALL
SELECT 'batch_members', COUNT(*) FROM lms_admin.batch_members
UNION ALL
SELECT 'programs',      COUNT(*) FROM lms_admin.programs;

-- 2. All new columns are present.
SELECT table_schema, table_name, column_name, data_type
  FROM information_schema.columns
 WHERE (table_schema, table_name, column_name) IN (
       ('lms_admin', 'courses',          'has_certificate'),
       ('lucy_devdb', 'program_requests', 'note'),
       ('lucy_devdb', 'users',            'quizscores'),
       ('lucy_devdb', 'users',            'postscoreduration'),
       ('lucy_devdb', 'assessments',      'clgids'),
       ('lucy_devdb', 'assessments',      'courseids')
       )
 ORDER BY table_schema, table_name, column_name;

-- Expected: 6 rows. If you see fewer, the ALTER didn't apply (check for errors).
