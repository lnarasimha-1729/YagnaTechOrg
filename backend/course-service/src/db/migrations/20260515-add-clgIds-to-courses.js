// Sequelize migration: add clgIds JSON column to courses.
// Usage (sequelize-cli): npx sequelize-cli db:migrate
// Or run programmatically via queryInterface.
//
// Idempotent: skips when the column already exists, so it is safe to run on
// fresh dev DBs where sequelize.sync() already created the column.

export async function up(queryInterface, Sequelize) {
  const table = await queryInterface.describeTable('courses');
  if (table.clgIds) return;

  await queryInterface.addColumn('courses', 'clgIds', {
    type: Sequelize.JSON,
    allowNull: false,
    defaultValue: [],
  });

  // Backfill existing rows so the NOT NULL constraint holds.
  await queryInterface.sequelize.query(
    "UPDATE `courses` SET `clgIds` = JSON_ARRAY() WHERE `clgIds` IS NULL"
  );
}

export async function down(queryInterface) {
  await queryInterface.removeColumn('courses', 'clgIds');
}
