const generateSqlScript = (schema, dialect = 'PostgreSQL') => {
  if (!schema || !schema.tables || schema.tables.length === 0) {
    return { ddlSql: '-- No tables to generate', sampleDataSql: '-- No sample data' };
  }

  const dialectNormalized = dialect.toLowerCase();
  const sortedTables = sortTablesByDependency(schema.tables);

  let ddlStatements = [];
  ddlStatements.push(`-- ==================================================\n-- DevForge AI Generated DDL Script\n-- Target Dialect: ${dialect}\n-- Generated: ${new Date().toISOString()}\n-- ==================================================\n`);

  sortedTables.forEach((table) => {
    const tableDdl = generateTableDdl(table, dialectNormalized);
    ddlStatements.push(tableDdl);
  });

  const ddlSql = ddlStatements.join('\n\n');
  const sampleDataSql = generateSampleDataDml(sortedTables, dialectNormalized);

  return {
    ddlSql,
    sampleDataSql
  };
};

const sortTablesByDependency = (tables) => {
  const tableMap = new Map();
  tables.forEach((t) => tableMap.set(t.name.toLowerCase(), t));

  const visited = new Set();
  const sorted = [];

  const visit = (tName) => {
    const tNameLower = tName.toLowerCase();
    if (visited.has(tNameLower)) return;
    visited.add(tNameLower);

    const table = tableMap.get(tNameLower);
    if (table) {
      table.columns.forEach((col) => {
        if (col.isForeignKey && col.references && col.references.table) {
          const parentName = col.references.table.toLowerCase();
          if (parentName !== tNameLower && tableMap.has(parentName)) {
            visit(parentName);
          }
        }
      });
      sorted.push(table);
    }
  };

  tables.forEach((t) => visit(t.name));
  return sorted;
};

const generateTableDdl = (table, dialect) => {
  const lines = [];
  const pkCols = table.columns.filter((c) => c.isPrimaryKey);
  const fkCols = table.columns.filter((c) => c.isForeignKey && c.references);

  const tableNameFormatted = formatIdentifier(table.name, dialect);

  lines.push(`CREATE TABLE IF NOT EXISTS ${tableNameFormatted} (`);

  const colDefinitions = table.columns.map((col) => {
    let def = `  ${formatIdentifier(col.name, dialect)} ${mapDataType(col, dialect)}`;

    if (dialect === 'mysql' && col.isAutoIncrement && col.isPrimaryKey) {
      def += ' AUTO_INCREMENT';
    } else if (dialect === 'sqlite' && col.isAutoIncrement && col.isPrimaryKey && pkCols.length === 1) {
      def += ' PRIMARY KEY AUTOINCREMENT';
    }

    if (!col.isNullable && !col.isPrimaryKey) {
      def += ' NOT NULL';
    }

    if (col.isUnique && pkCols.length === 1 && !col.isPrimaryKey) {
      def += ' UNIQUE';
    }

    if (col.defaultValue !== null && col.defaultValue !== undefined && col.defaultValue !== '') {
      def += ` DEFAULT ${col.defaultValue}`;
    }

    return def;
  });

  if (pkCols.length > 0 && !(dialect === 'sqlite' && pkCols.length === 1 && pkCols[0].isAutoIncrement)) {
    const pkNames = pkCols.map((c) => formatIdentifier(c.name, dialect)).join(', ');
    colDefinitions.push(`  PRIMARY KEY (${pkNames})`);
  }

  fkCols.forEach((col) => {
    const refTable = formatIdentifier(col.references.table, dialect);
    const refCol = formatIdentifier(col.references.column, dialect);
    const onDelete = col.references.onDelete || 'CASCADE';
    const onUpdate = col.references.onUpdate || 'CASCADE';
    const fkColName = formatIdentifier(col.name, dialect);

    colDefinitions.push(
      `  FOREIGN KEY (${fkColName}) REFERENCES ${refTable}(${refCol}) ON DELETE ${onDelete} ON UPDATE ${onUpdate}`
    );
  });

  lines.push(colDefinitions.join(',\n'));
  lines.push(');');

  return lines.join('\n');
};

const mapDataType = (col, dialect) => {
  const typeUpper = col.dataType.toUpperCase();

  if (dialect === 'postgresql') {
    if (col.isAutoIncrement && col.isPrimaryKey) {
      return typeUpper.includes('BIGINT') ? 'BIGSERIAL' : 'SERIAL';
    }
    if (typeUpper === 'DATETIME') return 'TIMESTAMP';
    if (typeUpper === 'DOUBLE') return 'DOUBLE PRECISION';
    return typeUpper;
  }

  if (dialect === 'mysql') {
    if (typeUpper === 'TIMESTAMP') return 'DATETIME';
    return typeUpper;
  }

  if (dialect === 'sqlite') {
    if (typeUpper.includes('INT')) return 'INTEGER';
    if (typeUpper.includes('VARCHAR') || typeUpper.includes('TEXT')) return 'TEXT';
    if (typeUpper.includes('BOOL')) return 'INTEGER';
    if (typeUpper.includes('TIMESTAMP') || typeUpper.includes('DATE')) return 'TEXT';
    if (typeUpper.includes('DECIMAL') || typeUpper.includes('FLOAT') || typeUpper.includes('DOUBLE')) return 'REAL';
    return 'TEXT';
  }

  return typeUpper;
};

const formatIdentifier = (name, dialect) => {
  const clean = name.replace(/[^a-zA-Z0-9_]/g, '');
  if (dialect === 'mysql') return `\`${clean}\``;
  if (dialect === 'postgresql') return `"${clean.toLowerCase()}"`;
  return `"${clean}"`;
};

const generateSampleDataDml = (tables, dialect) => {
  const dmlStatements = [];
  dmlStatements.push(`-- ==================================================\n-- DevForge AI Sample DML Insert Script\n-- Target Dialect: ${dialect}\n-- ==================================================\n`);

  tables.forEach((table) => {
    const insertCols = table.columns.filter((c) => !c.isAutoIncrement || dialect === 'sqlite');
    if (insertCols.length === 0) return;

    const colNames = insertCols.map((c) => formatIdentifier(c.name, dialect)).join(', ');
    const tableName = formatIdentifier(table.name, dialect);

    const rows = [1, 2, 3].map((idx) => {
      const values = insertCols.map((col) => {
        const type = col.dataType.toUpperCase();
        if (col.isForeignKey) return idx;
        if (col.isPrimaryKey && (type.includes('INT') || dialect === 'sqlite')) return idx;
        if (type.includes('INT')) return idx * 10;
        if (type.includes('DECIMAL') || type.includes('FLOAT') || type.includes('DOUBLE')) return `${(idx * 29.99).toFixed(2)}`;
        if (type.includes('BOOL')) return idx % 2 === 1 ? (dialect === 'sqlite' ? 1 : 'TRUE') : (dialect === 'sqlite' ? 0 : 'FALSE');
        if (type.includes('DATE') || type.includes('TIMESTAMP')) return `'2026-07-25 10:00:0${idx}'`;
        return `'${table.name}_Sample_${idx}'`;
      });
      return `(${values.join(', ')})`;
    });

    dmlStatements.push(`INSERT INTO ${tableName} (${colNames})\nVALUES\n  ${rows.join(',\n  ')};`);
  });

  return dmlStatements.join('\n\n');
};

module.exports = {
  generateSqlScript,
  sortTablesByDependency
};
