const db = require('../config/database');

const createProjectVersion = async (projectId, snapshotData) => {
  const versionRes = await db.query(
    'SELECT MAX(version_number) as max_v FROM project_versions WHERE project_id = $1',
    [projectId]
  );

  const nextVersion = (versionRes.rows[0]?.max_v || 0) + 1;
  const snapshotJson = typeof snapshotData === 'string' ? snapshotData : JSON.stringify(snapshotData);

  const insertRes = await db.query(
    'INSERT INTO project_versions (project_id, version_number, snapshot_json) VALUES ($1, $2, $3) RETURNING id, version_number, created_at',
    [projectId, nextVersion, snapshotJson]
  );

  return insertRes.rows[0];
};

const compareVersions = (v1Snapshot, v2Snapshot) => {
  const diff = {
    addedTables: [],
    removedTables: [],
    modifiedTables: []
  };

  const v1Tables = v1Snapshot.schema?.tables || [];
  const v2Tables = v2Snapshot.schema?.tables || [];

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

      const v1ColMap = new Map(v1T.columns.map((c) => [c.name.toLowerCase(), c]));
      const v2ColMap = new Map(v2T.columns.map((c) => [c.name.toLowerCase(), c]));

      v2T.columns.forEach((c) => {
        if (!v1ColMap.has(c.name.toLowerCase())) {
          addedCols.push(c.name);
        } else {
          const v1C = v1ColMap.get(c.name.toLowerCase());
          if (v1C.dataType !== c.dataType) {
            modifiedCols.push(`${c.name} (${v1C.dataType} -> ${c.dataType})`);
          }
        }
      });

      v1T.columns.forEach((c) => {
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

  return diff;
};

module.exports = {
  createProjectVersion,
  compareVersions
};
