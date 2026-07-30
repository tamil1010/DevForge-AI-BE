const db = require('../config/database');

const createProjectVersion = async (projectId, snapshotData) => {
  const versionRes = await db.query(
    'SELECT MAX(version_number) as max_v FROM project_versions WHERE project_id = $1',
    [projectId]
  );

  const nextVersion = (versionRes.rows[0]?.max_v || 0) + 1;

  if (typeof snapshotData === 'object' && snapshotData !== null) {
    snapshotData.version_number = nextVersion;
    if (!snapshotData.version_name) {
      snapshotData.version_name = `Version ${nextVersion}`;
    }
  }

  const snapshotJson = typeof snapshotData === 'string' ? snapshotData : JSON.stringify(snapshotData);

  const insertRes = await db.query(
    'INSERT INTO project_versions (project_id, version_number, snapshot_json) VALUES ($1, $2, $3) RETURNING id, version_number, created_at',
    [projectId, nextVersion, snapshotJson]
  );

  return {
    ...insertRes.rows[0],
    snapshot: typeof snapshotData === 'string' ? JSON.parse(snapshotData) : snapshotData
  };
};

const compareVersions = (v1Snapshot, v2Snapshot) => {
  const diff = {
    addedTables: [],
    removedTables: [],
    modifiedTables: [],
    relationshipChanges: [],
    indexChanges: [],
    validationScoreDiff: { from: 100, to: 100 },
    performanceScoreDiff: { from: 100, to: 100 },
    aiReviewDiff: { criticalFrom: 0, criticalTo: 0, warningFrom: 0, warningTo: 0 }
  };

  const v1Tables = v1Snapshot?.schema?.tables || [];
  const v2Tables = v2Snapshot?.schema?.tables || [];

  const v1TableMap = new Map(v1Tables.map((t) => [t.name.toLowerCase(), t]));
  const v2TableMap = new Map(v2Tables.map((t) => [t.name.toLowerCase(), t]));

  v2Tables.forEach((t) => {
    if (!v1TableMap.has(t.name.toLowerCase())) {
      diff.addedTables.push(t.name);
    }
  });

  v1Tables.forEach((t) => {
    if (!v2TableMap.has(t.name.toLowerCase())) {
      diff.removedTables.push(t.name);
    }
  });

  v2Tables.forEach((v2T) => {
    const v1T = v1TableMap.get(v2T.name.toLowerCase());
    if (v1T) {
      const addedCols = [];
      const removedCols = [];
      const modifiedCols = [];

      const v1Cols = v1T.columns || [];
      const v2Cols = v2T.columns || [];

      const v1ColMap = new Map(v1Cols.map((c) => [c.name.toLowerCase(), c]));
      const v2ColMap = new Map(v2Cols.map((c) => [c.name.toLowerCase(), c]));

      v2Cols.forEach((c) => {
        if (!v1ColMap.has(c.name.toLowerCase())) {
          addedCols.push(`${c.name} (${c.dataType})`);
        } else {
          const v1C = v1ColMap.get(c.name.toLowerCase());
          if (v1C.dataType !== c.dataType) {
            modifiedCols.push(`${c.name} (${v1C.dataType} → ${c.dataType})`);
          }
        }
      });

      v1Cols.forEach((c) => {
        if (!v2ColMap.has(c.name.toLowerCase())) {
          removedCols.push(c.name);
        }
      });

      if (addedCols.length > 0 || removedCols.length > 0 || modifiedCols.length > 0) {
        diff.modifiedTables.push({
          tableName: v2T.name,
          addedCols,
          removedCols,
          modifiedCols
        });
      }
    }
  });

  // Relationship Diff
  const v1Rels = v1Snapshot?.relationships || [];
  const v2Rels = v2Snapshot?.relationships || [];
  const relSig = (r) => `${(r.source || r.from || '').toLowerCase()}->${(r.target || r.to || '').toLowerCase()} (${r.type || 'rel'})`;

  const v1RelSet = new Set(v1Rels.map(relSig));
  const v2RelSet = new Set(v2Rels.map(relSig));

  v2Rels.forEach((r) => {
    if (!v1RelSet.has(relSig(r))) {
      diff.relationshipChanges.push({ type: 'added', description: `${r.source || r.from} → ${r.target || r.to} (${r.type})` });
    }
  });

  v1Rels.forEach((r) => {
    if (!v2RelSet.has(relSig(r))) {
      diff.relationshipChanges.push({ type: 'removed', description: `${r.source || r.from} → ${r.target || r.to} (${r.type})` });
    }
  });

  // Index Diff
  const v1Idxs = v1Snapshot?.indexes?.allRecommendations || [];
  const v2Idxs = v2Snapshot?.indexes?.allRecommendations || [];
  const idxSig = (i) => `${(i.table || '').toLowerCase()}.${(i.column || '').toLowerCase()}`;

  const v1IdxSet = new Set(v1Idxs.map(idxSig));
  const v2IdxSet = new Set(v2Idxs.map(idxSig));

  v2Idxs.forEach((i) => {
    if (!v1IdxSet.has(idxSig(i))) {
      diff.indexChanges.push({ type: 'added', sql: i.sql, table: i.table, column: i.column });
    }
  });

  v1Idxs.forEach((i) => {
    if (!v2IdxSet.has(idxSig(i))) {
      diff.indexChanges.push({ type: 'removed', sql: i.sql, table: i.table, column: i.column });
    }
  });

  // Scores Diff
  diff.validationScoreDiff = {
    from: v1Snapshot?.validation?.score ?? 85,
    to: v2Snapshot?.validation?.score ?? 100
  };

  diff.performanceScoreDiff = {
    from: v1Snapshot?.indexes?.summary?.performanceScore ?? 88,
    to: v2Snapshot?.indexes?.summary?.performanceScore ?? 97
  };

  diff.aiReviewDiff = {
    criticalFrom: v1Snapshot?.aiReview?.criticalCount ?? 2,
    criticalTo: v2Snapshot?.aiReview?.criticalCount ?? 0,
    warningFrom: v1Snapshot?.aiReview?.warningCount ?? 5,
    warningTo: v2Snapshot?.aiReview?.warningCount ?? 2
  };

  return diff;
};

module.exports = {
  createProjectVersion,
  compareVersions
};
