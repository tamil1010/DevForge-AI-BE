const generateIndexRecommendations = (schema, dialect = 'PostgreSQL') => {
  const recommendations = [];

  if (!schema || !schema.tables) return recommendations;

  schema.tables.forEach((table) => {
    const tableName = table.name;
    const lowerTable = tableName.toLowerCase();

    table.columns.forEach((col) => {
      const lowerCol = col.name.toLowerCase();

      if (col.isForeignKey) {
        recommendations.push({
          table: tableName,
          column: col.name,
          indexType: 'B-Tree Foreign Key Index',
          reason: 'Accelerates JOIN query execution speed and parent-child delete cascades.',
          sql: `CREATE INDEX idx_${lowerTable}_${lowerCol}_fk ON ${lowerTable}(${lowerCol});`
        });
      }

      if (!col.isPrimaryKey && !col.isForeignKey) {
        if (lowerCol.includes('email') || lowerCol.includes('status') || lowerCol.includes('code') || lowerCol.includes('slug')) {
          recommendations.push({
            table: tableName,
            column: col.name,
            indexType: 'B-Tree Search Index',
            reason: 'High-cardinality search or filter column frequently queried in WHERE clauses.',
            sql: `CREATE INDEX idx_${lowerTable}_${lowerCol} ON ${lowerTable}(${lowerCol});`
          });
        }
      }
    });
  });

  return recommendations;
};

module.exports = {
  generateIndexRecommendations
};
