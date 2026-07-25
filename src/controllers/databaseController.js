const db = require('../config/database');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const aiService = require('../services/aiService');
const schemaService = require('../services/schemaService');
const normalizationService = require('../services/normalizationService');
const sqlGeneratorService = require('../services/sqlGeneratorService');
const validationService = require('../services/validationService');
const indexService = require('../services/indexService');

const verifyOwnership = async (projectId, userId) => {
  const res = await db.query('SELECT user_id, database_type FROM projects WHERE id = $1', [projectId]);
  if (res.rows.length === 0) throw new ApiError(404, 'Database project not found.');
  if (res.rows[0].user_id !== userId) throw new ApiError(403, 'Unauthorized access to project.');
  return res.rows[0];
};

const analyzeRequirement = asyncHandler(async (req, res) => {
  const { projectId, projectName, requirement, databaseType } = req.body;
  const userId = req.user.id;

  let targetProjectId = projectId;
  let dbType = databaseType || 'PostgreSQL';

  if (targetProjectId) {
    await verifyOwnership(targetProjectId, userId);
  } else {
    const newProj = await db.query(
      'INSERT INTO projects (user_id, name, description, database_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, projectName || 'New Database Design', 'AI Database Design', dbType]
    );
    targetProjectId = newProj.rows[0].id;
  }

  if (!requirement || requirement.trim().length < 10) {
    throw new ApiError(400, 'Requirement text must be at least 10 characters long.');
  }

  const analysis = await aiService.analyzeRequirement(requirement, dbType);
  const reqJson = JSON.stringify(analysis);

  await db.query(
    `INSERT INTO requirements (project_id, raw_text, domain, analysis_json)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (project_id)
     DO UPDATE SET raw_text = EXCLUDED.raw_text, domain = EXCLUDED.domain, analysis_json = EXCLUDED.analysis_json, updated_at = CURRENT_TIMESTAMP`,
    [targetProjectId, requirement, analysis.domain, reqJson]
  );

  if (analysis.entities && analysis.entities.length > 0) {
    await db.query('DELETE FROM entities WHERE project_id = $1', [targetProjectId]);
    await db.query('DELETE FROM relationships WHERE project_id = $1', [targetProjectId]);

    for (let ent of analysis.entities) {
      const entRes = await db.query(
        'INSERT INTO entities (project_id, name) VALUES ($1, $2) RETURNING id',
        [targetProjectId, ent.name]
      );
      const entId = entRes.rows[0].id;

      if (ent.attributes) {
        for (let attr of ent.attributes) {
          await db.query(
            `INSERT INTO attributes (entity_id, name, data_type, is_primary_key, is_foreign_key, is_nullable, is_unique, is_auto_increment, default_value)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [entId, attr.name, attr.type, attr.primaryKey, attr.foreignKey, attr.nullable, attr.unique, attr.autoIncrement, attr.defaultValue || null]
          );
        }
      }
    }
  }

  if (analysis.relationships && analysis.relationships.length > 0) {
    for (let rel of analysis.relationships) {
      const src = rel.source || rel.from;
      const tgt = rel.target || rel.to;
      await db.query(
        `INSERT INTO relationships (project_id, source_entity, target_entity, type, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [targetProjectId, src, tgt, rel.type, rel.description || '']
      );
    }
  }

  await db.query('UPDATE projects SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['analyzed', targetProjectId]);

  res.status(200).json({
    success: true,
    projectId: targetProjectId,
    analysis
  });
});

const saveEntities = asyncHandler(async (req, res) => {
  const { projectId, entities } = req.body;
  const userId = req.user.id;

  await verifyOwnership(projectId, userId);

  if (!Array.isArray(entities)) {
    throw new ApiError(400, 'Entities must be an array.');
  }

  await db.query('DELETE FROM entities WHERE project_id = $1', [projectId]);

  for (let ent of entities) {
    if (!ent.name || !ent.name.trim()) continue;
    const entRes = await db.query(
      'INSERT INTO entities (project_id, name, description) VALUES ($1, $2, $3) RETURNING id',
      [projectId, ent.name.trim(), ent.description || '']
    );
    const entId = entRes.rows[0].id;

    if (Array.isArray(ent.attributes)) {
      for (let attr of ent.attributes) {
        if (!attr.name || !attr.name.trim()) continue;
        await db.query(
          `INSERT INTO attributes (entity_id, name, data_type, is_primary_key, is_foreign_key, is_nullable, is_unique, is_auto_increment, default_value)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            entId,
            attr.name.trim(),
            attr.type || 'VARCHAR(255)',
            Boolean(attr.primaryKey),
            Boolean(attr.foreignKey),
            Boolean(attr.nullable),
            Boolean(attr.unique),
            Boolean(attr.autoIncrement),
            attr.defaultValue || null
          ]
        );
      }
    }
  }

  await db.query('UPDATE generated_schemas SET is_outdated = TRUE WHERE project_id = $1', [projectId]);
  await db.query('UPDATE generated_sql SET is_outdated = TRUE WHERE project_id = $1', [projectId]);

  res.status(200).json({
    success: true,
    message: 'Entity model saved.'
  });
});

const saveRelationships = asyncHandler(async (req, res) => {
  const { projectId, relationships } = req.body;
  const userId = req.user.id;

  await verifyOwnership(projectId, userId);

  await db.query('DELETE FROM relationships WHERE project_id = $1', [projectId]);

  if (Array.isArray(relationships)) {
    for (let rel of relationships) {
      const src = rel.source || rel.from;
      const tgt = rel.target || rel.to;
      if (!src || !tgt || !rel.type) continue;
      await db.query(
        `INSERT INTO relationships (project_id, source_entity, target_entity, type, source_column, target_column, foreign_key_column, on_delete, on_update, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          projectId,
          src,
          tgt,
          rel.type,
          rel.sourceColumn || null,
          rel.targetColumn || null,
          rel.foreignKeyColumn || null,
          rel.onDelete || 'CASCADE',
          rel.onUpdate || 'CASCADE',
          rel.description || ''
        ]
      );
    }
  }

  res.status(200).json({
    success: true,
    message: 'Relationships saved.'
  });
});

const generateSchema = asyncHandler(async (req, res) => {
  const { projectId } = req.body;
  const userId = req.user.id;

  await verifyOwnership(projectId, userId);

  const entitiesRes = await db.query('SELECT * FROM entities WHERE project_id = $1', [projectId]);
  const entities = [];

  for (let entity of entitiesRes.rows) {
    const attrRes = await db.query('SELECT * FROM attributes WHERE entity_id = $1', [entity.id]);
    entities.push({
      name: entity.name,
      attributes: attrRes.rows.map((a) => ({
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

  const relRes = await db.query('SELECT * FROM relationships WHERE project_id = $1', [projectId]);
  const relationships = relRes.rows.map((r) => ({
    source: r.source_entity,
    target: r.target_entity,
    type: r.type,
    sourceColumn: r.source_column,
    targetColumn: r.target_column,
    foreignKeyColumn: r.foreign_key_column,
    onDelete: r.on_delete,
    onUpdate: r.on_update
  }));

  const schema = schemaService.generateRelationalSchema(entities, relationships);
  const normalizationStatus = normalizationService.analyzeNormalization(schema);

  const schemaJsonStr = JSON.stringify(schema);
  const normJsonStr = JSON.stringify(normalizationStatus);

  await db.query(
    `INSERT INTO generated_schemas (project_id, schema_json, normalization_status, is_outdated)
     VALUES ($1, $2, $3, FALSE)
     ON CONFLICT (project_id)
     DO UPDATE SET schema_json = EXCLUDED.schema_json, normalization_status = EXCLUDED.normalization_status, is_outdated = FALSE, updated_at = CURRENT_TIMESTAMP`,
    [projectId, schemaJsonStr, normJsonStr]
  );

  res.status(200).json({
    success: true,
    schema,
    normalizationStatus
  });
});

const generateSql = asyncHandler(async (req, res) => {
  const { projectId, dialect } = req.body;
  const userId = req.user.id;

  const project = await verifyOwnership(projectId, userId);
  const targetDialect = dialect || project.database_type || 'PostgreSQL';

  const schemaRes = await db.query('SELECT schema_json FROM generated_schemas WHERE project_id = $1', [projectId]);
  if (schemaRes.rows.length === 0) {
    throw new ApiError(400, 'Generate relational schema first before generating SQL script.');
  }

  const schema = typeof schemaRes.rows[0].schema_json === 'string' ? JSON.parse(schemaRes.rows[0].schema_json) : schemaRes.rows[0].schema_json;
  const sqlResult = sqlGeneratorService.generateSqlScript(schema, targetDialect);

  await db.query(
    `INSERT INTO generated_sql (project_id, ddl_sql, sample_data_sql, dialect, is_outdated)
     VALUES ($1, $2, $3, $4, FALSE)
     ON CONFLICT (project_id)
     DO UPDATE SET ddl_sql = EXCLUDED.ddl_sql, sample_data_sql = EXCLUDED.sample_data_sql, dialect = EXCLUDED.dialect, is_outdated = FALSE, updated_at = CURRENT_TIMESTAMP`,
    [projectId, sqlResult.ddlSql, sqlResult.sampleDataSql, targetDialect]
  );

  res.status(200).json({
    success: true,
    dialect: targetDialect,
    ddlSql: sqlResult.ddlSql,
    sampleDataSql: sqlResult.sampleDataSql
  });
});

const validateSchema = asyncHandler(async (req, res) => {
  const { projectId } = req.body;
  const userId = req.user.id;

  await verifyOwnership(projectId, userId);

  const schemaRes = await db.query('SELECT schema_json FROM generated_schemas WHERE project_id = $1', [projectId]);
  if (schemaRes.rows.length === 0) {
    throw new ApiError(400, 'Schema not found for validation.');
  }

  const schema = typeof schemaRes.rows[0].schema_json === 'string' ? JSON.parse(schemaRes.rows[0].schema_json) : schemaRes.rows[0].schema_json;
  const sqlRes = await db.query('SELECT ddl_sql FROM generated_sql WHERE project_id = $1', [projectId]);
  const ddlSql = sqlRes.rows[0] ? sqlRes.rows[0].ddl_sql : '';

  const validation = validationService.validateSchemaAndSql(schema, ddlSql);
  const issuesJson = JSON.stringify(validation.issues);

  await db.query(
    `INSERT INTO validation_results (project_id, score, is_valid, issues)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (project_id)
     DO UPDATE SET score = EXCLUDED.score, is_valid = EXCLUDED.is_valid, issues = EXCLUDED.issues, updated_at = CURRENT_TIMESTAMP`,
    [projectId, validation.score, validation.isValid ? 1 : 0, issuesJson]
  );

  res.status(200).json({
    success: true,
    validation
  });
});

const safeAutoFix = asyncHandler(async (req, res) => {
  const { projectId } = req.body;
  const userId = req.user.id;

  await verifyOwnership(projectId, userId);

  const schemaRes = await db.query('SELECT schema_json FROM generated_schemas WHERE project_id = $1', [projectId]);
  const valRes = await db.query('SELECT issues FROM validation_results WHERE project_id = $1', [projectId]);

  if (schemaRes.rows.length === 0 || valRes.rows.length === 0) {
    throw new ApiError(400, 'Run schema validation first before applying safe auto fixes.');
  }

  const schema = typeof schemaRes.rows[0].schema_json === 'string' ? JSON.parse(schemaRes.rows[0].schema_json) : schemaRes.rows[0].schema_json;
  const issues = typeof valRes.rows[0].issues === 'string' ? JSON.parse(valRes.rows[0].issues) : valRes.rows[0].issues;

  const fixedSchema = validationService.applySafeAutoFix(schema, issues);
  const reValidation = validationService.validateSchemaAndSql(fixedSchema);

  await db.query('UPDATE generated_schemas SET schema_json = $1 WHERE project_id = $2', [JSON.stringify(fixedSchema), projectId]);
  await db.query('UPDATE validation_results SET score = $1, is_valid = $2, issues = $3 WHERE project_id = $4', [
    reValidation.score,
    reValidation.isValid ? 1 : 0,
    JSON.stringify(reValidation.issues),
    projectId
  ]);

  res.status(200).json({
    success: true,
    message: 'Safe auto fixes applied.',
    schema: fixedSchema,
    validation: reValidation
  });
});

const reviewAi = asyncHandler(async (req, res) => {
  const { projectId } = req.body;
  const userId = req.user.id;

  const project = await verifyOwnership(projectId, userId);

  const entitiesRes = await db.query('SELECT * FROM entities WHERE project_id = $1', [projectId]);
  const relRes = await db.query('SELECT * FROM relationships WHERE project_id = $1', [projectId]);

  const reviewResult = await aiService.reviewDatabaseDesign(entitiesRes.rows, relRes.rows, project.database_type);

  res.status(200).json({
    success: true,
    suggestions: reviewResult.suggestions || []
  });
});

const getIndexRecommendations = asyncHandler(async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  const userId = req.user.id;

  const project = await verifyOwnership(projectId, userId);

  const schemaRes = await db.query('SELECT schema_json FROM generated_schemas WHERE project_id = $1', [projectId]);
  if (schemaRes.rows.length === 0) {
    return res.status(200).json({ success: true, recommendations: [] });
  }

  const schema = typeof schemaRes.rows[0].schema_json === 'string' ? JSON.parse(schemaRes.rows[0].schema_json) : schemaRes.rows[0].schema_json;
  const recommendations = indexService.generateIndexRecommendations(schema, project.database_type);

  res.status(200).json({
    success: true,
    recommendations
  });
});

module.exports = {
  analyzeRequirement,
  saveEntities,
  saveRelationships,
  generateSchema,
  generateSql,
  validateSchema,
  safeAutoFix,
  reviewAi,
  getIndexRecommendations
};
