const db = require('../config/database');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { createProjectVersion, compareVersions } = require('../services/versionService');

const verifyOwnership = async (projectId, userId) => {
  const res = await db.query('SELECT user_id FROM projects WHERE id = $1', [projectId]);
  if (res.rows.length === 0) throw new ApiError(404, 'Project not found.');
  if (res.rows[0].user_id !== userId) throw new ApiError(403, 'Unauthorized.');
};

const getVersions = asyncHandler(async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  const userId = req.user.id;

  await verifyOwnership(projectId, userId);

  const versionsRes = await db.query(
    'SELECT id, version_number, created_at FROM project_versions WHERE project_id = $1 ORDER BY version_number DESC',
    [projectId]
  );

  res.status(200).json({
    success: true,
    versions: versionsRes.rows
  });
});

const createVersion = asyncHandler(async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  const userId = req.user.id;

  await verifyOwnership(projectId, userId);

  const reqRes = await db.query('SELECT * FROM requirements WHERE project_id = $1', [projectId]);
  const entitiesRes = await db.query('SELECT * FROM entities WHERE project_id = $1', [projectId]);
  const relRes = await db.query('SELECT * FROM relationships WHERE project_id = $1', [projectId]);
  const schemaRes = await db.query('SELECT schema_json FROM generated_schemas WHERE project_id = $1', [projectId]);
  const sqlRes = await db.query('SELECT ddl_sql FROM generated_sql WHERE project_id = $1', [projectId]);

  const snapshot = {
    requirement: reqRes.rows[0] ? reqRes.rows[0].raw_text : '',
    entities: entitiesRes.rows,
    relationships: relRes.rows,
    schema: schemaRes.rows[0] ? (typeof schemaRes.rows[0].schema_json === 'string' ? JSON.parse(schemaRes.rows[0].schema_json) : schemaRes.rows[0].schema_json) : null,
    sql: sqlRes.rows[0] ? sqlRes.rows[0].ddl_sql : ''
  };

  const newVersion = await createProjectVersion(projectId, snapshot);

  res.status(201).json({
    success: true,
    message: `Version ${newVersion.version_number} snapshot created.`,
    version: newVersion
  });
});

const compareProjectVersions = asyncHandler(async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  const { v1, v2 } = req.query;
  const userId = req.user.id;

  await verifyOwnership(projectId, userId);

  const v1Res = await db.query('SELECT snapshot_json FROM project_versions WHERE project_id = $1 AND version_number = $2', [projectId, v1]);
  const v2Res = await db.query('SELECT snapshot_json FROM project_versions WHERE project_id = $1 AND version_number = $2', [projectId, v2]);

  if (v1Res.rows.length === 0 || v2Res.rows.length === 0) {
    throw new ApiError(404, 'Version snapshots not found.');
  }

  const snap1 = typeof v1Res.rows[0].snapshot_json === 'string' ? JSON.parse(v1Res.rows[0].snapshot_json) : v1Res.rows[0].snapshot_json;
  const snap2 = typeof v2Res.rows[0].snapshot_json === 'string' ? JSON.parse(v2Res.rows[0].snapshot_json) : v2Res.rows[0].snapshot_json;

  const diff = compareVersions(snap1, snap2);

  res.status(200).json({
    success: true,
    v1,
    v2,
    diff
  });
});

const restoreVersion = asyncHandler(async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  const versionNumber = parseInt(req.params.versionNumber, 10);
  const userId = req.user.id;

  await verifyOwnership(projectId, userId);

  const currentReq = await db.query('SELECT * FROM requirements WHERE project_id = $1', [projectId]);
  const currentEntities = await db.query('SELECT * FROM entities WHERE project_id = $1', [projectId]);
  const currentRels = await db.query('SELECT * FROM relationships WHERE project_id = $1', [projectId]);
  const currentSchema = await db.query('SELECT schema_json FROM generated_schemas WHERE project_id = $1', [projectId]);

  const currentSnapshot = {
    requirement: currentReq.rows[0] ? currentReq.rows[0].raw_text : '',
    entities: currentEntities.rows,
    relationships: currentRels.rows,
    schema: currentSchema.rows[0] ? (typeof currentSchema.rows[0].schema_json === 'string' ? JSON.parse(currentSchema.rows[0].schema_json) : currentSchema.rows[0].schema_json) : null
  };

  await createProjectVersion(projectId, currentSnapshot);

  const targetRes = await db.query('SELECT snapshot_json FROM project_versions WHERE project_id = $1 AND version_number = $2', [projectId, versionNumber]);
  if (targetRes.rows.length === 0) {
    throw new ApiError(404, `Version ${versionNumber} not found.`);
  }

  const targetSnap = typeof targetRes.rows[0].snapshot_json === 'string' ? JSON.parse(targetRes.rows[0].snapshot_json) : targetRes.rows[0].snapshot_json;

  if (targetSnap.schema) {
    await db.query(
      `INSERT INTO generated_schemas (project_id, schema_json, is_outdated)
       VALUES ($1, $2, FALSE)
       ON CONFLICT (project_id)
       DO UPDATE SET schema_json = EXCLUDED.schema_json, is_outdated = FALSE`,
      [projectId, JSON.stringify(targetSnap.schema)]
    );
  }

  res.status(200).json({
    success: true,
    message: `Restored to Version ${versionNumber}. Pre-restore backup snapshot saved.`
  });
});

module.exports = {
  getVersions,
  createVersion,
  compareProjectVersions,
  restoreVersion
};
