let Pool = null;
try {
  Pool = require('pg').Pool;
} catch (e) {}

let mongoose = null;
try {
  mongoose = require('mongoose');
} catch (e) {}

let pgPool = null;
let usePg = false;
let useMongo = false;

// Mongoose Schemas & Models for Flexible MongoDB Storage
const schemaOpts = { timestamps: true, strict: false, id: false };
const DevForgeUserSchema = new mongoose.Schema({ id: mongoose.Schema.Types.Mixed, full_name: String, email: String, password_hash: String }, schemaOpts);
const DevForgeProjectSchema = new mongoose.Schema({ id: mongoose.Schema.Types.Mixed, user_id: mongoose.Schema.Types.Mixed, name: String, description: String, database_type: String, status: String }, schemaOpts);
const DevForgeRequirementSchema = new mongoose.Schema({ id: mongoose.Schema.Types.Mixed, project_id: mongoose.Schema.Types.Mixed, raw_text: String, domain: String, analysis_json: mongoose.Schema.Types.Mixed }, schemaOpts);
const DevForgeEntitySchema = new mongoose.Schema({ id: mongoose.Schema.Types.Mixed, project_id: mongoose.Schema.Types.Mixed, name: String, description: String }, schemaOpts);
const DevForgeAttributeSchema = new mongoose.Schema({ id: mongoose.Schema.Types.Mixed, entity_id: mongoose.Schema.Types.Mixed, name: String, data_type: String, is_primary_key: Boolean, is_foreign_key: Boolean, is_nullable: Boolean, is_unique: Boolean, auto_increment: Boolean, foreign_key_table: String, foreign_key_column: String }, schemaOpts);
const DevForgeRelationshipSchema = new mongoose.Schema({ id: mongoose.Schema.Types.Mixed, project_id: mongoose.Schema.Types.Mixed, source_entity: String, target_entity: String, type: String, source_column: String, target_column: String, foreign_key_column: String, on_delete: String, on_update: String, description: String }, schemaOpts);
const DevForgeGeneratedSchemaSchema = new mongoose.Schema({ id: mongoose.Schema.Types.Mixed, project_id: mongoose.Schema.Types.Mixed, schema_json: mongoose.Schema.Types.Mixed, version: mongoose.Schema.Types.Mixed, normalization_status: mongoose.Schema.Types.Mixed }, schemaOpts);
const DevForgeGeneratedSqlSchema = new mongoose.Schema({ id: mongoose.Schema.Types.Mixed, project_id: mongoose.Schema.Types.Mixed, ddl_sql: String, sample_data_sql: String, dialect: String, is_outdated: Boolean }, schemaOpts);
const DevForgeValidationResultSchema = new mongoose.Schema({ id: mongoose.Schema.Types.Mixed, project_id: mongoose.Schema.Types.Mixed, score: mongoose.Schema.Types.Mixed, is_valid: Boolean, issues: mongoose.Schema.Types.Mixed }, schemaOpts);
const DevForgeProjectVersionSchema = new mongoose.Schema({ id: mongoose.Schema.Types.Mixed, project_id: mongoose.Schema.Types.Mixed, version_number: mongoose.Schema.Types.Mixed, snapshot_json: mongoose.Schema.Types.Mixed }, schemaOpts);
const DevForgeAiReviewSchema = new mongoose.Schema({ id: mongoose.Schema.Types.Mixed, project_id: mongoose.Schema.Types.Mixed, review_number: mongoose.Schema.Types.Mixed, summary: String, total_suggestions: mongoose.Schema.Types.Mixed, critical_count: mongoose.Schema.Types.Mixed, warning_count: mongoose.Schema.Types.Mixed, improvement_count: mongoose.Schema.Types.Mixed, review_data: mongoose.Schema.Types.Mixed }, schemaOpts);
const DevForgeModifyDiffSchema = new mongoose.Schema({ id: mongoose.Schema.Types.Mixed, project_id: mongoose.Schema.Types.Mixed, before_score: mongoose.Schema.Types.Mixed, after_score: mongoose.Schema.Types.Mixed, before_snapshot: mongoose.Schema.Types.Mixed, after_snapshot: mongoose.Schema.Types.Mixed, diff_json: mongoose.Schema.Types.Mixed }, schemaOpts);
const DevForgeIndexRecommendationSchema = new mongoose.Schema({ id: mongoose.Schema.Types.Mixed, project_id: mongoose.Schema.Types.Mixed, recommendations_json: mongoose.Schema.Types.Mixed, applied_indexes_json: mongoose.Schema.Types.Mixed, ignored_indexes_json: mongoose.Schema.Types.Mixed, ai_analysis_json: mongoose.Schema.Types.Mixed, is_outdated: Boolean }, schemaOpts);

const DevForgeUser = mongoose ? (mongoose.models.DevForgeUser || mongoose.model('DevForgeUser', DevForgeUserSchema)) : null;
const DevForgeProject = mongoose ? (mongoose.models.DevForgeProject || mongoose.model('DevForgeProject', DevForgeProjectSchema)) : null;
const DevForgeRequirement = mongoose ? (mongoose.models.DevForgeRequirement || mongoose.model('DevForgeRequirement', DevForgeRequirementSchema)) : null;
const DevForgeEntity = mongoose ? (mongoose.models.DevForgeEntity || mongoose.model('DevForgeEntity', DevForgeEntitySchema)) : null;
const DevForgeAttribute = mongoose ? (mongoose.models.DevForgeAttribute || mongoose.model('DevForgeAttribute', DevForgeAttributeSchema)) : null;
const DevForgeRelationship = mongoose ? (mongoose.models.DevForgeRelationship || mongoose.model('DevForgeRelationship', DevForgeRelationshipSchema)) : null;
const DevForgeGeneratedSchema = mongoose ? (mongoose.models.DevForgeGeneratedSchema || mongoose.model('DevForgeGeneratedSchema', DevForgeGeneratedSchemaSchema)) : null;
const DevForgeGeneratedSql = mongoose ? (mongoose.models.DevForgeGeneratedSql || mongoose.model('DevForgeGeneratedSql', DevForgeGeneratedSqlSchema)) : null;
const DevForgeValidationResult = mongoose ? (mongoose.models.DevForgeValidationResult || mongoose.model('DevForgeValidationResult', DevForgeValidationResultSchema)) : null;
const DevForgeProjectVersion = mongoose ? (mongoose.models.DevForgeProjectVersion || mongoose.model('DevForgeProjectVersion', DevForgeProjectVersionSchema)) : null;
const DevForgeAiReview = mongoose ? (mongoose.models.DevForgeAiReview || mongoose.model('DevForgeAiReview', DevForgeAiReviewSchema)) : null;
const DevForgeModifyDiff = mongoose ? (mongoose.models.DevForgeModifyDiff || mongoose.model('DevForgeModifyDiff', DevForgeModifyDiffSchema)) : null;
const DevForgeIndexRecommendation = mongoose ? (mongoose.models.DevForgeIndexRecommendation || mongoose.model('DevForgeIndexRecommendation', DevForgeIndexRecommendationSchema)) : null;

const memoryStore = {
  users: [],
  projects: [],
  requirements: [],
  entities: [],
  attributes: [],
  relationships: [],
  generated_schemas: [],
  generated_sql: [],
  validation_results: [],
  ai_suggestions: [],
  project_versions: [],
  ai_reviews: [],
  modify_diffs: [],
  index_recommendations: []
};
let isMemoryFallback = false;

const loadFromMongo = async () => {
  if (!useMongo || !mongoose) return;
  try {
    // Clean up any corrupted projects where id was mistakenly set to 'completed' or invalid string
    await DevForgeProject.deleteMany({ id: 'completed' });

    const users = await DevForgeUser.find({});
    memoryStore.users = users.map(u => u.toObject());

    const projects = await DevForgeProject.find({}).sort({ createdAt: 1, _id: 1 });
    const projectList = projects.map(p => p.toObject());

    // Repair step: Remap legacy numeric project_ids (e.g. 1, 2) to actual project IDs before orphan purge
    for (let i = 0; i < projectList.length; i++) {
      const p = projectList[i];
      const targetId = p.id !== undefined && p.id !== null ? p.id : String(p._id);
      const legacyId = i + 1;

      if (legacyId !== targetId && String(legacyId) !== String(targetId)) {
        const legacyMatches = [legacyId, String(legacyId)];
        await DevForgeRequirement.updateMany({ project_id: { $in: legacyMatches } }, { project_id: targetId });
        await DevForgeEntity.updateMany({ project_id: { $in: legacyMatches } }, { project_id: targetId });
        await DevForgeRelationship.updateMany({ project_id: { $in: legacyMatches } }, { project_id: targetId });
        await DevForgeGeneratedSchema.updateMany({ project_id: { $in: legacyMatches } }, { project_id: targetId });
        await DevForgeGeneratedSql.updateMany({ project_id: { $in: legacyMatches } }, { project_id: targetId });
        await DevForgeValidationResult.updateMany({ project_id: { $in: legacyMatches } }, { project_id: targetId });
        await DevForgeProjectVersion.updateMany({ project_id: { $in: legacyMatches } }, { project_id: targetId });
        await DevForgeAiReview.updateMany({ project_id: { $in: legacyMatches } }, { project_id: targetId });
        await DevForgeModifyDiff.updateMany({ project_id: { $in: legacyMatches } }, { project_id: targetId });
        await DevForgeIndexRecommendation.updateMany({ project_id: { $in: legacyMatches } }, { project_id: targetId });
      }
    }

    memoryStore.projects = projectList.map(p => ({
      ...p,
      id: p.id !== undefined && p.id !== null ? p.id : String(p._id),
      created_at: p.created_at || p.createdAt || new Date().toISOString(),
      updated_at: p.updated_at || p.updatedAt || new Date().toISOString()
    }));

    // Active project IDs set
    const activeProjIds = new Set();
    memoryStore.projects.forEach(p => {
      if (p.id !== undefined && p.id !== null && p.id !== 'completed') {
        activeProjIds.add(p.id);
        activeProjIds.add(String(p.id));
        if (!isNaN(Number(p.id))) activeProjIds.add(Number(p.id));
      }
      if (p._id) {
        activeProjIds.add(String(p._id));
      }
    });

    const activeList = Array.from(activeProjIds);

    // Auto-clean orphaned MongoDB documents whose parent project was deleted
    await DevForgeRequirement.deleteMany({ project_id: { $nin: activeList } });
    await DevForgeEntity.deleteMany({ project_id: { $nin: activeList } });
    await DevForgeRelationship.deleteMany({ project_id: { $nin: activeList } });
    await DevForgeGeneratedSchema.deleteMany({ project_id: { $nin: activeList } });
    await DevForgeGeneratedSql.deleteMany({ project_id: { $nin: activeList } });
    await DevForgeValidationResult.deleteMany({ project_id: { $nin: activeList } });
    await DevForgeProjectVersion.deleteMany({ project_id: { $nin: activeList } });
    await DevForgeAiReview.deleteMany({ project_id: { $nin: activeList } });
    await DevForgeModifyDiff.deleteMany({ project_id: { $nin: activeList } });
    await DevForgeIndexRecommendation.deleteMany({ project_id: { $nin: activeList } });

    // Clean attributes for deleted entities
    const currentEnts = await DevForgeEntity.find({});
    const activeEntIds = new Set(currentEnts.flatMap(e => [e.id, String(e.id), e._id ? String(e._id) : null]).filter(Boolean));
    await DevForgeAttribute.deleteMany({ entity_id: { $nin: Array.from(activeEntIds) } });

    // Re-populate clean in-memory state
    const reqs = await DevForgeRequirement.find({});
    memoryStore.requirements = reqs.map(r => r.toObject());

    memoryStore.entities = currentEnts.map(e => e.toObject());

    const attrs = await DevForgeAttribute.find({});
    memoryStore.attributes = attrs.map(a => a.toObject());

    const rels = await DevForgeRelationship.find({});
    memoryStore.relationships = rels.map(r => r.toObject());

    const schemas = await DevForgeGeneratedSchema.find({});
    memoryStore.generated_schemas = schemas.map(s => s.toObject());

    const sqls = await DevForgeGeneratedSql.find({});
    memoryStore.generated_sql = sqls.map(s => s.toObject());

    const vals = await DevForgeValidationResult.find({});
    memoryStore.validation_results = vals.map(v => v.toObject());

    const vers = await DevForgeProjectVersion.find({});
    memoryStore.project_versions = vers.map(v => v.toObject());

    const revs = await DevForgeAiReview.find({});
    memoryStore.ai_reviews = revs.map(r => r.toObject());

    const diffs = await DevForgeModifyDiff.find({});
    memoryStore.modify_diffs = diffs.map(d => d.toObject());

    const idxs = await DevForgeIndexRecommendation.find({});
    memoryStore.index_recommendations = idxs.map(i => i.toObject());

    console.log(`Loaded ${memoryStore.projects.length} active database projects from MongoDB Cluster (orphans purged).`);
  } catch (err) {
    console.warn('Error loading initial data from MongoDB:', err.message);
  }
};

const syncMongoQuery = async (text, params, memResult) => {
  if (!useMongo || !mongoose) return;
  try {
    const t = text.trim().replace(/\s+/g, ' ');
    if (t.includes('INSERT INTO users')) {
      const id = params[3] || Date.now();
      await DevForgeUser.findOneAndUpdate({ email: params[1] }, { id, full_name: params[0], email: params[1], password_hash: params[2] }, { upsert: true });
    } else if (t.includes('UPDATE users SET password_hash')) {
      await DevForgeUser.updateOne({ id: params[1] }, { password_hash: params[0] });
    } else if (t.includes('INSERT INTO projects')) {
      const createdProj = (memResult && memResult.rows && memResult.rows[0]) ? memResult.rows[0] : null;
      const isStatusParam = (params[4] && typeof params[4] === 'string' && isNaN(Number(params[4])));
      const projId = createdProj ? createdProj.id : (isStatusParam ? Date.now() : (params[4] || Date.now()));
      const projStatus = isStatusParam ? params[4] : 'draft';
      await DevForgeProject.create({
        id: projId,
        user_id: params[0],
        name: params[1],
        description: params[2],
        database_type: params[3] || 'PostgreSQL',
        status: projStatus
      });
    } else if (t.includes('UPDATE projects SET status')) {
      const projId = params[1];
      const pIdMatch = [projId, String(projId)];
      if (!isNaN(Number(projId))) pIdMatch.push(Number(projId));

      const validObjectIds = pIdMatch.filter(id => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id));
      const conds = [{ id: { $in: pIdMatch } }];
      if (validObjectIds.length > 0) conds.push({ _id: { $in: validObjectIds } });

      await DevForgeProject.updateOne(conds.length === 1 ? conds[0] : { $or: conds }, { status: params[0] });
    } else if (t.includes('UPDATE projects SET name')) {
      const projId = params[3] !== undefined ? params[3] : params[2];
      const pIdMatch = [projId, String(projId)];
      if (!isNaN(Number(projId))) pIdMatch.push(Number(projId));

      const validObjectIds = pIdMatch.filter(id => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id));
      const conds = [{ id: { $in: pIdMatch } }];
      if (validObjectIds.length > 0) conds.push({ _id: { $in: validObjectIds } });

      await DevForgeProject.updateOne(conds.length === 1 ? conds[0] : { $or: conds }, { name: params[0], description: params[1] });
    } else if (t.includes('DELETE FROM projects WHERE id')) {
      const projId = params[0];
      const idMatch = [projId, String(projId)];
      if (!isNaN(Number(projId))) idMatch.push(Number(projId));

      const validObjectIds = idMatch.filter(id => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id));
      const idFilterConds = [{ id: { $in: idMatch } }];
      if (validObjectIds.length > 0) idFilterConds.push({ _id: { $in: validObjectIds } });

      const idFilter = idFilterConds.length === 1 ? idFilterConds[0] : { $or: idFilterConds };
      const projFilter = { project_id: { $in: idMatch } };

      const ents = await DevForgeEntity.find(projFilter);
      const entIds = ents.flatMap(e => [e.id, String(e.id), e._id ? String(e._id) : null]).filter(Boolean);

      await DevForgeProject.deleteMany(idFilter);
      await DevForgeRequirement.deleteMany(projFilter);
      await DevForgeEntity.deleteMany(projFilter);
      if (entIds.length > 0) {
        await DevForgeAttribute.deleteMany({ entity_id: { $in: entIds } });
      }
      await DevForgeRelationship.deleteMany(projFilter);
      await DevForgeGeneratedSchema.deleteMany(projFilter);
      await DevForgeGeneratedSql.deleteMany(projFilter);
      await DevForgeValidationResult.deleteMany(projFilter);
      await DevForgeProjectVersion.deleteMany(projFilter);
      await DevForgeAiReview.deleteMany(projFilter);
      await DevForgeModifyDiff.deleteMany(projFilter);
      await DevForgeIndexRecommendation.deleteMany(projFilter);
    } else if (t.includes('INSERT INTO requirements')) {
      const pIdMatch = [params[0], String(params[0])];
      if (!isNaN(Number(params[0]))) pIdMatch.push(Number(params[0]));
      await DevForgeRequirement.findOneAndUpdate(
        { project_id: { $in: pIdMatch } },
        { id: Date.now(), project_id: params[0], raw_text: params[1], domain: params[2], analysis_json: params[3] },
        { upsert: true }
      );
    } else if (t.includes('INSERT INTO entities')) {
      const createdEnt = (memResult && memResult.rows && memResult.rows[0]) ? memResult.rows[0] : null;
      const entId = createdEnt ? createdEnt.id : (Date.now() + Math.random());
      await DevForgeEntity.create({ id: entId, project_id: params[0], name: params[1], description: params[2] });
    } else if (t.includes('DELETE FROM entities WHERE project_id')) {
      const pIdMatch = [params[0], String(params[0])];
      if (!isNaN(Number(params[0]))) pIdMatch.push(Number(params[0]));
      await DevForgeEntity.deleteMany({ project_id: { $in: pIdMatch } });
    } else if (t.includes('INSERT INTO attributes')) {
      const createdAttr = (memResult && memResult.rows && memResult.rows[0]) ? memResult.rows[0] : null;
      const attrId = createdAttr ? createdAttr.id : (Date.now() + Math.random());
      await DevForgeAttribute.create({ id: attrId, entity_id: params[0], name: params[1], data_type: params[2], is_primary_key: params[3], is_foreign_key: params[4], is_nullable: params[5], is_unique: params[6], auto_increment: params[7], default_value: params[8] });
    } else if (t.includes('DELETE FROM attributes WHERE entity_id')) {
      const eIdMatch = [params[0], String(params[0])];
      if (!isNaN(Number(params[0]))) eIdMatch.push(Number(params[0]));
      await DevForgeAttribute.deleteMany({ entity_id: { $in: eIdMatch } });
    } else if (t.includes('INSERT INTO relationships')) {
      const createdRel = (memResult && memResult.rows && memResult.rows[0]) ? memResult.rows[0] : null;
      const relId = createdRel ? createdRel.id : (Date.now() + Math.random());
      await DevForgeRelationship.create({ id: relId, project_id: params[0], source_entity: params[1], target_entity: params[2], type: params[3], source_column: params[4], target_column: params[5], foreign_key_column: params[6], on_delete: params[7], on_update: params[8], description: params[9] });
    } else if (t.includes('DELETE FROM relationships WHERE project_id')) {
      const pIdMatch = [params[0], String(params[0])];
      if (!isNaN(Number(params[0]))) pIdMatch.push(Number(params[0]));
      await DevForgeRelationship.deleteMany({ project_id: { $in: pIdMatch } });
    } else if (t.includes('UPDATE generated_schemas SET schema_json')) {
      const pIdMatch = [params[1], String(params[1])];
      if (!isNaN(Number(params[1]))) pIdMatch.push(Number(params[1]));
      await DevForgeGeneratedSchema.updateOne({ project_id: { $in: pIdMatch } }, { schema_json: params[0] });
    } else if (t.includes('INSERT INTO generated_schemas')) {
      const pIdMatch = [params[0], String(params[0])];
      if (!isNaN(Number(params[0]))) pIdMatch.push(Number(params[0]));
      await DevForgeGeneratedSchema.findOneAndUpdate(
        { project_id: { $in: pIdMatch } },
        { id: Date.now(), project_id: params[0], schema_json: params[1], normalization_status: params[2] },
        { upsert: true }
      );
    } else if (t.includes('INSERT INTO generated_sql')) {
      const pIdMatch = [params[0], String(params[0])];
      if (!isNaN(Number(params[0]))) pIdMatch.push(Number(params[0]));
      await DevForgeGeneratedSql.findOneAndUpdate(
        { project_id: { $in: pIdMatch } },
        { id: Date.now(), project_id: params[0], ddl_sql: params[1], sample_data_sql: params[2], dialect: params[3], is_outdated: false },
        { upsert: true }
      );
    } else if (t.includes('INSERT INTO validation_results')) {
      const pIdMatch = [params[0], String(params[0])];
      if (!isNaN(Number(params[0]))) pIdMatch.push(Number(params[0]));
      await DevForgeValidationResult.findOneAndUpdate(
        { project_id: { $in: pIdMatch } },
        { id: Date.now(), project_id: params[0], score: params[1], is_valid: params[2], issues: params[3] },
        { upsert: true }
      );
    } else if (t.includes('INSERT INTO project_versions')) {
      await DevForgeProjectVersion.create({ id: Date.now(), project_id: params[0], version_number: params[1], snapshot_json: params[2] });
    } else if (t.includes('INSERT INTO ai_reviews')) {
      await DevForgeAiReview.create({ id: Date.now(), project_id: params[0], review_number: params[1], summary: params[2], total_suggestions: params[3], critical_count: params[4], warning_count: params[5], improvement_count: params[6], review_data: params[7] });
    } else if (t.includes('DELETE FROM ai_reviews WHERE id')) {
      await DevForgeAiReview.deleteOne({ id: params[0] });
    } else if (t.includes('DELETE FROM ai_reviews WHERE project_id')) {
      const pIdMatch = [params[0], String(params[0])];
      if (!isNaN(Number(params[0]))) pIdMatch.push(Number(params[0]));
      await DevForgeAiReview.deleteMany({ project_id: { $in: pIdMatch } });
    } else if (t.includes('INSERT INTO modify_diffs')) {
      await DevForgeModifyDiff.create({ id: Date.now(), project_id: params[0], before_score: params[1], after_score: params[2], before_snapshot: params[3], after_snapshot: params[4], diff_json: params[5] });
    } else if (t.includes('INSERT INTO index_recommendations')) {
      const pIdMatch = [params[0], String(params[0])];
      if (!isNaN(Number(params[0]))) pIdMatch.push(Number(params[0]));
      await DevForgeIndexRecommendation.findOneAndUpdate(
        { project_id: { $in: pIdMatch } },
        { id: Date.now(), project_id: params[0], recommendations_json: params[1], applied_indexes_json: params[2], ignored_indexes_json: params[3], ai_analysis_json: params[4], is_outdated: false },
        { upsert: true }
      );
    } else if (t.includes('UPDATE index_recommendations SET applied_indexes_json')) {
      const pIdMatch = [params[2], String(params[2])];
      if (!isNaN(Number(params[2]))) pIdMatch.push(Number(params[2]));
      await DevForgeIndexRecommendation.updateOne({ project_id: { $in: pIdMatch } }, { applied_indexes_json: params[0], ignored_indexes_json: params[1], is_outdated: false });
    } else if (t.includes('UPDATE index_recommendations SET ai_analysis_json')) {
      const pIdMatch = [params[1], String(params[1])];
      if (!isNaN(Number(params[1]))) pIdMatch.push(Number(params[1]));
      await DevForgeIndexRecommendation.updateOne({ project_id: { $in: pIdMatch } }, { ai_analysis_json: params[0], is_outdated: false });
    }
  } catch (err) {
    console.warn('MongoDB sync warning:', err.message);
  }
};

const initDb = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri && mongoose) {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await mongoose.connect(mongoUri, {
          serverSelectionTimeoutMS: 12000,
          connectTimeoutMS: 12000,
          retryWrites: true
        });
        useMongo = true;
        console.log('Connected successfully to MongoDB Cluster. Storing all content in MongoDB.');
        await loadFromMongo();
        return;
      } catch (err) {
        if (attempt < maxRetries) {
          console.warn(`MongoDB Cluster connection attempt ${attempt}/${maxRetries} failed: ${err.message}. Retrying in 1.5s...`);
          await new Promise(res => setTimeout(res, 1500));
        } else {
          useMongo = false;
          console.warn('MongoDB Cluster connection skipped/failed, using in-memory store:', err.message);
        }
      }
    }
  }

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && Pool) {
    try {
      pgPool = new Pool({
        connectionString: dbUrl,
        connectionTimeoutMillis: 3000
      });
      await pgPool.query('SELECT 1');
      usePg = true;
      console.log('Connected successfully to PostgreSQL database.');
      return;
    } catch (err) {
      console.warn('PostgreSQL connection failed. Falling back to memory database:', err.message);
      if (pgPool) {
        pgPool.end().catch(() => {});
        pgPool = null;
      }
    }
  }

  isMemoryFallback = true;
  console.log('Running in zero-dependency in-memory database mode.');
};

const query = async (text, params = []) => {
  if (usePg && pgPool) {
    const res = await pgPool.query(text, params);
    return res;
  }

  const memResult = await handleMemoryQuery(text, params);

  if (useMongo) {
    syncMongoQuery(text, params, memResult).catch((err) => {
      console.warn('MongoDB sync warning:', err.message);
    });
  }

  return memResult;
};

const handleMemoryQuery = async (text, params) => {
  const t = text.trim();

  // Users
  if (t.includes('INSERT INTO users')) {
    const user = {
      id: memoryStore.users.length + 1,
      full_name: params[0],
      email: params[1],
      password_hash: params[2],
      created_at: new Date().toISOString()
    };
    memoryStore.users.push(user);
    return { rows: [user], rowCount: 1 };
  }
  if (t.includes('SELECT * FROM users WHERE LOWER(email)')) {
    const user = memoryStore.users.find((u) => u.email && u.email.toLowerCase() === params[0].toLowerCase());
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }
  if (t.includes('SELECT id FROM users WHERE LOWER(email)')) {
    const user = memoryStore.users.find((u) => u.email && u.email.toLowerCase() === params[0].toLowerCase());
    return { rows: user ? [{ id: user.id }] : [], rowCount: user ? 1 : 0 };
  }
  if (t.includes('SELECT password_hash FROM users WHERE id')) {
    const user = memoryStore.users.find((u) => String(u.id) === String(params[0]));
    return { rows: user ? [{ password_hash: user.password_hash }] : [], rowCount: user ? 1 : 0 };
  }
  if (t.includes('UPDATE users SET password_hash')) {
    const user = memoryStore.users.find((u) => String(u.id) === String(params[1]));
    if (user) user.password_hash = params[0];
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }
  if (t.includes('SELECT id, full_name, email, created_at FROM users WHERE id')) {
    const user = memoryStore.users.find((u) => String(u.id) === String(params[0]));
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }
  if (t.includes('SELECT full_name FROM users WHERE id')) {
    const user = memoryStore.users.find((u) => String(u.id) === String(params[0]));
    return { rows: user ? [{ full_name: user.full_name }] : [], rowCount: user ? 1 : 0 };
  }

  // Projects
  if (t === 'SELECT * FROM projects') {
    const formatted = memoryStore.projects.map(p => {
      const pId = p.id !== undefined && p.id !== null ? p.id : p._id;
      const count = memoryStore.entities.filter(e => String(e.project_id) === String(pId) || (p._id && String(e.project_id) === String(p._id))).length;
      return {
        ...p,
        id: pId,
        created_at: p.created_at || p.createdAt || new Date().toISOString(),
        updated_at: p.updated_at || p.updatedAt || new Date().toISOString(),
        table_count: count,
        entity_count: count
      };
    });
    return { rows: formatted, rowCount: formatted.length };
  }
  if (t.includes('SELECT p.*')) {
    const userProjs = memoryStore.projects.filter((p) => String(p.user_id) === String(params[0]));
    const formatted = userProjs.map(p => {
      const pId = p.id !== undefined && p.id !== null ? p.id : p._id;
      const count = memoryStore.entities.filter(e => String(e.project_id) === String(pId) || (p._id && String(e.project_id) === String(p._id))).length;
      return {
        ...p,
        id: pId,
        created_at: p.created_at || p.createdAt || new Date().toISOString(),
        updated_at: p.updated_at || p.updatedAt || new Date().toISOString(),
        table_count: count,
        entity_count: count
      };
    });
    return { rows: formatted, rowCount: formatted.length };
  }
  if (t.includes('INSERT INTO projects')) {
    const isStatusParam = (params[4] && typeof params[4] === 'string' && isNaN(Number(params[4])));
    const projId = (params[4] && !isStatusParam) ? params[4] : Date.now();
    const projStatus = isStatusParam ? params[4] : 'draft';
    const proj = {
      id: projId,
      user_id: params[0],
      name: params[1],
      description: params[2],
      database_type: params[3] || 'PostgreSQL',
      status: projStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    memoryStore.projects.push(proj);
    return { rows: [proj], rowCount: 1 };
  }
  if (t.includes('SELECT user_id, database_type, name FROM projects WHERE id')) {
    const proj = memoryStore.projects.find((p) => p.id == params[0] || p._id == params[0]);
    return { rows: proj ? [{ user_id: proj.user_id, database_type: proj.database_type, name: proj.name }] : [], rowCount: proj ? 1 : 0 };
  }
  if (t.includes('SELECT user_id, database_type FROM projects WHERE id')) {
    const proj = memoryStore.projects.find((p) => p.id == params[0] || p._id == params[0]);
    return { rows: proj ? [{ user_id: proj.user_id, database_type: proj.database_type }] : [], rowCount: proj ? 1 : 0 };
  }
  if (t.includes('SELECT user_id FROM projects WHERE id')) {
    const proj = memoryStore.projects.find((p) => p.id == params[0] || p._id == params[0]);
    return { rows: proj ? [{ user_id: proj.user_id }] : [], rowCount: proj ? 1 : 0 };
  }
  if (t.includes('SELECT * FROM projects WHERE id')) {
    const proj = memoryStore.projects.find((p) => p.id == params[0] || p._id == params[0]);
    return { rows: proj ? [proj] : [], rowCount: proj ? 1 : 0 };
  }
  if (t.includes('UPDATE projects SET status')) {
    const proj = memoryStore.projects.find((p) => p.id == params[1] || p._id == params[1]);
    if (proj) proj.status = params[0];
    return { rows: proj ? [proj] : [], rowCount: proj ? 1 : 0 };
  }
  if (t.includes('UPDATE projects SET name')) {
    const projId = params[3] !== undefined ? params[3] : params[2];
    const proj = memoryStore.projects.find((p) => p.id == projId || p._id == projId);
    if (proj) {
      proj.name = params[0];
      proj.description = params[1];
    }
    return { rows: proj ? [proj] : [], rowCount: proj ? 1 : 0 };
  }
  if (t.includes('DELETE FROM projects WHERE id')) {
    const projId = params[0];
    memoryStore.projects = memoryStore.projects.filter(p => p.id != projId && p._id != projId);
    memoryStore.requirements = memoryStore.requirements.filter(r => r.project_id != projId);
    memoryStore.entities = memoryStore.entities.filter(e => e.project_id != projId);
    memoryStore.generated_schemas = memoryStore.generated_schemas.filter(s => s.project_id != projId);
    memoryStore.generated_sql = memoryStore.generated_sql.filter(s => s.project_id != projId);
    memoryStore.validation_results = memoryStore.validation_results.filter(v => v.project_id != projId);
    memoryStore.project_versions = memoryStore.project_versions.filter(v => v.project_id != projId);
    memoryStore.ai_reviews = memoryStore.ai_reviews.filter(r => r.project_id != projId);
    memoryStore.modify_diffs = memoryStore.modify_diffs.filter(d => d.project_id != projId);
    memoryStore.index_recommendations = memoryStore.index_recommendations.filter(i => i.project_id != projId);
    return { rows: [], rowCount: 1 };
  }

  // Requirements
  if (t.includes('SELECT * FROM requirements WHERE project_id')) {
    const req = memoryStore.requirements.find((r) => r.project_id == params[0]);
    return { rows: req ? [req] : [], rowCount: req ? 1 : 0 };
  }
  if (t.includes('INSERT INTO requirements')) {
    const idx = memoryStore.requirements.findIndex(r => r.project_id == params[0]);
    const reqData = {
      id: idx >= 0 ? memoryStore.requirements[idx].id : memoryStore.requirements.length + 1,
      project_id: params[0],
      raw_text: params[1],
      domain: params[2] || '',
      analysis_json: params[3] || null,
      updated_at: new Date().toISOString()
    };
    if (idx >= 0) {
      memoryStore.requirements[idx] = reqData;
    } else {
      memoryStore.requirements.push(reqData);
    }
    return { rows: [reqData], rowCount: 1 };
  }

  // Entities & Attributes
  if (t.includes('SELECT id FROM entities WHERE project_id')) {
    const list = memoryStore.entities.filter(e => e.project_id == params[0]);
    return { rows: list.map(e => ({ id: e.id })), rowCount: list.length };
  }
  if (t.includes('SELECT * FROM entities WHERE project_id')) {
    const list = memoryStore.entities.filter(e => e.project_id == params[0]);
    return { rows: list, rowCount: list.length };
  }
  if (t.includes('DELETE FROM entities WHERE project_id')) {
    memoryStore.entities = memoryStore.entities.filter(e => e.project_id != params[0]);
    return { rows: [], rowCount: 1 };
  }
  if (t.includes('INSERT INTO entities')) {
    const ent = {
      id: memoryStore.entities.length + 1,
      project_id: params[0],
      name: params[1],
      description: params[2] || ''
    };
    memoryStore.entities.push(ent);
    return { rows: [{ id: ent.id }], rowCount: 1 };
  }
  if (t.includes('SELECT * FROM attributes WHERE entity_id')) {
    const list = memoryStore.attributes.filter(a => a.entity_id == params[0]);
    return { rows: list, rowCount: list.length };
  }
  if (t.includes('DELETE FROM attributes WHERE entity_id')) {
    memoryStore.attributes = memoryStore.attributes.filter(a => a.entity_id != params[0]);
    return { rows: [], rowCount: 1 };
  }
  if (t.includes('INSERT INTO attributes')) {
    const attr = {
      id: memoryStore.attributes.length + 1,
      entity_id: params[0],
      name: params[1],
      data_type: params[2],
      is_primary_key: params[3],
      is_foreign_key: params[4],
      is_nullable: params[5],
      is_unique: params[6],
      is_auto_increment: params[7],
      default_value: params[8]
    };
    memoryStore.attributes.push(attr);
    return { rows: [attr], rowCount: 1 };
  }

  // Relationships
  if (t.includes('SELECT * FROM relationships WHERE project_id')) {
    const list = memoryStore.relationships.filter(r => r.project_id == params[0]);
    return { rows: list, rowCount: list.length };
  }
  if (t.includes('DELETE FROM relationships WHERE project_id')) {
    memoryStore.relationships = memoryStore.relationships.filter(r => r.project_id != params[0]);
    return { rows: [], rowCount: 1 };
  }
  if (t.includes('INSERT INTO relationships')) {
    const rel = {
      id: memoryStore.relationships.length + 1,
      project_id: params[0],
      source_entity: params[1],
      target_entity: params[2],
      type: params[3],
      source_column: params[4] || null,
      target_column: params[5] || null,
      foreign_key_column: params[6] || null,
      on_delete: params[7] || 'CASCADE',
      on_update: params[8] || 'CASCADE',
      description: params[9] || ''
    };
    memoryStore.relationships.push(rel);
    return { rows: [rel], rowCount: 1 };
  }

  // Schemas & SQL
  if (t.includes('SELECT * FROM generated_schemas WHERE project_id') || t.includes('SELECT schema_json FROM generated_schemas WHERE project_id')) {
    const item = memoryStore.generated_schemas.find(s => s.project_id == params[0]);
    return { rows: item ? [item] : [], rowCount: item ? 1 : 0 };
  }
  if (t.includes('UPDATE generated_schemas SET schema_json')) {
    const item = memoryStore.generated_schemas.find(s => s.project_id == params[1]);
    if (item) item.schema_json = params[0];
    return { rows: item ? [item] : [], rowCount: item ? 1 : 0 };
  }
  if (t.includes('INSERT INTO generated_schemas')) {
    const idx = memoryStore.generated_schemas.findIndex(s => s.project_id == params[0]);
    const item = {
      id: idx >= 0 ? memoryStore.generated_schemas[idx].id : memoryStore.generated_schemas.length + 1,
      project_id: params[0],
      schema_json: params[1],
      normalization_status: params[2] || null
    };
    if (idx >= 0) memoryStore.generated_schemas[idx] = item;
    else memoryStore.generated_schemas.push(item);
    return { rows: [item], rowCount: 1 };
  }
  if (t.includes('SELECT * FROM generated_sql WHERE project_id') || t.includes('SELECT ddl_sql, sample_data_sql, dialect FROM generated_sql WHERE project_id') || t.includes('SELECT ddl_sql FROM generated_sql WHERE project_id')) {
    const item = memoryStore.generated_sql.find(s => s.project_id == params[0]);
    return { rows: item ? [item] : [], rowCount: item ? 1 : 0 };
  }
  if (t.includes('INSERT INTO generated_sql')) {
    const idx = memoryStore.generated_sql.findIndex(s => s.project_id == params[0]);
    const item = {
      id: idx >= 0 ? memoryStore.generated_sql[idx].id : memoryStore.generated_sql.length + 1,
      project_id: params[0],
      ddl_sql: params[1],
      sample_data_sql: params[2] || '',
      dialect: params[3] || 'PostgreSQL'
    };
    if (idx >= 0) memoryStore.generated_sql[idx] = item;
    else memoryStore.generated_sql.push(item);
    return { rows: [item], rowCount: 1 };
  }

  // Validation
  if (t.includes('SELECT * FROM validation_results WHERE project_id') || t.includes('SELECT score, is_valid, issues FROM validation_results WHERE project_id') || t.includes('SELECT issues FROM validation_results WHERE project_id')) {
    const item = memoryStore.validation_results.find(v => v.project_id == params[0]);
    return { rows: item ? [item] : [], rowCount: item ? 1 : 0 };
  }
  if (t.includes('INSERT INTO validation_results')) {
    const idx = memoryStore.validation_results.findIndex(v => v.project_id == params[0]);
    const item = {
      id: idx >= 0 ? memoryStore.validation_results[idx].id : memoryStore.validation_results.length + 1,
      project_id: params[0],
      score: params[1],
      is_valid: params[2],
      issues: params[3]
    };
    if (idx >= 0) memoryStore.validation_results[idx] = item;
    else memoryStore.validation_results.push(item);
    return { rows: [item], rowCount: 1 };
  }

  // Versions
  if (t.includes('SELECT snapshot_json FROM project_versions WHERE project_id')) {
    const item = memoryStore.project_versions.find(v => v.project_id == params[0] && v.version_number == params[1]);
    return { rows: item ? [item] : [], rowCount: item ? 1 : 0 };
  }
  if (t.includes('SELECT id, version_number, created_at FROM project_versions WHERE project_id')) {
    const list = memoryStore.project_versions.filter(v => v.project_id == params[0]);
    return { rows: list, rowCount: list.length };
  }
  if (t.includes('SELECT MAX(version_number)')) {
    const list = memoryStore.project_versions.filter(v => v.project_id == params[0]);
    const maxV = list.reduce((m, v) => Math.max(m, v.version_number || 0), 0);
    return { rows: [{ max_v: maxV }], rowCount: 1 };
  }
  if (t.includes('INSERT INTO project_versions')) {
    const vItem = {
      id: memoryStore.project_versions.length + 1,
      project_id: params[0],
      version_number: params[1],
      snapshot_json: params[2],
      created_at: new Date().toISOString()
    };
    memoryStore.project_versions.push(vItem);
    return { rows: [vItem], rowCount: 1 };
  }

  // AI Reviews
  if (t.includes('SELECT MAX(review_number)')) {
    const list = memoryStore.ai_reviews.filter(r => r.project_id == params[0]);
    const maxV = list.reduce((m, r) => Math.max(m, r.review_number || 0), 0);
    return { rows: [{ max_rev: maxV }], rowCount: 1 };
  }
  if (t.includes('SELECT * FROM ai_reviews WHERE project_id')) {
    const list = memoryStore.ai_reviews
      .filter(r => r.project_id == params[0])
      .sort((a, b) => (b.review_number || 0) - (a.review_number || 0) || b.id - a.id);
    return { rows: list, rowCount: list.length };
  }
  if (t.includes('INSERT INTO ai_reviews')) {
    const revItem = {
      id: memoryStore.ai_reviews.length + 1,
      project_id: params[0],
      review_number: params[1],
      summary: params[2],
      total_suggestions: params[3],
      critical_count: params[4],
      warning_count: params[5],
      improvement_count: params[6],
      review_data: params[7],
      created_at: new Date().toISOString()
    };
    memoryStore.ai_reviews.push(revItem);
    return { rows: [revItem], rowCount: 1 };
  }
  if (t.includes('DELETE FROM ai_reviews WHERE id')) {
    memoryStore.ai_reviews = memoryStore.ai_reviews.filter(r => r.id != params[0]);
    return { rows: [], rowCount: 1 };
  }
  if (t.includes('DELETE FROM ai_reviews WHERE project_id')) {
    memoryStore.ai_reviews = memoryStore.ai_reviews.filter(r => r.project_id != params[0]);
    return { rows: [], rowCount: 1 };
  }

  // Modify Diffs
  if (t.includes('SELECT * FROM modify_diffs WHERE project_id')) {
    const list = memoryStore.modify_diffs
      .filter(r => r.project_id == params[0])
      .sort((a, b) => b.id - a.id);
    return { rows: list, rowCount: list.length };
  }
  if (t.includes('INSERT INTO modify_diffs')) {
    const diffItem = {
      id: memoryStore.modify_diffs.length + 1,
      project_id: params[0],
      before_score: params[1],
      after_score: params[2],
      before_snapshot: params[3],
      after_snapshot: params[4],
      diff_json: params[5],
      created_at: new Date().toISOString()
    };
    memoryStore.modify_diffs.push(diffItem);
    return { rows: [diffItem], rowCount: 1 };
  }

  // Index Recommendations
  if (t.includes('SELECT applied_indexes_json, ignored_indexes_json, ai_analysis_json, is_outdated FROM index_recommendations WHERE project_id') ||
      t.includes('SELECT applied_indexes_json, ignored_indexes_json, ai_analysis_json FROM index_recommendations WHERE project_id') ||
      t.includes('SELECT ai_analysis_json FROM index_recommendations WHERE project_id') ||
      t.includes('SELECT applied_indexes_json, ignored_indexes_json FROM index_recommendations WHERE project_id')) {
    const item = memoryStore.index_recommendations.find(i => i.project_id == params[0]);
    return { rows: item ? [item] : [], rowCount: item ? 1 : 0 };
  }
  if (t.includes('INSERT INTO index_recommendations')) {
    const idx = memoryStore.index_recommendations.findIndex(i => i.project_id == params[0]);
    const item = {
      id: idx >= 0 ? memoryStore.index_recommendations[idx].id : memoryStore.index_recommendations.length + 1,
      project_id: params[0],
      recommendations_json: params[1],
      applied_indexes_json: params[2],
      ignored_indexes_json: params[3],
      ai_analysis_json: params[4],
      is_outdated: 0
    };
    if (idx >= 0) memoryStore.index_recommendations[idx] = item;
    else memoryStore.index_recommendations.push(item);
    return { rows: [item], rowCount: 1 };
  }
  if (t.includes('UPDATE index_recommendations SET applied_indexes_json')) {
    const item = memoryStore.index_recommendations.find(i => i.project_id == params[2]);
    if (item) {
      item.applied_indexes_json = params[0];
      item.ignored_indexes_json = params[1];
    }
    return { rows: item ? [item] : [], rowCount: item ? 1 : 0 };
  }
  if (t.includes('UPDATE index_recommendations SET ai_analysis_json')) {
    const item = memoryStore.index_recommendations.find(i => i.project_id == params[1]);
    if (item) {
      item.ai_analysis_json = params[0];
    }
    return { rows: item ? [item] : [], rowCount: item ? 1 : 0 };
  }

  return { rows: [], rowCount: 0 };
};

module.exports = {
  initDb,
  query,
  isPg: () => usePg
};
