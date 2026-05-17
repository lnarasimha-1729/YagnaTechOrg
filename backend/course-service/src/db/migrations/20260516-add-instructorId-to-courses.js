// Sequelize migration: add instructorId column to courses.
// Usage (sequelize-cli): npx sequelize-cli db:migrate
//
// Idempotent: skips when the column already exists, so it is safe to run on
// fresh dev DBs where sequelize.sync() already created the column.

export async function up(queryInterface, Sequelize) {
  const table = await queryInterface.describeTable('courses');
  if (table.instructorId) return;

  await queryInterface.addColumn('courses', 'instructorId', {
    // auth-service userId of an instructor (string). Nullable so existing
    // rows authored before instructor assignment existed keep working.
    type: Sequelize.STRING,
    allowNull: true,
  });
}

export async function down(queryInterface) {
  await queryInterface.removeColumn('courses', 'instructorId');
}
