const test = require('node:test');
const assert = require('node:assert');
const db = require('../src/config/database');

test('AI Review History Persistence & Query Test', async () => {
  await db.initDb();

  const projectId = Date.now();
  const summary = 'Test AI Review Summary';
  const suggestions = [
    { severity: 'CRITICAL', title: 'Test Critical Issue', description: 'Test desc', suggestion: 'Test fix' },
    { severity: 'WARNING', title: 'Test Warning', description: 'Test warn', suggestion: 'Test fix 2' }
  ];

  // 1. Get initial max review number
  const initialMaxRes = await db.query(
    'SELECT MAX(review_number) as max_rev FROM ai_reviews WHERE project_id = $1',
    [projectId]
  );
  const initialMax = initialMaxRes.rows[0] ? (initialMaxRes.rows[0].max_rev || 0) : 0;
  assert.strictEqual(initialMax, 0, 'Initial max review number should be 0');

  // 2. Insert Review #1
  const review1Number = 1;
  const reviewDataJson1 = JSON.stringify({ summary, suggestions });
  const insert1 = await db.query(
    `INSERT INTO ai_reviews (
      project_id, review_number, summary, total_suggestions, critical_count, warning_count, improvement_count, review_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at`,
    [projectId, review1Number, summary, suggestions.length, 1, 1, 0, reviewDataJson1]
  );
  assert.ok(insert1.rows.length > 0, 'Should return inserted review row');

  // 3. Insert Review #2 (Review Again scenario)
  const review2Number = 2;
  const reviewDataJson2 = JSON.stringify({ summary: 'Second Review', suggestions: [] });
  await db.query(
    `INSERT INTO ai_reviews (
      project_id, review_number, summary, total_suggestions, critical_count, warning_count, improvement_count, review_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at`,
    [projectId, review2Number, 'Second Review', 0, 0, 0, 0, reviewDataJson2]
  );

  // 4. Query history ordered newest -> oldest
  const historyRes = await db.query(
    'SELECT * FROM ai_reviews WHERE project_id = $1 ORDER BY review_number DESC, id DESC',
    [projectId]
  );
  assert.strictEqual(historyRes.rows.length, 2, 'Should return 2 saved reviews');
  assert.strictEqual(historyRes.rows[0].review_number, 2, 'First item in history should be Review #2 (Latest)');
  assert.strictEqual(historyRes.rows[1].review_number, 1, 'Second item in history should be Review #1');

  // 5. Test single review deletion
  const reviewToDeleteId = historyRes.rows[0].id;
  await db.query('DELETE FROM ai_reviews WHERE id = $1', [reviewToDeleteId]);
  const afterDeleteRes = await db.query(
    'SELECT * FROM ai_reviews WHERE project_id = $1 ORDER BY review_number DESC, id DESC',
    [projectId]
  );
  assert.strictEqual(afterDeleteRes.rows.length, 1, 'Should have 1 review remaining after single deletion');

  // 6. Test clear history deletion
  await db.query('DELETE FROM ai_reviews WHERE project_id = $1', [projectId]);
  const afterClearRes = await db.query(
    'SELECT * FROM ai_reviews WHERE project_id = $1 ORDER BY review_number DESC, id DESC',
    [projectId]
  );
  assert.strictEqual(afterClearRes.rows.length, 0, 'Should have 0 reviews after clearing history');
});

test('AI Service modifyDesignWithReview Test', async () => {
  const aiService = require('../src/services/aiService');

  const design = {
    databaseType: 'PostgreSQL',
    entities: [
      {
        name: 'Customer',
        attributes: [
          { name: 'customer_id', type: 'INTEGER', primaryKey: true }
        ]
      },
      {
        name: 'Order',
        attributes: [
          { name: 'order_id', type: 'INTEGER', primaryKey: true },
          { name: 'customer_id', type: 'INTEGER', foreignKey: true }
        ]
      }
    ],
    relationships: [
      { source: 'Customer', target: 'Order', type: 'one-to-many', onDelete: 'CASCADE' }
    ]
  };

  const suggestions = [
    { title: 'Unsafe CASCADE delete on Customer Orders', severity: 'CRITICAL' }
  ];

  const modified = await aiService.modifyDesignWithReview(design, suggestions);
  assert.ok(modified.entities.length >= 2, 'Should preserve/update entities');
  assert.ok(modified.relationships.length >= 1, 'Should preserve/update relationships');

  const orderRel = modified.relationships.find(r => (r.source || r.from) === 'Customer' && (r.target || r.to) === 'Order');
  if (orderRel) {
    assert.strictEqual(orderRel.onDelete, 'RESTRICT', 'CASCADE should be changed to RESTRICT');
  }
});
