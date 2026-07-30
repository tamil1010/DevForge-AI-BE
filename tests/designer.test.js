const test = require('node:test');
const assert = require('node:assert');
const schemaService = require('../src/services/schemaService');
const sqlGeneratorService = require('../src/services/sqlGeneratorService');
const normalizationService = require('../src/services/normalizationService');
const validationService = require('../src/services/validationService');

test('E-Commerce Relational Schema & SQL Generation Test', () => {
  const entities = [
    {
      name: 'Customer',
      attributes: [
        { name: 'customer_id', type: 'INTEGER', primaryKey: true, foreignKey: false, nullable: false, unique: true, autoIncrement: true },
        { name: 'full_name', type: 'VARCHAR(255)', primaryKey: false, foreignKey: false, nullable: false, unique: false, autoIncrement: false },
        { name: 'email', type: 'VARCHAR(255)', primaryKey: false, foreignKey: false, nullable: false, unique: true, autoIncrement: false }
      ]
    },
    {
      name: 'Order',
      attributes: [
        { name: 'order_id', type: 'INTEGER', primaryKey: true, foreignKey: false, nullable: false, unique: true, autoIncrement: true },
        { name: 'customer_id', type: 'INTEGER', primaryKey: false, foreignKey: true, nullable: false, unique: false, autoIncrement: false },
        { name: 'total_amount', type: 'DECIMAL(10,2)', primaryKey: false, foreignKey: false, nullable: false, unique: false, autoIncrement: false }
      ]
    }
  ];

  const relationships = [
    { from: 'Customer', to: 'Order', type: 'one-to-many', description: 'Customer places orders' }
  ];

  const schema = schemaService.generateRelationalSchema(entities, relationships);
  assert.strictEqual(schema.tables.length, 2, 'Should contain 2 tables');

  const orderTable = schema.tables.find((t) => t.name === 'Order');
  const fkCol = orderTable.columns.find((c) => c.name === 'customer_id');
  assert.strictEqual(fkCol.isForeignKey, true, 'customer_id should be foreign key');

  // Test SQL Generation
  const pgSql = sqlGeneratorService.generateSqlScript(schema, 'PostgreSQL');
  assert.ok(pgSql.ddlSql.includes('CREATE TABLE'), 'Should contain CREATE TABLE statement');
  assert.ok(pgSql.ddlSql.includes('FOREIGN KEY'), 'Should contain FOREIGN KEY constraint');

  // Test MongoDB Generation
  const mongoRes = sqlGeneratorService.generateSqlScript(schema, 'MongoDB');
  assert.ok(mongoRes.ddlSql.includes('mongoose.Schema'), 'Should contain Mongoose Schema');
  assert.ok(mongoRes.ddlSql.includes('db.createCollection'), 'Should contain MongoDB Shell createCollection');
  assert.ok(mongoRes.sampleDataSql.includes('insertMany'), 'Should contain MongoDB insertMany');

  // Test Normalization Analysis
  const norm = normalizationService.analyzeNormalization(schema);
  assert.strictEqual(norm.overallScore, 100, 'Score should be 100 for clean schema');

  // Test Validation
  const val = validationService.validateSchemaAndSql(schema, pgSql.ddlSql);
  assert.strictEqual(val.isValid, true, 'Schema should be valid');

  // Test Index Service Recommendations
  const indexService = require('../src/services/indexService');
  const indexResult = indexService.generateIndexRecommendations(schema, 'PostgreSQL');
  assert.ok(indexResult.summary.performanceScore >= 0, 'Performance score should be calculated');
  assert.ok(indexResult.existingIndexes.length > 0, 'Primary key indexes should be detected');
  assert.ok(indexResult.recommendations.some(r => r.category === 'Foreign Key'), 'Foreign key index recommendation should exist');

  // Test Version Service Comparison
  const versionService = require('../src/services/versionService');
  const versionDiff = versionService.compareVersions({ schema }, { schema });
  assert.ok(Array.isArray(versionDiff.addedTables), 'addedTables should be an array');
  assert.strictEqual(versionDiff.addedTables.length, 0, 'No tables should differ for identical snapshots');
});
