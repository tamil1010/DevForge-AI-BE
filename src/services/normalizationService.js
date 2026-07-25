const analyzeNormalization = (schema) => {
  const results = {
    nf1: { status: 'Passed', issues: [] },
    nf2: { status: 'Passed', issues: [] },
    nf3: { status: 'Passed', issues: [] },
    overallScore: 100
  };

  if (!schema || !schema.tables || schema.tables.length === 0) {
    return {
      nf1: { status: 'Failed', issues: ['No tables detected in schema.'] },
      nf2: { status: 'Failed', issues: ['Requires 1NF compliance first.'] },
      nf3: { status: 'Failed', issues: ['Requires 2NF compliance first.'] },
      overallScore: 0
    };
  }

  schema.tables.forEach((table) => {
    const pkCols = table.columns.filter((c) => c.isPrimaryKey);
    if (pkCols.length === 0) {
      results.nf1.status = 'Warning';
      results.nf1.issues.push({
        normalForm: '1NF',
        table: table.name,
        problem: 'Missing Primary Key',
        explanation: '1NF requires every table to have a unique primary key identifier.',
        suggestedImprovement: `Define a primary key column (e.g., ${table.name.toLowerCase()}_id INTEGER PRIMARY KEY) on table '${table.name}'.`
      });
      results.overallScore -= 15;
    }

    if (pkCols.length > 1) {
      const nonPkCols = table.columns.filter((c) => !c.isPrimaryKey);
      nonPkCols.forEach((col) => {
        if (!col.isForeignKey && !col.name.includes('quantity') && !col.name.includes('price') && !col.name.includes('amount')) {
          results.nf2.status = 'Warning';
          results.nf2.issues.push({
            normalForm: '2NF',
            table: table.name,
            problem: `Potential partial dependency on composite key column '${col.name}'`,
            explanation: 'In tables with composite keys, all non-key attributes must depend on the complete primary key.',
            suggestedImprovement: `Verify if '${col.name}' depends on only one part of composite key (${pkCols.map(p => p.name).join(', ')}).`
          });
          results.overallScore -= 10;
        }
      });
    }

    table.columns.forEach((col) => {
      if (table.name.toLowerCase() === 'order' || table.name.toLowerCase() === 'orders') {
        if (col.name.toLowerCase().includes('customer_name') || col.name.toLowerCase().includes('customer_email')) {
          results.nf3.status = 'Warning';
          results.nf3.issues.push({
            normalForm: '3NF',
            table: table.name,
            problem: `Transitive dependency detected in '${col.name}'`,
            explanation: `'${col.name}' depends on customer_id foreign key, not directly on order_id.`,
            suggestedImprovement: `Remove '${col.name}' from '${table.name}'. Access customer attributes via JOIN query.`
          });
          results.overallScore -= 15;
        }
      }
    });
  });

  results.overallScore = Math.max(0, results.overallScore);
  return results;
};

module.exports = {
  analyzeNormalization
};
