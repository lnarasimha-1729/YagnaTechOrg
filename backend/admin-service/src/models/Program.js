const { DataTypes } = require('sequelize');

// Programs are the high-level offerings shown on the public Programs page
// (AI Frontier, AI Frontier Plus, Elite AI Residency, etc.). Each program is
// rendered as a card with: a title, a one-line tagline, an icon, and a bulleted
// feature list. The admin creates these via the new /admin/programs page; the
// public catalog reads them through a public endpoint.
module.exports = (sequelize) => {
    const Program = sequelize.define('Program', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        title: { type: DataTypes.STRING(255), allowNull: false },
        // Short one-line description shown under the title.
        tagline: { type: DataTypes.STRING(500) },
        // Lucide icon key (e.g. 'Globe2', 'GraduationCap', 'Building2'). The
        // public renderer maps this to the actual lucide-react component.
        // Free-form string so admins can pick from any lucide icon without
        // requiring a schema change to extend the set.
        icon: { type: DataTypes.STRING(64), defaultValue: 'Globe2' },
        // Bullet points the card lists below the tagline. Stored as JSON so the
        // admin can add/remove items without column changes.
        features: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
        sort: { type: DataTypes.INTEGER, defaultValue: 0 },
        // Active programs are surfaced to the public catalog; inactive ones
        // stay editable in admin but don't render to students.
        is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
        // Colleges this program is offered at — same JSON-array shape Course
        // uses (clg_ids holds string clgIds from the colleges table). Lets a
        // program be available to one or many colleges simultaneously.
        clg_ids: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
        // Legacy single-course FK. Kept for back-compat — older rows store the
        // selected course here. New writes use course_ids (below); when both
        // are present, course_ids is authoritative.
        course_id: { type: DataTypes.INTEGER, allowNull: true },
        // Courses this program includes. JSON array of course ids (numbers
        // stored as strings or ints — both are accepted on read). Same shape
        // clg_ids uses. Allows a program to bundle multiple courses.
        course_ids: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
    }, {
        tableName: 'programs',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    });

    return Program;
};
