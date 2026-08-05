const db = require('../config/database');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { createProjectVersion, compareVersions } = require('../services/versionService');
const indexService = require('../services/indexService');

const parseId = (id) => {
  if (id === undefined || id === null) return id;
  const num = parseInt(id, 10);
  return isNaN(num) ? id : num;
};

const verifyOwnership = async (projectId, userId) => {
  const res = await db.query('SELECT user_id, database_type, name FROM projects WHERE id = $1', [projectId]);
  if (res.rows.length === 0) throw new ApiError(404, 'Project not found.');
  if (res.rows[0].user_id != userId) throw new ApiError(403, 'Unauthorized access to project.');
  return res.rows[0];
};

const getVersions = asyncHandler(async (req, res) => {
  const projectId = parseId(req.params.projectId || req.params.id);
  const userId = req.user.id;

  await verifyOwnership(projectId, userId);

  const versionsRes = await db.query(
    'SELECT id, project_id, version_number, snapshot_json, created_at FROM project_versions WHERE project_id = $1 ORDER BY version_number DESC',
    [projectId]
  );

  const formattedVersions = versionsRes.rows.map((row) => {
    let snap = {};
    try {
      snap = typeof row.snapshot_json === 'string' ? JSON.parse(row.snapshot_json) : row.snapshot_json;
    } catch (e) {
      snap = {};
    }

    const tableCount = snap.schema?.tables?.length || snap.entities?.length || 0;
    const relCount = snap.relationships?.length || 0;
    const validationScore = snap.validation?.score ?? 100;
    const performanceScore = snap.indexes?.summary?.performanceScore ?? 98;
    const aiCriticalCount = snap.aiReview?.criticalCount ?? 0;

    return {
      id: row.id,
      project_id: row.project_id,
      version_number: row.version_number,
      version_name: snap.version_name || `Version ${row.version_number}`,
      description: snap.description || 'Database design snapshot',
      tag: snap.tag || (row.version_number === 1 ? 'AI Generated' : 'Manual Changes'),
      created_by: snap.created_by || 'Demo Architect',
      database_type: snap.database_type || 'PostgreSQL',
      created_at: row.created_at,
      snapshot: snap,
      stats: {
        tableCount,
        relCount,
        validationScore,
        performanceScore,
        aiCriticalCount
      }
    };
  });

  res.status(200).json({
    success: true,
    versions: formattedVersions
  });
});

const createVersion = asyncHandler(async (req, res) => {
  const projectId = parseId(req.params.projectId || req.params.id);
  const userId = req.user.id;
  const { versionName, description, tag } = req.body || {};

  const project = await verifyOwnership(projectId, userId);

  // Fetch full active workspace state
  const reqRes = await db.query('SELECT * FROM requirements WHERE project_id = $1', [projectId]);
  const entitiesRes = await db.query('SELECT * FROM entities WHERE project_id = $1', [projectId]);
  const relRes = await db.query('SELECT * FROM relationships WHERE project_id = $1', [projectId]);
  const schemaRes = await db.query('SELECT schema_json FROM generated_schemas WHERE project_id = $1', [projectId]);
  const sqlRes = await db.query('SELECT ddl_sql, sample_data_sql, dialect FROM generated_sql WHERE project_id = $1', [projectId]);
  const valRes = await db.query('SELECT score, is_valid, issues FROM validation_results WHERE project_id = $1', [projectId]);
  const aiRevRes = await db.query('SELECT * FROM ai_reviews WHERE project_id = $1 ORDER BY review_number DESC LIMIT 1', [projectId]);
  const idxRes = await db.query('SELECT applied_indexes_json, ignored_indexes_json, ai_analysis_json FROM index_recommendations WHERE project_id = $1', [projectId]);

  // Fetch attributes for entities
  const entityList = [];
  for (const ent of entitiesRes.rows) {
    const attrRes = await db.query('SELECT * FROM attributes WHERE entity_id = $1 ORDER BY id ASC', [ent.id]);
    entityList.push({
      id: ent.id,
      name: ent.name,
      description: ent.description,
      attributes: attrRes.rows.map(a => ({
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

  const schemaObj = schemaRes.rows[0] ? (typeof schemaRes.rows[0].schema_json === 'string' ? JSON.parse(schemaRes.rows[0].schema_json) : schemaRes.rows[0].schema_json) : null;
  const sqlObj = sqlRes.rows[0] ? { ddlSql: sqlRes.rows[0].ddl_sql, sampleDataSql: sqlRes.rows[0].sample_data_sql, dialect: sqlRes.rows[0].dialect } : null;

  let valObj = null;
  if (valRes.rows[0]) {
    let issuesArr = [];
    try { issuesArr = typeof valRes.rows[0].issues === 'string' ? JSON.parse(valRes.rows[0].issues) : valRes.rows[0].issues; } catch(e) {}
    valObj = { score: valRes.rows[0].score, isValid: Boolean(valRes.rows[0].is_valid), issues: issuesArr };
  }

  let aiRevObj = null;
  if (aiRevRes.rows[0]) {
    let revData = null;
    try { revData = typeof aiRevRes.rows[0].review_data === 'string' ? JSON.parse(aiRevRes.rows[0].review_data) : aiRevRes.rows[0].review_data; } catch(e) {}
    aiRevObj = {
      summary: aiRevRes.rows[0].summary,
      totalSuggestions: aiRevRes.rows[0].total_suggestions,
      criticalCount: aiRevRes.rows[0].critical_count,
      warningCount: aiRevRes.rows[0].warning_count,
      improvementCount: aiRevRes.rows[0].improvement_count,
      reviewData: revData
    };
  }

  let appliedIdxs = [];
  let ignoredIdxs = [];
  let aiIdxAnalysis = null;
  if (idxRes.rows[0]) {
    try { if (idxRes.rows[0].applied_indexes_json) appliedIdxs = JSON.parse(idxRes.rows[0].applied_indexes_json); } catch(e) {}
    try { if (idxRes.rows[0].ignored_indexes_json) ignoredIdxs = JSON.parse(idxRes.rows[0].ignored_indexes_json); } catch(e) {}
    try { if (idxRes.rows[0].ai_analysis_json) aiIdxAnalysis = JSON.parse(idxRes.rows[0].ai_analysis_json); } catch(e) {}
  }

  const indexObj = indexService.generateIndexRecommendations(
    schemaObj,
    project.database_type,
    appliedIdxs,
    ignoredIdxs,
    aiIdxAnalysis?.aiSuggestions || []
  );

  const userRes = await db.query('SELECT full_name FROM users WHERE id = $1', [userId]);
  const userName = userRes.rows[0]?.full_name || 'Demo Architect';

  const snapshot = {
    version_name: versionName || `${project.name} Snapshot`,
    description: description || 'Complete immutable snapshot of database design.',
    tag: tag || 'Manual Snapshot',
    created_by: userName,
    database_type: project.database_type || 'PostgreSQL',
    created_at: new Date().toISOString(),
    requirement: reqRes.rows[0] ? reqRes.rows[0].raw_text : '',
    domain: reqRes.rows[0] ? reqRes.rows[0].domain : '',
    entities: entityList,
    relationships: relRes.rows,
    schema: schemaObj,
    sql: sqlObj,
    validation: valObj,
    aiReview: aiRevObj,
    indexes: indexObj
  };

  const newVersion = await createProjectVersion(projectId, snapshot);

  res.status(201).json({
    success: true,
    message: `Version ${newVersion.version_number} snapshot created successfully.`,
    version: {
      id: newVersion.id,
      project_id: projectId,
      version_number: newVersion.version_number,
      version_name: snapshot.version_name,
      description: snapshot.description,
      tag: snapshot.tag,
      created_by: snapshot.created_by,
      database_type: snapshot.database_type,
      created_at: newVersion.created_at,
      snapshot,
      stats: {
        tableCount: schemaObj?.tables?.length || entityList.length,
        relCount: relRes.rows.length,
        validationScore: valObj?.score ?? 100,
        performanceScore: indexObj?.summary?.performanceScore ?? 98,
        aiCriticalCount: aiRevObj?.criticalCount ?? 0
      }
    }
  });
});

const compareProjectVersions = asyncHandler(async (req, res) => {
  const projectId = parseId(req.params.projectId || req.params.id);
  const { v1, v2 } = req.query;
  const userId = req.user.id;

  await verifyOwnership(projectId, userId);

  const v1Res = await db.query('SELECT snapshot_json FROM project_versions WHERE project_id = $1 AND version_number = $2', [projectId, v1]);
  const v2Res = await db.query('SELECT snapshot_json FROM project_versions WHERE project_id = $1 AND version_number = $2', [projectId, v2]);

  if (v1Res.rows.length === 0 || v2Res.rows.length === 0) {
    throw new ApiError(404, 'One or both version snapshots could not be found.');
  }

  const snap1 = typeof v1Res.rows[0].snapshot_json === 'string' ? JSON.parse(v1Res.rows[0].snapshot_json) : v1Res.rows[0].snapshot_json;
  const snap2 = typeof v2Res.rows[0].snapshot_json === 'string' ? JSON.parse(v2Res.rows[0].snapshot_json) : v2Res.rows[0].snapshot_json;

  const diff = compareVersions(snap1, snap2);

  res.status(200).json({
    success: true,
    v1,
    v2,
    v1Name: snap1.version_name || `Version ${v1}`,
    v2Name: snap2.version_name || `Version ${v2}`,
    diff
  });
});

const restoreVersion = asyncHandler(async (req, res) => {
  const projectId = parseId(req.params.projectId || req.params.id);
  const versionNumber = parseInt(req.params.versionNumber, 10);
  const userId = req.user.id;

  const project = await verifyOwnership(projectId, userId);

  // 1. Fetch target version snapshot to restore
  const targetRes = await db.query('SELECT snapshot_json FROM project_versions WHERE project_id = $1 AND version_number = $2', [projectId, versionNumber]);
  if (targetRes.rows.length === 0) {
    throw new ApiError(404, `Version ${versionNumber} snapshot not found.`);
  }
  const targetSnap = typeof targetRes.rows[0].snapshot_json === 'string' ? JSON.parse(targetRes.rows[0].snapshot_json) : targetRes.rows[0].snapshot_json;

  // 2. Create automatic pre-restore backup version of active state
  const reqRes = await db.query('SELECT * FROM requirements WHERE project_id = $1', [projectId]);
  const entitiesRes = await db.query('SELECT * FROM entities WHERE project_id = $1', [projectId]);
  const relRes = await db.query('SELECT * FROM relationships WHERE project_id = $1', [projectId]);
  const schemaRes = await db.query('SELECT schema_json FROM generated_schemas WHERE project_id = $1', [projectId]);
  const sqlRes = await db.query('SELECT ddl_sql FROM generated_sql WHERE project_id = $1', [projectId]);

  const userRes = await db.query('SELECT full_name FROM users WHERE id = $1', [userId]);
  const userName = userRes.rows[0]?.full_name || 'Demo Architect';

  const backupSnapshot = {
    version_name: `Pre-restore Backup (before v${versionNumber})`,
    description: `Auto-saved backup snapshot created prior to restoring Version ${versionNumber}.`,
    tag: 'Restored',
    created_by: userName,
    database_type: project.database_type || 'PostgreSQL',
    created_at: new Date().toISOString(),
    requirement: reqRes.rows[0] ? reqRes.rows[0].raw_text : '',
    entities: entitiesRes.rows,
    relationships: relRes.rows,
    schema: schemaRes.rows[0] ? (typeof schemaRes.rows[0].schema_json === 'string' ? JSON.parse(schemaRes.rows[0].schema_json) : schemaRes.rows[0].schema_json) : null,
    sql: sqlRes.rows[0] ? { ddlSql: sqlRes.rows[0].ddl_sql } : null
  };

  await createProjectVersion(projectId, backupSnapshot);

  // 3. Restore active database state from targetSnap
  if (targetSnap.entities && Array.isArray(targetSnap.entities)) {
    // Clear active entities & attributes
    const existingEnts = await db.query('SELECT id FROM entities WHERE project_id = $1', [projectId]);
    for (const ent of existingEnts.rows) {
      await db.query('DELETE FROM attributes WHERE entity_id = $1', [ent.id]);
    }
    await db.query('DELETE FROM entities WHERE project_id = $1', [projectId]);

    // Restore entities & attributes
    for (const ent of targetSnap.entities) {
      const newEnt = await db.query(
        'INSERT INTO entities (project_id, name, description) VALUES ($1, $2, $3) RETURNING id',
        [projectId, ent.name, ent.description || '']
      );
      const entId = newEnt.rows[0].id;

      if (ent.attributes && Array.isArray(ent.attributes)) {
        for (const attr of ent.attributes) {
          await db.query(
            `INSERT INTO attributes (entity_id, name, data_type, is_primary_key, is_foreign_key, is_nullable, is_unique, is_auto_increment, default_value)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              entId,
              attr.name,
              attr.type || attr.data_type || 'VARCHAR(255)',
              attr.primaryKey ? 1 : 0,
              attr.foreignKey ? 1 : 0,
              attr.nullable ? 1 : 0,
              attr.unique ? 1 : 0,
              attr.autoIncrement ? 1 : 0,
              attr.defaultValue || null
            ]
          );
        }
      }
    }
  }

  if (targetSnap.relationships && Array.isArray(targetSnap.relationships)) {
    await db.query('DELETE FROM relationships WHERE project_id = $1', [projectId]);
    for (const rel of targetSnap.relationships) {
      await db.query(
        `INSERT INTO relationships (project_id, source_entity, target_entity, type, source_column, target_column, foreign_key_column, on_delete, on_update, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          projectId,
          rel.source_entity || rel.source || rel.from,
          rel.target_entity || rel.target || rel.to,
          rel.type,
          rel.source_column || rel.sourceColumn || null,
          rel.target_column || rel.targetColumn || null,
          rel.foreign_key_column || rel.foreignKeyColumn || null,
          rel.on_delete || rel.onDelete || 'CASCADE',
          rel.on_update || rel.onUpdate || 'CASCADE',
          rel.description || ''
        ]
      );
    }
  }

  if (targetSnap.schema) {
    await db.query(
      `INSERT INTO generated_schemas (project_id, schema_json, is_outdated)
       VALUES ($1, $2, FALSE)
       ON CONFLICT (project_id)
       DO UPDATE SET schema_json = EXCLUDED.schema_json, is_outdated = FALSE`,
      [projectId, JSON.stringify(targetSnap.schema)]
    );
  }

  if (targetSnap.sql) {
    const ddl = typeof targetSnap.sql === 'string' ? targetSnap.sql : targetSnap.sql.ddlSql;
    const sample = typeof targetSnap.sql === 'object' ? targetSnap.sql.sampleDataSql : '';
    await db.query(
      `INSERT INTO generated_sql (project_id, ddl_sql, sample_data_sql, dialect, is_outdated)
       VALUES ($1, $2, $3, $4, FALSE)
       ON CONFLICT (project_id)
       DO UPDATE SET ddl_sql = EXCLUDED.ddl_sql, sample_data_sql = EXCLUDED.sample_data_sql, is_outdated = FALSE`,
      [projectId, ddl || '', sample || '', project.database_type || 'PostgreSQL']
    );
  }

  res.status(200).json({
    success: true,
    message: `Restored Version ${versionNumber} successfully. Automatic pre-restore backup version created.`
  });
});

const deleteVersion = asyncHandler(async (req, res) => {
  const projectId = parseId(req.params.projectId || req.params.id);
  const versionNumber = parseInt(req.params.versionNumber, 10);
  const userId = req.user.id;

  if (!projectId || isNaN(versionNumber)) {
    throw new ApiError(400, 'Invalid project ID or version number.');
  }

  await verifyOwnership(projectId, userId);

  await db.query(
    'DELETE FROM project_versions WHERE project_id = $1 AND version_number = $2',
    [projectId, versionNumber]
  );

  res.status(200).json({
    success: true,
    message: `Version ${versionNumber} deleted successfully.`
  });
});

module.exports = {
  getVersions,
  createVersion,
  compareProjectVersions,
  restoreVersion,
  deleteVersion
};
