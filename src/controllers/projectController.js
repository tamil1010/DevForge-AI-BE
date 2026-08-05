const db = require('../config/database');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');

const getProjects = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const projectsRes = await db.query(
    `SELECT p.*,
            (SELECT COUNT(*) FROM entities e WHERE e.project_id = p.id) as entity_count,
            (SELECT COUNT(*) FROM entities e WHERE e.project_id = p.id) as table_count
     FROM projects p
     WHERE p.user_id = $1
     ORDER BY p.updated_at DESC`,
    [userId]
  );

  const totalProjects = projectsRes.rows.length;
  const totalTables = projectsRes.rows.reduce((sum, p) => sum + parseInt(p.table_count || 0, 10), 0);

  res.status(200).json({
    success: true,
    stats: {
      totalProjects,
      totalTables
    },
    projects: projectsRes.rows
  });
});

const getProject = asyncHandler(async (req, res) => {
  const projectId = isNaN(parseInt(req.params.id, 10)) ? req.params.id : parseInt(req.params.id, 10);
  const userId = req.user.id;

  const projectRes = await db.query('SELECT * FROM projects WHERE id = $1', [projectId]);
  if (projectRes.rows.length === 0) {
    throw new ApiError(404, 'Database project not found.');
  }

  const project = projectRes.rows[0];

  if (project.user_id != userId) {
    throw new ApiError(403, 'Unauthorized access to project.');
  }

  const reqRes = await db.query('SELECT * FROM requirements WHERE project_id = $1', [projectId]);
  const requirement = reqRes.rows[0] || null;

  const entitiesRes = await db.query('SELECT * FROM entities WHERE project_id = $1 ORDER BY id ASC', [projectId]);
  const entities = [];

  for (let entity of entitiesRes.rows) {
    const attrRes = await db.query('SELECT * FROM attributes WHERE entity_id = $1 ORDER BY id ASC', [entity.id]);
    entities.push({
      id: entity.id,
      name: entity.name,
      description: entity.description,
      attributes: attrRes.rows.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.data_type,
        primaryKey: Boolean(a.is_primary_key),
        foreignKey: Boolean(a.is_foreign_key),
        nullable: Boolean(a.is_nullable),
        unique: Boolean(a.is_unique),
        autoIncrement: Boolean(a.is_auto_increment),
        defaultValue: a.default_value
      }))
    });
  }

  const relRes = await db.query('SELECT * FROM relationships WHERE project_id = $1 ORDER BY id ASC', [projectId]);

  const schemaRes = await db.query('SELECT * FROM generated_schemas WHERE project_id = $1', [projectId]);
  const schema = schemaRes.rows[0] ? (typeof schemaRes.rows[0].schema_json === 'string' ? JSON.parse(schemaRes.rows[0].schema_json) : schemaRes.rows[0].schema_json) : null;
  const normalizationStatus = schemaRes.rows[0] ? (typeof schemaRes.rows[0].normalization_status === 'string' ? JSON.parse(schemaRes.rows[0].normalization_status) : schemaRes.rows[0].normalization_status) : null;

  const sqlRes = await db.query('SELECT * FROM generated_sql WHERE project_id = $1', [projectId]);
  const generatedSql = sqlRes.rows[0] || null;

  const valRes = await db.query('SELECT * FROM validation_results WHERE project_id = $1', [projectId]);
  const validation = valRes.rows[0] ? {
    score: valRes.rows[0].score,
    isValid: Boolean(valRes.rows[0].is_valid),
    issues: typeof valRes.rows[0].issues === 'string' ? JSON.parse(valRes.rows[0].issues) : valRes.rows[0].issues
  } : null;

  const versionsRes = await db.query('SELECT id, version_number, created_at FROM project_versions WHERE project_id = $1 ORDER BY version_number DESC', [projectId]);

  res.status(200).json({
    success: true,
    project: {
      ...project,
      requirement: requirement ? {
        raw_text: requirement.raw_text,
        domain: requirement.domain,
        analysis: typeof requirement.analysis_json === 'string' ? JSON.parse(requirement.analysis_json) : requirement.analysis_json
      } : null,
      entities,
      relationships: relRes.rows.map((r) => ({
        id: r.id,
        source: r.source_entity,
        target: r.target_entity,
        type: r.type,
        sourceColumn: r.source_column,
        targetColumn: r.target_column,
        foreignKeyColumn: r.foreign_key_column,
        onDelete: r.on_delete,
        onUpdate: r.on_update,
        description: r.description
      })),
      schema,
      normalizationStatus,
      generatedSql,
      validation,
      versions: versionsRes.rows
    }
  });
});

const createProject = asyncHandler(async (req, res) => {
  const { name, description, databaseType, requirement } = req.body;
  const userId = req.user.id;

  if (!name) {
    throw new ApiError(400, 'Project name is required.');
  }

  const dbType = databaseType || 'PostgreSQL';

  const projectRes = await db.query(
    'INSERT INTO projects (user_id, name, description, database_type) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, name.trim(), description || '', dbType]
  );

  const project = projectRes.rows[0];

  if (requirement) {
    await db.query(
      'INSERT INTO requirements (project_id, raw_text) VALUES ($1, $2)',
      [project.id, requirement.trim()]
    );
  }

  res.status(201).json({
    success: true,
    message: 'Database design project created.',
    project
  });
});

const updateProject = asyncHandler(async (req, res) => {
  const projectId = isNaN(parseInt(req.params.id, 10)) ? req.params.id : parseInt(req.params.id, 10);
  const { name, description, database_type } = req.body;
  const userId = req.user.id;

  const checkRes = await db.query('SELECT user_id FROM projects WHERE id = $1', [projectId]);
  if (checkRes.rows.length === 0) throw new ApiError(404, 'Project not found.');
  if (checkRes.rows[0].user_id != userId) throw new ApiError(403, 'Unauthorized.');

  await db.query(
    `UPDATE projects
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         database_type = COALESCE($3, database_type),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4`,
    [name, description, database_type, projectId]
  );

  res.status(200).json({
    success: true,
    message: 'Project updated successfully.'
  });
});

const duplicateProject = asyncHandler(async (req, res) => {
  const projectId = isNaN(parseInt(req.params.id, 10)) ? req.params.id : parseInt(req.params.id, 10);
  const userId = req.user.id;

  const projRes = await db.query('SELECT * FROM projects WHERE id = $1', [projectId]);
  if (projRes.rows.length === 0) throw new ApiError(404, 'Project not found.');
  if (projRes.rows[0].user_id != userId) throw new ApiError(403, 'Unauthorized.');

  const orig = projRes.rows[0];
  const newName = `${orig.name} (Copy)`;

  const newProjRes = await db.query(
    'INSERT INTO projects (user_id, name, description, database_type) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, newName, orig.description, orig.database_type]
  );

  const newProject = newProjRes.rows[0];

  const reqRes = await db.query('SELECT * FROM requirements WHERE project_id = $1', [projectId]);
  if (reqRes.rows.length > 0) {
    await db.query(
      'INSERT INTO requirements (project_id, raw_text, domain, analysis_json) VALUES ($1, $2, $3, $4)',
      [newProject.id, reqRes.rows[0].raw_text, reqRes.rows[0].domain, reqRes.rows[0].analysis_json]
    );
  }

  const entitiesRes = await db.query('SELECT * FROM entities WHERE project_id = $1', [projectId]);
  for (let e of entitiesRes.rows) {
    const newEntRes = await db.query(
      'INSERT INTO entities (project_id, name, description) VALUES ($1, $2, $3) RETURNING id',
      [newProject.id, e.name, e.description]
    );
    const newEntId = newEntRes.rows[0].id;

    const attrRes = await db.query('SELECT * FROM attributes WHERE entity_id = $1', [e.id]);
    for (let a of attrRes.rows) {
      await db.query(
        `INSERT INTO attributes (entity_id, name, data_type, is_primary_key, is_foreign_key, is_nullable, is_unique, is_auto_increment, default_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [newEntId, a.name, a.data_type, a.is_primary_key, a.is_foreign_key, a.is_nullable, a.is_unique, a.is_auto_increment, a.default_value]
      );
    }
  }

  const relRes = await db.query('SELECT * FROM relationships WHERE project_id = $1', [projectId]);
  for (let r of relRes.rows) {
    await db.query(
      `INSERT INTO relationships (project_id, source_entity, target_entity, type, source_column, target_column, foreign_key_column, on_delete, on_update, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [newProject.id, r.source_entity, r.target_entity, r.type, r.source_column, r.target_column, r.foreign_key_column, r.on_delete, r.on_update, r.description]
    );
  }

  res.status(201).json({
    success: true,
    message: 'Project duplicated successfully.',
    project: newProject
  });
});

const deleteProject = asyncHandler(async (req, res) => {
  const projectId = isNaN(parseInt(req.params.id, 10)) ? req.params.id : parseInt(req.params.id, 10);
  const userId = req.user.id;

  const checkRes = await db.query('SELECT user_id FROM projects WHERE id = $1', [projectId]);
  if (checkRes.rows.length === 0) throw new ApiError(404, 'Project not found.');
  if (checkRes.rows[0].user_id != userId) throw new ApiError(403, 'Unauthorized.');

  await db.query('DELETE FROM projects WHERE id = $1', [projectId]);

  res.status(200).json({
    success: true,
    message: 'Project deleted successfully.'
  });
});

module.exports = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  duplicateProject,
  deleteProject
};
