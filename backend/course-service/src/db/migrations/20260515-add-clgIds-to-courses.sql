-- Migration: add clgIds JSON column to courses for multi-college course offerings.
--
-- Notes:
-- * Column is JSON-typed to mirror the Sequelize model (DataTypes.JSON).
-- * NOT NULL with default empty array — existing rows are backfilled in the
--   same statement so the column can stay non-nullable from the start.
-- * No FK: colleges live in college-service. Application-layer validation
--   in course.controller calls college-service before INSERT/UPDATE.

ALTER TABLE `courses`
  ADD COLUMN `clgIds` JSON NOT NULL DEFAULT (JSON_ARRAY())
  AFTER `modules`;

-- Backfill any pre-existing NULLs in case the column existed without default.
UPDATE `courses` SET `clgIds` = JSON_ARRAY() WHERE `clgIds` IS NULL;

-- Optional: generated column + index if you frequently query by a single
-- clgId. JSON_CONTAINS works without it; uncomment if profiling shows a
-- bottleneck on /course/by-college/:clgId.
--
-- ALTER TABLE `courses`
--   ADD COLUMN `clgIdsText` VARCHAR(2048) GENERATED ALWAYS AS (JSON_UNQUOTE(`clgIds`)) STORED,
--   ADD INDEX `idx_courses_clgIdsText` (`clgIdsText`);

-- Rollback:
-- ALTER TABLE `courses` DROP COLUMN `clgIds`;
