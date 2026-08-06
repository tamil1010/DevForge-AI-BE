/**
 * B-Tree & Composite Index Recommendation Engine
 * Analyzes generated database schema to recommend optimal indexes.
 */

const generateIndexRecommendations = (schema, dialect = 'PostgreSQL', savedApplied = [], savedIgnored = [], aiSuggestions = []) => {
  const recommendations = [];
  const existingIndexes = [];
  
  if (!schema || !schema.tables || !Array.isArray(schema.tables)) {
    return {
      recommendations: [],
      existingIndexes: [],
      allRecommendations: [],
      summary: {
        totalTables: 0,
        existingIndexes: 0,
        recommendedIndexes: 0,
        performanceScore: 100,
        scoreLabel: 'Excellent',
        breakdown: { pk: 100, fk: 100, search: 100, composite: 100 }
      }
    };
  }

  const dialectLower = (dialect || 'postgresql').toLowerCase();
  const isPg = dialectLower.includes('postgres');
  const isMysql = dialectLower.includes('mysql');

  const appliedSet = new Set(savedApplied || []);
  const ignoredSet = new Set(savedIgnored || []);

  let totalPkCount = 0;
  let indexedPkCount = 0;

  let totalFkCount = 0;
  let indexedFkCount = 0;

  let totalSearchCount = 0;
  let indexedSearchCount = 0;

  let totalCompositeCount = 0;
  let indexedCompositeCount = 0;

  schema.tables.forEach((table) => {
    const tableName = table.name;
    const lowerTable = tableName.toLowerCase();
    const columns = table.columns || [];

    const pkCols = columns.filter((c) => c.isPrimaryKey);
    const fkCols = columns.filter((c) => c.isForeignKey);
    const uniqueCols = columns.filter((c) => c.isUnique && !c.isPrimaryKey);

    // ----------------------------------------------------
    // 1. PRIMARY KEY INDEXES
    // ----------------------------------------------------
    pkCols.forEach((col) => {
      totalPkCount++;
      indexedPkCount++;
      const lowerCol = col.name.toLowerCase();
      const recId = `pk_${lowerTable}_${lowerCol}`;
      
      const item = {
        id: recId,
        table: tableName,
        column: col.name,
        category: 'Primary Key',
        indexType: 'PRIMARY KEY Index',
        priority: 'HIGH',
        estimatedBenefit: 'High',
        reason: 'Automatically indexed by database engine to guarantee row identity and O(1) B-Tree primary key lookups.',
        sql: `PRIMARY KEY (${col.name})`,
        status: 'Already Indexed',
        isExisting: true
      };
      existingIndexes.push(item);
      recommendations.push(item);
    });

    // ----------------------------------------------------
    // 2. UNIQUE INDEXES
    // ----------------------------------------------------
    uniqueCols.forEach((col) => {
      const lowerCol = col.name.toLowerCase();
      const recId = `uq_${lowerTable}_${lowerCol}`;

      const item = {
        id: recId,
        table: tableName,
        column: col.name,
        category: 'Unique',
        indexType: 'B-Tree Unique Index',
        priority: 'HIGH',
        estimatedBenefit: 'High',
        reason: 'Automatically created by UNIQUE constraint to guarantee column data integrity and fast duplicate checks.',
        sql: `CREATE UNIQUE INDEX uq_${lowerTable}_${lowerCol} ON ${tableName}(${col.name});`,
        status: 'Already Optimized',
        isExisting: true
      };
      existingIndexes.push(item);
      recommendations.push(item);
    });

    // ----------------------------------------------------
    // 3. FOREIGN KEY INDEXES
    // ----------------------------------------------------
    fkCols.forEach((col) => {
      totalFkCount++;
      const lowerCol = col.name.toLowerCase();
      const recId = `fk_${lowerTable}_${lowerCol}`;
      const refTable = col.references?.table || 'parent';
      const sqlStr = `CREATE INDEX idx_${lowerTable}_${lowerCol} ON ${tableName}(${col.name});`;

      const isApplied = appliedSet.has(recId) || appliedSet.has(sqlStr);
      const isIgnored = ignoredSet.has(recId) || ignoredSet.has(sqlStr);

      if (isApplied) indexedFkCount++;

      const item = {
        id: recId,
        table: tableName,
        column: col.name,
        category: 'Foreign Key',
        indexType: 'B-Tree Foreign Key Index',
        priority: 'HIGH',
        estimatedBenefit: 'High',
        reason: `Frequently used JOIN column with ${refTable} table. Accelerates JOIN query performance and child table delete cascades.`,
        sql: sqlStr,
        status: isApplied ? 'Applied' : isIgnored ? 'Ignored' : 'Recommended',
        isExisting: false
      };
      recommendations.push(item);
    });

    // ----------------------------------------------------
    // 4. SEARCH & LOOKUP INDEXES
    // ----------------------------------------------------
    columns.forEach((col) => {
      if (col.isPrimaryKey || col.isUnique) return; // Already covered by PK or UNIQUE

      const lowerCol = col.name.toLowerCase();
      let isSearchTarget = false;
      let priority = 'MEDIUM';
      let benefit = 'High';
      let reason = 'Frequently searched field in WHERE clauses and query filters.';

      // High-cardinality search targets
      if (
        lowerCol.includes('email') ||
        lowerCol.includes('username') ||
        lowerCol.includes('phone') ||
        lowerCol.includes('code') ||
        lowerCol.includes('slug') ||
        lowerCol.includes('sku') ||
        lowerCol.includes('uuid') ||
        lowerCol.includes('token') ||
        lowerCol.includes('account_number')
      ) {
        isSearchTarget = true;
        priority = 'HIGH';
        benefit = 'High';
        reason = `High-cardinality search field frequently used for exact-match lookups.`;
      }
      // Status & filter targets
      else if (
        lowerCol.includes('status') ||
        lowerCol.includes('type') ||
        lowerCol.includes('category') ||
        lowerCol.includes('state') ||
        lowerCol.includes('country') ||
        lowerCol.includes('is_active') ||
        lowerCol.includes('role') ||
        lowerCol.includes('stage')
      ) {
        isSearchTarget = true;
        priority = 'MEDIUM';
        benefit = 'High';
        reason = `Low-to-medium cardinality filter column frequently used in dashboard query filters.`;
      }
      // Date filtering & sorting targets
      else if (
        lowerCol.includes('created_at') ||
        lowerCol.includes('updated_at') ||
        lowerCol.includes('timestamp') ||
        lowerCol.includes('date') ||
        lowerCol.includes('due_date') ||
        lowerCol.includes('published_at')
      ) {
        isSearchTarget = true;
        priority = 'MEDIUM';
        benefit = 'Medium';
        reason = `Date field frequently used in range filtering and ORDER BY query sorting.`;
      }
      // General name lookups
      else if (
        lowerCol.includes('first_name') ||
        lowerCol.includes('last_name') ||
        lowerCol.includes('full_name') ||
        lowerCol.includes('title')
      ) {
        isSearchTarget = true;
        priority = 'LOW';
        benefit = 'Medium';
        reason = `Text field frequently queried in user search bars and pattern matching.`;
      }

      if (isSearchTarget) {
        totalSearchCount++;
        const recId = `search_${lowerTable}_${lowerCol}`;
        const sqlStr = `CREATE INDEX idx_${lowerTable}_${lowerCol} ON ${tableName}(${col.name});`;

        const isApplied = appliedSet.has(recId) || appliedSet.has(sqlStr);
        const isIgnored = ignoredSet.has(recId) || ignoredSet.has(sqlStr);

        if (isApplied) indexedSearchCount++;

        recommendations.push({
          id: recId,
          table: tableName,
          column: col.name,
          category: 'Search',
          indexType: 'B-Tree Search Index',
          priority,
          estimatedBenefit: benefit,
          reason,
          sql: sqlStr,
          status: isApplied ? 'Applied' : isIgnored ? 'Ignored' : 'Recommended',
          isExisting: false
        });
      }
    });

    // ----------------------------------------------------
    // 5. COMPOSITE INDEXES
    // ----------------------------------------------------
    // Check FK + Date Combination (e.g. customer_id + order_date, doctor_id + appointment_date)
    const dateCol = columns.find(
      (c) =>
        c.name.toLowerCase().includes('date') ||
        c.name.toLowerCase().includes('created_at') ||
        c.name.toLowerCase().includes('timestamp')
    );
    const statusCol = columns.find((c) => c.name.toLowerCase().includes('status'));

    fkCols.forEach((fk) => {
      if (dateCol && dateCol.name !== fk.name) {
        totalCompositeCount++;
        const fkName = fk.name;
        const dateName = dateCol.name;
        const recId = `composite_${lowerTable}_${fkName.toLowerCase()}_${dateName.toLowerCase()}`;
        const sqlStr = `CREATE INDEX idx_${lowerTable}_${fkName.toLowerCase()}_${dateName.toLowerCase()} ON ${tableName}(${fkName}, ${dateName});`;

        const isApplied = appliedSet.has(recId) || appliedSet.has(sqlStr);
        const isIgnored = ignoredSet.has(recId) || ignoredSet.has(sqlStr);

        if (isApplied) indexedCompositeCount++;

        recommendations.push({
          id: recId,
          table: tableName,
          column: `${fkName}, ${dateName}`,
          columnsList: [fkName, dateName],
          category: 'Composite',
          indexType: 'Composite B-Tree Index',
          priority: 'HIGH',
          estimatedBenefit: 'High',
          reason: `High query speedup for queries filtering by ${fkName} and sorting/filtering by ${dateName}.`,
          sql: sqlStr,
          status: isApplied ? 'Applied' : isIgnored ? 'Ignored' : 'Recommended',
          isExisting: false
        });
      } else if (statusCol && statusCol.name !== fk.name) {
        totalCompositeCount++;
        const fkName = fk.name;
        const statusName = statusCol.name;
        const recId = `composite_${lowerTable}_${fkName.toLowerCase()}_${statusName.toLowerCase()}`;
        const sqlStr = `CREATE INDEX idx_${lowerTable}_${fkName.toLowerCase()}_${statusName.toLowerCase()} ON ${tableName}(${fkName}, ${statusName});`;

        const isApplied = appliedSet.has(recId) || appliedSet.has(sqlStr);
        const isIgnored = ignoredSet.has(recId) || ignoredSet.has(sqlStr);

        if (isApplied) indexedCompositeCount++;

        recommendations.push({
          id: recId,
          table: tableName,
          column: `${fkName}, ${statusName}`,
          columnsList: [fkName, statusName],
          category: 'Composite',
          indexType: 'Composite B-Tree Index',
          priority: 'MEDIUM',
          estimatedBenefit: 'High',
          reason: `Optimizes filtered list queries filtering by ${fkName} and current ${statusName}.`,
          sql: sqlStr,
          status: isApplied ? 'Applied' : isIgnored ? 'Ignored' : 'Recommended',
          isExisting: false
        });
      }
    });

    // Check full name composite lookup (first_name + last_name)
    const firstName = columns.find((c) => c.name.toLowerCase() === 'first_name');
    const lastName = columns.find((c) => c.name.toLowerCase() === 'last_name');
    if (firstName && lastName) {
      totalCompositeCount++;
      const recId = `composite_${lowerTable}_name_lookup`;
      const sqlStr = `CREATE INDEX idx_${lowerTable}_full_name ON ${tableName}(${firstName.name}, ${lastName.name});`;

      const isApplied = appliedSet.has(recId) || appliedSet.has(sqlStr);
      const isIgnored = ignoredSet.has(recId) || ignoredSet.has(sqlStr);

      if (isApplied) indexedCompositeCount++;

      recommendations.push({
        id: recId,
        table: tableName,
        column: `${firstName.name}, ${lastName.name}`,
        columnsList: [firstName.name, lastName.name],
        category: 'Composite',
        indexType: 'Composite B-Tree Index',
        priority: 'MEDIUM',
        estimatedBenefit: 'Medium',
        reason: `Speeds up person full-name search queries combining ${firstName.name} and ${lastName.name}.`,
        sql: sqlStr,
        status: isApplied ? 'Applied' : isIgnored ? 'Ignored' : 'Recommended',
        isExisting: false
      });
    }

    // ----------------------------------------------------
    // 6. FULL TEXT SEARCH INDEXES
    // ----------------------------------------------------
    columns.forEach((col) => {
      const typeStr = (col.dataType || '').toUpperCase();
      const lowerCol = col.name.toLowerCase();

      const isTextType = typeStr.includes('TEXT') || typeStr.includes('CLOB') || typeStr.includes('VARCHAR(500)') || typeStr.includes('VARCHAR(1000)');
      const isTextName =
        lowerCol.includes('description') ||
        lowerCol.includes('content') ||
        lowerCol.includes('notes') ||
        lowerCol.includes('bio') ||
        lowerCol.includes('details') ||
        lowerCol.includes('summary') ||
        lowerCol.includes('body') ||
        lowerCol.includes('remarks');

      if (isTextType || isTextName) {
        const recId = `fts_${lowerTable}_${lowerCol}`;
        let sqlStr = `CREATE INDEX idx_${lowerTable}_${lowerCol}_fts ON ${tableName}(${col.name});`;
        if (isPg) {
          sqlStr = `CREATE INDEX idx_${lowerTable}_${lowerCol}_fts ON ${tableName} USING gin(to_tsvector('english', ${col.name}));`;
        } else if (isMysql) {
          sqlStr = `CREATE FULLTEXT INDEX idx_${lowerTable}_${lowerCol}_fts ON ${tableName}(${col.name});`;
        }

        const isApplied = appliedSet.has(recId) || appliedSet.has(sqlStr);
        const isIgnored = ignoredSet.has(recId) || ignoredSet.has(sqlStr);

        recommendations.push({
          id: recId,
          table: tableName,
          column: col.name,
          category: 'Full Text',
          indexType: isPg ? 'GIN Full Text Index' : isMysql ? 'FULLTEXT Index' : 'Text Search Index',
          priority: 'LOW',
          estimatedBenefit: 'Medium',
          reason: `Long text field candidate for natural language full-text search indexing.`,
          sql: sqlStr,
          status: isApplied ? 'Applied' : isIgnored ? 'Ignored' : 'Recommended',
          isExisting: false
        });
      }
    });
  });

  // ----------------------------------------------------
  // Merge AI Suggestions if provided
  // ----------------------------------------------------
  if (Array.isArray(aiSuggestions)) {
    aiSuggestions.forEach((aiItem, i) => {
      const recId = aiItem.id || `ai_rec_${i}`;
      const sqlStr = aiItem.sql || `CREATE INDEX idx_${(aiItem.table || 'table').toLowerCase()}_ai ON ${aiItem.table || 'table'}(${Array.isArray(aiItem.columns) ? aiItem.columns.join(', ') : aiItem.column || 'col'});`;
      const isApplied = appliedSet.has(recId) || appliedSet.has(sqlStr);
      const isIgnored = ignoredSet.has(recId) || ignoredSet.has(sqlStr);

      recommendations.push({
        id: recId,
        table: aiItem.table || 'Unknown',
        column: Array.isArray(aiItem.columns) ? aiItem.columns.join(', ') : aiItem.column || 'AI Col',
        category: 'AI Suggested',
        indexType: 'AI Workload Suggestion',
        priority: aiItem.priority || 'HIGH',
        estimatedBenefit: aiItem.estimatedBenefit || 'High',
        reason: aiItem.reason || 'Groq AI predicted high-volume query join or filter workload.',
        sql: sqlStr,
        status: isApplied ? 'Applied' : isIgnored ? 'Ignored' : 'Recommended',
        isExisting: false,
        isAiSuggested: true
      });
    });
  }

  // ----------------------------------------------------
  // Calculate Performance Score (0 - 100)
  // ----------------------------------------------------
  const pkCoverage = totalPkCount > 0 ? (indexedPkCount / totalPkCount) * 100 : 100;
  const fkCoverage = totalFkCount > 0 ? ((indexedFkCount + recommendations.filter(r => r.category === 'Foreign Key' && r.status === 'Applied').length) / totalFkCount) * 100 : 100;
  const searchCoverage = totalSearchCount > 0 ? ((indexedSearchCount + recommendations.filter(r => r.category === 'Search' && r.status === 'Applied').length) / totalSearchCount) * 100 : 100;
  const compositeCoverage = totalCompositeCount > 0 ? ((indexedCompositeCount + recommendations.filter(r => r.category === 'Composite' && r.status === 'Applied').length) / totalCompositeCount) * 100 : 100;

  const pendingCount = recommendations.filter(r => !r.isExisting && r.status === 'Recommended').length;
  const appliedCount = recommendations.filter(r => r.status === 'Applied' || r.isExisting).length;

  let rawScore = Math.round(
    pkCoverage * 0.25 +
    fkCoverage * 0.35 +
    searchCoverage * 0.25 +
    compositeCoverage * 0.15
  );

  if (pendingCount > 0) {
    const penalty = Math.min(25, pendingCount * 4);
    rawScore = Math.max(50, 100 - penalty);
  } else {
    rawScore = 98; // Fully optimized
  }

  let scoreLabel = 'Excellent';
  if (rawScore >= 90) scoreLabel = 'Excellent';
  else if (rawScore >= 75) scoreLabel = 'Good';
  else if (rawScore >= 60) scoreLabel = 'Needs Attention';
  else scoreLabel = 'Suboptimal';

  return {
    recommendations: recommendations.filter(r => !r.isExisting),
    existingIndexes,
    allRecommendations: recommendations,
    summary: {
      totalTables: schema.tables.length,
      existingIndexes: appliedCount,
      recommendedIndexes: pendingCount,
      performanceScore: rawScore,
      scoreLabel,
      breakdown: {
        pk: Math.round(pkCoverage),
        fk: Math.round(fkCoverage),
        search: Math.round(searchCoverage),
        composite: Math.round(compositeCoverage)
      }
    }
  };
};

module.exports = {
  generateIndexRecommendations
};
