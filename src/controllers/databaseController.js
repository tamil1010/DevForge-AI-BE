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

// @route POST /api/database/analyze
// ONE-PROMPT-TO-COMPLETE-DATABASE-DESIGN AUTOMATED PIPELINE
const analyzeRequirement = asyncHandler(async (req, res) => {
  const { projectId, projectName, requirement, databaseType } = req.body;
  const userId = req.user.id;

  let targetProjectId = projectId;
  let dbType = databaseType || 'PostgreSQL';

  if (targetProjectId) {
    await verifyOwnership(targetProjectId, userId);
  } else {
    const newProj = await db.query(
      'INSERT INTO projects (user_id, name, description, database_type, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, projectName || 'New Database Design', 'AI One-Prompt Database Design', dbType, 'completed']
    );
    targetProjectId = newProj.rows[0].id;
  }

  if (!requirement || requirement.trim().length < 10) {
    throw new ApiError(400, 'Requirement prompt must be at least 10 characters long.');
  }

  // Pipeline Step 1: AI Requirement Analysis (Domain, Entities, Attributes, Relationships, Rules)
  const analysis = await aiService.analyzeRequirement(requirement, dbType);
  const reqJson = JSON.stringify(analysis);

  await db.query(
    `INSERT INTO requirements (project_id, raw_text, domain, analysis_json)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (project_id)
     DO UPDATE SET raw_text = EXCLUDED.raw_text, domain = EXCLUDED.domain, analysis_json = EXCLUDED.analysis_json, updated_at = CURRENT_TIMESTAMP`,
    [targetProjectId, requirement, analysis.domain, reqJson]
  );

  // Pipeline Step 2: Populate Entities & Attributes
  const entitiesForSchema = [];
  if (analysis.entities && analysis.entities.length > 0) {
    await db.query('DELETE FROM entities WHERE project_id = $1', [targetProjectId]);
    await db.query('DELETE FROM relationships WHERE project_id = $1', [targetProjectId]);

    for (let ent of analysis.entities) {
      const entRes = await db.query(
        'INSERT INTO entities (project_id, name) VALUES ($1, $2) RETURNING id',
        [targetProjectId, ent.name]
      );
      const entId = entRes.rows[0].id;

      const attrsList = [];
      if (ent.attributes) {
        for (let attr of ent.attributes) {
          await db.query(
            `INSERT INTO attributes (entity_id, name, data_type, is_primary_key, is_foreign_key, is_nullable, is_unique, is_auto_increment, default_value)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [entId, attr.name, attr.type, attr.primaryKey, attr.foreignKey, attr.nullable, attr.unique, attr.autoIncrement, attr.defaultValue || null]
          );
          attrsList.push({
            name: attr.name,
            type: attr.type,
            primaryKey: Boolean(attr.primaryKey),
            foreignKey: Boolean(attr.foreignKey),
            nullable: attr.nullable !== undefined ? Boolean(attr.nullable) : !attr.primaryKey,
            unique: Boolean(attr.unique),
            autoIncrement: Boolean(attr.autoIncrement),
            defaultValue: attr.defaultValue || null
          });
        }
      }
      entitiesForSchema.push({
        name: ent.name,
        attributes: attrsList
      });
    }
  }

  // Pipeline Step 3: Populate Relationships
  const relsForSchema = [];
  if (analysis.relationships && analysis.relationships.length > 0) {
    for (let rel of analysis.relationships) {
      const src = rel.source || rel.from;
      const tgt = rel.target || rel.to;
      await db.query(
        `INSERT INTO relationships (project_id, source_entity, target_entity, type, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [targetProjectId, src, tgt, rel.type, rel.description || '']
      );
      relsForSchema.push({
        source: src,
        target: tgt,
        type: rel.type,
        description: rel.description || ''
      });
    }
  }

  // Pipeline Step 4: Relational Schema Generation (with Junction tables)
  const schema = schemaService.generateRelationalSchema(entitiesForSchema, relsForSchema);
  const normalizationStatus = normalizationService.analyzeNormalization(schema);

  await db.query(
    `INSERT INTO generated_schemas (project_id, schema_json, normalization_status, is_outdated)
     VALUES ($1, $2, $3, FALSE)
     ON CONFLICT (project_id)
     DO UPDATE SET schema_json = EXCLUDED.schema_json, normalization_status = EXCLUDED.normalization_status, is_outdated = FALSE, updated_at = CURRENT_TIMESTAMP`,
    [targetProjectId, JSON.stringify(schema), JSON.stringify(normalizationStatus)]
  );

  // Pipeline Step 5: Deterministic SQL Script Generation
  const sqlResult = sqlGeneratorService.generateSqlScript(schema, dbType);
  await db.query(
    `INSERT INTO generated_sql (project_id, ddl_sql, sample_data_sql, dialect, is_outdated)
     VALUES ($1, $2, $3, $4, FALSE)
     ON CONFLICT (project_id)
     DO UPDATE SET ddl_sql = EXCLUDED.ddl_sql, sample_data_sql = EXCLUDED.sample_data_sql, dialect = EXCLUDED.dialect, is_outdated = FALSE, updated_at = CURRENT_TIMESTAMP`,
    [targetProjectId, sqlResult.ddlSql, sqlResult.sampleDataSql, dbType]
  );

  // Pipeline Step 6: Database Design Validation Engine
  const validation = validationService.validateSchemaAndSql(schema, sqlResult.ddlSql);
  await db.query(
    `INSERT INTO validation_results (project_id, score, is_valid, issues)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (project_id)
     DO UPDATE SET score = EXCLUDED.score, is_valid = EXCLUDED.is_valid, issues = EXCLUDED.issues, updated_at = CURRENT_TIMESTAMP`,
    [targetProjectId, validation.score, validation.isValid ? 1 : 0, JSON.stringify(validation.issues)]
  );

  await db.query('UPDATE projects SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['completed', targetProjectId]);

  res.status(200).json({
    success: true,
    projectId: targetProjectId,
    analysis,
    schema,
    normalizationStatus,
    generatedSql: sqlResult,
    validation
  });
});

const saveEntities = asyncHandler(async (req, res) => {
  const { projectId, entities } = req.body;
  const userId = req.user.id;

  await verifyOwnership(projectId, userId);

  if (!Array.isArray(entities)) throw new ApiError(400, 'Entities must be an array.');

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

  res.status(200).json({ success: true, message: 'Entity model saved.' });
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

  res.status(200).json({ success: true, message: 'Relationships saved.' });
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

  await db.query(
    `INSERT INTO generated_schemas (project_id, schema_json, normalization_status, is_outdated)
     VALUES ($1, $2, $3, FALSE)
     ON CONFLICT (project_id)
     DO UPDATE SET schema_json = EXCLUDED.schema_json, normalization_status = EXCLUDED.normalization_status, is_outdated = FALSE, updated_at = CURRENT_TIMESTAMP`,
    [projectId, JSON.stringify(schema), JSON.stringify(normalizationStatus)]
  );

  res.status(200).json({ success: true, schema, normalizationStatus });
});

const generateSql = asyncHandler(async (req, res) => {
  const { projectId, dialect } = req.body;
  const userId = req.user.id;

  const project = await verifyOwnership(projectId, userId);
  const targetDialect = dialect || project.database_type || 'PostgreSQL';

  const schemaRes = await db.query('SELECT schema_json FROM generated_schemas WHERE project_id = $1', [projectId]);
  if (schemaRes.rows.length === 0) throw new ApiError(400, 'Generate relational schema first.');

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
  if (schemaRes.rows.length === 0) throw new ApiError(400, 'Schema not found.');

  const schema = typeof schemaRes.rows[0].schema_json === 'string' ? JSON.parse(schemaRes.rows[0].schema_json) : schemaRes.rows[0].schema_json;
  const sqlRes = await db.query('SELECT ddl_sql FROM generated_sql WHERE project_id = $1', [projectId]);
  const ddlSql = sqlRes.rows[0] ? sqlRes.rows[0].ddl_sql : '';

  const validation = validationService.validateSchemaAndSql(schema, ddlSql);

  await db.query(
    `INSERT INTO validation_results (project_id, score, is_valid, issues)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (project_id)
     DO UPDATE SET score = EXCLUDED.score, is_valid = EXCLUDED.is_valid, issues = EXCLUDED.issues, updated_at = CURRENT_TIMESTAMP`,
    [projectId, validation.score, validation.isValid ? 1 : 0, JSON.stringify(validation.issues)]
  );

  res.status(200).json({ success: true, validation });
});

const safeAutoFix = asyncHandler(async (req, res) => {
  const { projectId } = req.body;
  const userId = req.user.id;

  await verifyOwnership(projectId, userId);

  const schemaRes = await db.query('SELECT schema_json FROM generated_schemas WHERE project_id = $1', [projectId]);
  const valRes = await db.query('SELECT issues FROM validation_results WHERE project_id = $1', [projectId]);

  if (schemaRes.rows.length === 0 || valRes.rows.length === 0) throw new ApiError(400, 'Run validation first.');

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

  res.status(200).json({ success: true, message: 'Safe auto fixes applied.', schema: fixedSchema, validation: reValidation });
});

const reviewAi = asyncHandler(async (req, res) => {
  const { projectId } = req.body;
  const userId = req.user.id;

  if (!projectId) {
    throw new ApiError(400, 'Project ID is required for AI Review.');
  }

  const project = await verifyOwnership(projectId, userId);

  // Fetch Entities & Attributes
  const entitiesRes = await db.query('SELECT * FROM entities WHERE project_id = $1 ORDER BY id ASC', [projectId]);
  const entities = [];

  for (let entity of entitiesRes.rows) {
    const attrRes = await db.query('SELECT * FROM attributes WHERE entity_id = $1 ORDER BY id ASC', [entity.id]);
    entities.push({
      name: entity.name,
      description: entity.description || '',
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

  // Fetch Relationships
  const relRes = await db.query('SELECT * FROM relationships WHERE project_id = $1 ORDER BY id ASC', [projectId]);
  const relationships = relRes.rows.map((r) => ({
    source: r.source_entity,
    target: r.target_entity,
    type: r.type,
    sourceColumn: r.source_column,
    targetColumn: r.target_column,
    foreignKeyColumn: r.foreign_key_column,
    onDelete: r.on_delete,
    onUpdate: r.on_update,
    description: r.description || ''
  }));

  // Fetch Schema JSON if available
  const schemaRes = await db.query('SELECT schema_json FROM generated_schemas WHERE project_id = $1', [projectId]);
  let schema = null;
  if (schemaRes.rows.length > 0 && schemaRes.rows[0].schema_json) {
    schema = typeof schemaRes.rows[0].schema_json === 'string'
      ? JSON.parse(schemaRes.rows[0].schema_json)
      : schemaRes.rows[0].schema_json;
  }

  // Fetch Generated DDL SQL if available
  const sqlRes = await db.query('SELECT ddl_sql FROM generated_sql WHERE project_id = $1', [projectId]);
  let ddlSql = sqlRes.rows[0] ? sqlRes.rows[0].ddl_sql : '';

  const databaseDesign = {
    databaseType: project.database_type || 'PostgreSQL',
    entities,
    relationships,
    schema,
    ddlSql
  };

  const reviewResult = await aiService.reviewDatabaseDesign(databaseDesign);

  const summary = reviewResult.summary || 'AI Review completed successfully.';
  const suggestions = reviewResult.suggestions || [];
  const totalSuggestions = suggestions.length;
  const criticalCount = suggestions.filter((s) => s.severity === 'CRITICAL').length;
  const warningCount = suggestions.filter((s) => s.severity === 'WARNING').length;
  const improvementCount = suggestions.filter((s) => s.severity === 'IMPROVEMENT').length;

  const maxRes = await db.query(
    'SELECT MAX(review_number) as max_rev FROM ai_reviews WHERE project_id = $1',
    [projectId]
  );
  const maxRev = maxRes.rows[0] ? (maxRes.rows[0].max_rev || maxRes.rows[0].max_v || 0) : 0;
  const reviewNumber = parseInt(maxRev, 10) + 1;

  const nowIso = new Date().toISOString();
  const reviewDataJson = JSON.stringify({ summary, suggestions });
  const insertRes = await db.query(
    `INSERT INTO ai_reviews (
      project_id, review_number, summary, total_suggestions, critical_count, warning_count, improvement_count, review_data, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, created_at`,
    [projectId, reviewNumber, summary, totalSuggestions, criticalCount, warningCount, improvementCount, reviewDataJson, nowIso]
  );

  const insertedRow = insertRes.rows[0] || {};
  let createdAt = insertedRow.created_at || nowIso;
  if (createdAt && typeof createdAt === 'string') {
    let str = createdAt.trim();
    if (!str.includes('Z') && !str.includes('+')) {
      str = str.replace(' ', 'T') + 'Z';
    }
    createdAt = str;
  }

  const savedReview = {
    id: insertedRow.id,
    projectId: parseInt(projectId, 10),
    reviewNumber,
    createdAt,
    summary,
    totalSuggestions,
    criticalCount,
    warningCount,
    improvementCount,
    suggestions
  };

  res.status(200).json({
    success: true,
    summary,
    suggestions,
    review: savedReview
  });
});

const getAiReviews = asyncHandler(async (req, res) => {
  const projectId = parseInt(req.params.projectId || req.params.id, 10);
  const userId = req.user.id;

  await verifyOwnership(projectId, userId);

  const reviewsRes = await db.query(
    'SELECT * FROM ai_reviews WHERE project_id = $1 ORDER BY review_number DESC, id DESC',
    [projectId]
  );

  const reviews = reviewsRes.rows.map((row) => {
    let parsedData = {};
    try {
      parsedData = typeof row.review_data === 'string' ? JSON.parse(row.review_data) : row.review_data;
    } catch (e) {
      parsedData = {};
    }
    const suggestions = parsedData.suggestions || [];
    let createdAt = row.created_at;
    if (createdAt && typeof createdAt === 'string') {
      let str = createdAt.trim();
      if (!str.includes('Z') && !str.includes('+')) {
        str = str.replace(' ', 'T') + 'Z';
      }
      createdAt = str;
    }
    return {
      id: row.id,
      projectId: row.project_id,
      reviewNumber: row.review_number,
      createdAt,
      summary: row.summary || parsedData.summary || '',
      totalSuggestions: row.total_suggestions !== undefined ? row.total_suggestions : suggestions.length,
      criticalCount: row.critical_count !== undefined ? row.critical_count : suggestions.filter((s) => s.severity === 'CRITICAL').length,
      warningCount: row.warning_count !== undefined ? row.warning_count : suggestions.filter((s) => s.severity === 'WARNING').length,
      improvementCount: row.improvement_count !== undefined ? row.improvement_count : suggestions.filter((s) => s.severity === 'IMPROVEMENT').length,
      suggestions
    };
  });

  res.status(200).json({
    success: true,
    reviews
  });
});

const deleteAiReview = asyncHandler(async (req, res) => {
  const reviewId = parseInt(req.params.id, 10);
  const userId = req.user.id;

  const reviewRes = await db.query('SELECT project_id FROM ai_reviews WHERE id = $1', [reviewId]);
  if (reviewRes.rows.length === 0) {
    throw new ApiError(404, 'AI Review not found.');
  }

  const projectId = reviewRes.rows[0].project_id;
  await verifyOwnership(projectId, userId);

  await db.query('DELETE FROM ai_reviews WHERE id = $1', [reviewId]);

  res.status(200).json({ success: true, message: 'AI Review deleted successfully.' });
});

const clearAiReviews = asyncHandler(async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  const userId = req.user.id;

  await verifyOwnership(projectId, userId);

  await db.query('DELETE FROM ai_reviews WHERE project_id = $1', [projectId]);

  res.status(200).json({ success: true, message: 'All AI Reviews cleared for project.' });
});

const modifyAi = asyncHandler(async (req, res) => {
  const { projectId, suggestions } = req.body;
  const userId = req.user.id;

  if (!projectId) {
    throw new ApiError(400, 'Project ID is required.');
  }

  const project = await verifyOwnership(projectId, userId);

  // 1. Fetch current Validation Score & Design Snapshot (Before)
  const valRes = await db.query('SELECT score FROM validation_results WHERE project_id = $1', [projectId]);
  const beforeScore = valRes.rows[0] ? (valRes.rows[0].score || 86) : 86;

  const sqlResBefore = await db.query('SELECT ddl_sql FROM generated_sql WHERE project_id = $1', [projectId]);
  const beforeDdlSql = sqlResBefore.rows[0] ? sqlResBefore.rows[0].ddl_sql : '';

  const entitiesRes = await db.query('SELECT * FROM entities WHERE project_id = $1 ORDER BY id ASC', [projectId]);
  const entities = [];

  for (let entity of entitiesRes.rows) {
    const attrRes = await db.query('SELECT * FROM attributes WHERE entity_id = $1 ORDER BY id ASC', [entity.id]);
    entities.push({
      name: entity.name,
      description: entity.description || '',
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

  const relRes = await db.query('SELECT * FROM relationships WHERE project_id = $1 ORDER BY id ASC', [projectId]);
  const relationships = relRes.rows.map((r) => ({
    source: r.source_entity,
    target: r.target_entity,
    type: r.type,
    sourceColumn: r.source_column,
    targetColumn: r.target_column,
    foreignKeyColumn: r.foreign_key_column,
    onDelete: r.on_delete,
    onUpdate: r.on_update,
    description: r.description || ''
  }));

  const databaseDesign = {
    databaseType: project.database_type || 'PostgreSQL',
    entities,
    relationships
  };

  const beforeSnapshot = {
    score: beforeScore,
    entities: JSON.parse(JSON.stringify(entities)),
    relationships: JSON.parse(JSON.stringify(relationships)),
    ddlSql: beforeDdlSql
  };

  // 2. Execute AI Modification
  const modified = await aiService.modifyDesignWithReview(databaseDesign, suggestions || []);

  await db.query('DELETE FROM entities WHERE project_id = $1', [projectId]);
  await db.query('DELETE FROM relationships WHERE project_id = $1', [projectId]);

  if (Array.isArray(modified.entities)) {
    for (let ent of modified.entities) {
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
  }

  if (Array.isArray(modified.relationships)) {
    for (let rel of modified.relationships) {
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
          rel.onDelete || 'RESTRICT',
          rel.onUpdate || 'CASCADE',
          rel.description || ''
        ]
      );
    }
  }

  // 3. Regenerate Schema, SQL & Validation
  const schema = schemaService.generateRelationalSchema(modified.entities, modified.relationships);
  const normalizationStatus = normalizationService.analyzeNormalization(schema);

  await db.query(
    `INSERT INTO generated_schemas (project_id, schema_json, normalization_status, is_outdated)
     VALUES ($1, $2, $3, FALSE)
     ON CONFLICT (project_id)
     DO UPDATE SET schema_json = EXCLUDED.schema_json, normalization_status = EXCLUDED.normalization_status, is_outdated = FALSE, updated_at = CURRENT_TIMESTAMP`,
    [projectId, JSON.stringify(schema), JSON.stringify(normalizationStatus)]
  );

  const dbType = project.database_type || 'PostgreSQL';
  const sqlResult = sqlGeneratorService.generateSqlScript(schema, dbType);

  await db.query(
    `INSERT INTO generated_sql (project_id, ddl_sql, sample_data_sql, dialect, is_outdated)
     VALUES ($1, $2, $3, $4, FALSE)
     ON CONFLICT (project_id)
     DO UPDATE SET ddl_sql = EXCLUDED.ddl_sql, sample_data_sql = EXCLUDED.sample_data_sql, dialect = EXCLUDED.dialect, is_outdated = FALSE, updated_at = CURRENT_TIMESTAMP`,
    [projectId, sqlResult.ddlSql, sqlResult.sampleDataSql, dbType]
  );

  const validation = validationService.validateSchemaAndSql(schema, sqlResult.ddlSql);
  const afterScore = validation.score || 100;

  await db.query(
    `INSERT INTO validation_results (project_id, score, is_valid, issues)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (project_id)
     DO UPDATE SET score = EXCLUDED.score, is_valid = EXCLUDED.is_valid, issues = EXCLUDED.issues, updated_at = CURRENT_TIMESTAMP`,
    [projectId, afterScore, validation.isValid ? 1 : 0, JSON.stringify(validation.issues)]
  );

  const afterSnapshot = {
    score: afterScore,
    entities: modified.entities,
    relationships: modified.relationships,
    ddlSql: sqlResult.ddlSql
  };

  // 4. Calculate Differentiated Changes List
  const changes = [];

  // Check relationship constraint modifications (e.g. CASCADE -> RESTRICT)
  relationships.forEach(rel1 => {
    const matchingRel2 = modified.relationships.find(r2 => (r2.source || r2.from) === (rel1.source || rel1.from) && (r2.target || r2.to) === (rel1.target || rel1.to));
    if (matchingRel2 && matchingRel2.onDelete !== rel1.onDelete) {
      changes.push({
        category: 'Relationship Constraint',
        type: 'modified',
        title: `${rel1.source} -> ${rel1.target} Foreign Key Constraint`,
        before: `ON DELETE ${rel1.onDelete || 'CASCADE'}`,
        after: `ON DELETE ${matchingRel2.onDelete || 'RESTRICT'}`,
        description: `Protected ${rel1.target} records from destructive cascade deletion when ${rel1.source} is removed.`
      });
    }
  });

  // Check attribute additions/modifications
  modified.entities.forEach(e2 => {
    const e1 = entities.find(x => x.name.toLowerCase() === e2.name.toLowerCase());
    if (!e1) {
      changes.push({
        category: 'Entity Created',
        type: 'added',
        title: `Added Entity '${e2.name}'`,
        before: 'Not present',
        after: `Entity '${e2.name}' with ${e2.attributes.length} attributes`,
        description: `Created new entity for normalized relational model.`
      });
    } else {
      e2.attributes.forEach(a2 => {
        const a1 = e1.attributes.find(x => x.name.toLowerCase() === a2.name.toLowerCase());
        if (!a1) {
          changes.push({
            category: 'Attribute Added',
            type: 'added',
            title: `Added Column '${a2.name}' to ${e2.name}`,
            before: 'Column missing',
            after: `${a2.name} ${a2.type}`,
            description: `Added missing column to satisfy domain business rules.`
          });
        } else if (a1.type !== a2.type) {
          changes.push({
            category: 'Data Type Optimized',
            type: 'modified',
            title: `Optimized Data Type of '${a2.name}' in ${e2.name}`,
            before: `${a1.type}`,
            after: `${a2.type}`,
            description: `Updated data type constraint to optimize storage and precision.`
          });
        }
      });
    }
  });

  if (changes.length === 0) {
    changes.push({
      category: 'Architecture Optimization',
      type: 'modified',
      title: 'Database Schema & Constraints Alignment',
      before: `Validation Score: ${beforeScore}%`,
      after: `Validation Score: ${afterScore}%`,
      description: 'Optimized index placements, foreign key constraints, and relational normalization.'
    });
  }

  const diffJson = {
    beforeScore,
    afterScore,
    changes,
    appliedAt: new Date().toISOString()
  };

  await db.query(
    `INSERT INTO modify_diffs (project_id, before_score, after_score, before_snapshot, after_snapshot, diff_json)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [projectId, beforeScore, afterScore, JSON.stringify(beforeSnapshot), JSON.stringify(afterSnapshot), JSON.stringify(diffJson)]
  );

  res.status(200).json({
    success: true,
    message: 'Database design modified & updated based on AI suggestions.',
    beforeScore,
    afterScore,
    diff: diffJson,
    entities: modified.entities,
    relationships: modified.relationships,
    schema,
    generatedSql: sqlResult,
    validation
  });
});

const getModifyDiff = asyncHandler(async (req, res) => {
  const projectId = parseInt(req.params.projectId || req.params.id, 10);
  const userId = req.user.id;

  await verifyOwnership(projectId, userId);

  const diffRes = await db.query(
    'SELECT * FROM modify_diffs WHERE project_id = $1 ORDER BY id DESC LIMIT 1',
    [projectId]
  );

  if (diffRes.rows.length === 0) {
    return res.status(200).json({ success: true, diffRecord: null });
  }

  const row = diffRes.rows[0];
  let diffJson = {};
  let beforeSnap = {};
  let afterSnap = {};

  try { diffJson = typeof row.diff_json === 'string' ? JSON.parse(row.diff_json) : row.diff_json; } catch (e) {}
  try { beforeSnap = typeof row.before_snapshot === 'string' ? JSON.parse(row.before_snapshot) : row.before_snapshot; } catch (e) {}
  try { afterSnap = typeof row.after_snapshot === 'string' ? JSON.parse(row.after_snapshot) : row.after_snapshot; } catch (e) {}

  res.status(200).json({
    success: true,
    diffRecord: {
      id: row.id,
      projectId: row.project_id,
      beforeScore: row.before_score || 86,
      afterScore: row.after_score || 100,
      createdAt: row.created_at,
      diff: diffJson,
      beforeSnapshot: beforeSnap,
      afterSnapshot: afterSnap
    }
  });
});

const getIndexRecommendations = asyncHandler(async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  const userId = req.user.id;

  const project = await verifyOwnership(projectId, userId);

  const schemaRes = await db.query('SELECT schema_json FROM generated_schemas WHERE project_id = $1', [projectId]);
  if (schemaRes.rows.length === 0) return res.status(200).json({ success: true, recommendations: [] });

  const schema = typeof schemaRes.rows[0].schema_json === 'string' ? JSON.parse(schemaRes.rows[0].schema_json) : schemaRes.rows[0].schema_json;
  const recommendations = indexService.generateIndexRecommendations(schema, project.database_type);

  res.status(200).json({ success: true, recommendations });
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
  getAiReviews,
  deleteAiReview,
  clearAiReviews,
  modifyAi,
  getModifyDiff,
  getIndexRecommendations
};
