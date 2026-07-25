const validateSchemaAndSql = (schema, ddlSql = '') => {
  let score = 100;
  const issues = [];

  const breakdown = {
    schemaStructure: 100,
    primaryKeys: 100,
    foreignKeys: 100,
    relationships: 100,
    constraints: 100,
    normalization: 100,
    sqlCompatibility: 100
  };

  if (!schema || !schema.tables || schema.tables.length === 0) {
    return {
      score: 0,
      isValid: false,
      breakdown: {
        schemaStructure: 0, primaryKeys: 0, foreignKeys: 0, relationships: 0, constraints: 0, normalization: 0, sqlCompatibility: 0
      },
      issues: [
        {
          id: 'err_no_tables',
          severity: 'ERRORS',
          type: 'ERROR',
          title: 'Empty Database Schema',
          location: 'Schema',
          problem: 'The current database project does not contain any tables.',
          whyItMatters: 'A relational database requires at least one table structure to exist.',
          suggestedFix: 'Add entities and generate the relational schema.'
        }
      ]
    };
  }

  const tableNames = new Set(schema.tables.map((t) => t.name.toLowerCase()));
  const tableMap = new Map();
  schema.tables.forEach((t) => tableMap.set(t.name.toLowerCase(), t));

  const seenTables = new Set();
  schema.tables.forEach((t) => {
    const lower = t.name.toLowerCase();
    if (seenTables.has(lower)) {
      score -= 25;
      breakdown.schemaStructure -= 30;
      issues.push({
        id: `err_dup_table_${lower}`,
        severity: 'ERRORS',
        type: 'ERROR',
        title: `Duplicate Table Name: '${t.name}'`,
        location: `Table: ${t.name}`,
        problem: 'Multiple tables share the exact same case-insensitive identifier.',
        whyItMatters: 'SQL DDL commands will fail when creating duplicate tables.',
        suggestedFix: `Rename or delete duplicate table '${t.name}'.`
      });
    }
    seenTables.add(lower);
  });

  schema.tables.forEach((table) => {
    const pkCols = table.columns.filter((c) => c.isPrimaryKey);
    if (pkCols.length === 0) {
      score -= 15;
      breakdown.primaryKeys -= 25;
      issues.push({
        id: `err_no_pk_${table.name}`,
        severity: 'ERRORS',
        type: 'ERROR',
        title: `Missing Primary Key on '${table.name}'`,
        location: `Table: ${table.name}`,
        problem: 'Every relational database table must have at least one Primary Key to uniquely identify rows.',
        whyItMatters: 'Without a primary key, rows cannot be reliably referenced or joined.',
        suggestedFix: `Add a primary key column '${table.name.toLowerCase()}_id' (INTEGER PRIMARY KEY AUTO_INCREMENT).`
      });
    }

    const colNames = new Set();
    table.columns.forEach((col) => {
      const cLower = col.name.toLowerCase();
      if (colNames.has(cLower)) {
        score -= 20;
        breakdown.schemaStructure -= 20;
        issues.push({
          id: `err_dup_col_${table.name}_${cLower}`,
          severity: 'ERRORS',
          type: 'ERROR',
          title: `Duplicate Column '${col.name}' in Table '${table.name}'`,
          location: `Table: ${table.name}, Column: ${col.name}`,
          problem: 'Columns within the same table must have unique names.',
          whyItMatters: 'SQL queries cannot distinguish between duplicate column names.',
          suggestedFix: `Rename column '${col.name}' in table '${table.name}'.`
        });
      }
      colNames.add(cLower);
    });

    table.columns.forEach((col) => {
      if (col.isForeignKey && col.references) {
        const refTableName = col.references.table.toLowerCase();
        const refColName = col.references.column.toLowerCase();

        if (!tableNames.has(refTableName)) {
          score -= 25;
          breakdown.foreignKeys -= 30;
          issues.push({
            id: `err_broken_fk_tbl_${table.name}_${col.name}`,
            severity: 'ERRORS',
            type: 'ERROR',
            title: `Broken Foreign Key Reference in '${table.name}.${col.name}'`,
            location: `Table: ${table.name}, Column: ${col.name}`,
            problem: `Foreign key '${col.name}' references non-existent table '${col.references.table}'.`,
            whyItMatters: 'Database engines reject foreign keys targeting missing tables.',
            suggestedFix: `Ensure referenced table '${col.references.table}' exists in the workspace schema.`
          });
        } else {
          const refTable = tableMap.get(refTableName);
          const refCol = refTable.columns.find((c) => c.name.toLowerCase() === refColName);

          if (!refCol) {
            score -= 20;
            breakdown.foreignKeys -= 20;
            issues.push({
              id: `err_broken_fk_col_${table.name}_${col.name}`,
              severity: 'ERRORS',
              type: 'ERROR',
              title: `Missing Referenced Column in '${col.references.table}'`,
              location: `Table: ${table.name}, Column: ${col.name}`,
              problem: `Foreign key '${col.name}' references column '${col.references.column}' which does not exist in table '${col.references.table}'.`,
              whyItMatters: 'Foreign key constraints must target a valid existing column.',
              suggestedFix: `Update foreign key reference to target a valid existing column (e.g., '${refTable.columns[0]?.name}').`
            });
          } else if (col.dataType.toUpperCase() !== refCol.dataType.toUpperCase()) {
            score -= 10;
            breakdown.foreignKeys -= 10;
            issues.push({
              id: `warn_fk_type_mismatch_${table.name}_${col.name}`,
              severity: 'WARNINGS',
              type: 'WARNING',
              title: `Incompatible Foreign Key Datatype`,
              location: `Table: ${table.name}, Column: ${col.name}`,
              problem: `Foreign key '${col.name}' (${col.dataType}) does not match referenced column '${refTable.name}.${refCol.name}' (${refCol.dataType}).`,
              whyItMatters: 'Mismatched foreign key data types cause foreign key creation failures or index degradation.',
              suggestedFix: `Align datatype of '${col.name}' to match target column '${refCol.dataType}'.`
            });
          }
        }
      }
    });

    if (/[A-Z]/.test(table.name)) {
      score -= 2;
      breakdown.sqlCompatibility -= 5;
      issues.push({
        id: `sug_tbl_naming_${table.name}`,
        severity: 'SUGGESTIONS',
        type: 'SUGGESTION',
        title: `PascalCase Table Name '${table.name}'`,
        location: `Table: ${table.name}`,
        problem: 'Standard SQL naming conventions recommend snake_case lower case table names.',
        whyItMatters: 'Mixed case table names can cause case-sensitivity issues across PostgreSQL and MySQL on Linux.',
        suggestedFix: `Rename table to '${table.name.toLowerCase()}'.`
      });
    }
  });

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    isValid: score >= 70 && !issues.some((i) => i.severity === 'ERRORS'),
    breakdown: {
      schemaStructure: Math.max(0, breakdown.schemaStructure),
      primaryKeys: Math.max(0, breakdown.primaryKeys),
      foreignKeys: Math.max(0, breakdown.foreignKeys),
      relationships: Math.max(0, breakdown.relationships),
      constraints: Math.max(0, breakdown.constraints),
      normalization: Math.max(0, breakdown.normalization),
      sqlCompatibility: Math.max(0, breakdown.sqlCompatibility)
    },
    issues
  };
};

const applySafeAutoFix = (schema, issues) => {
  const fixedSchema = JSON.parse(JSON.stringify(schema));

  issues.forEach((issue) => {
    if (issue.id.startsWith('warn_fk_type_mismatch_')) {
      const match = issue.location.match(/Table: (\w+), Column: (\w+)/);
      if (match) {
        const [, tblName, colName] = match;
        const table = fixedSchema.tables.find((t) => t.name.toLowerCase() === tblName.toLowerCase());
        if (table) {
          const col = table.columns.find((c) => c.name.toLowerCase() === colName.toLowerCase());
          if (col && col.references) {
            const refTbl = fixedSchema.tables.find((t) => t.name.toLowerCase() === col.references.table.toLowerCase());
            if (refTbl) {
              const refCol = refTbl.columns.find((c) => c.name.toLowerCase() === col.references.column.toLowerCase());
              if (refCol) {
                col.dataType = refCol.dataType;
              }
            }
          }
        }
      }
    } else if (issue.id.startsWith('err_no_pk_')) {
      const match = issue.location.match(/Table: (\w+)/);
      if (match) {
        const [, tblName] = match;
        const table = fixedSchema.tables.find((t) => t.name.toLowerCase() === tblName.toLowerCase());
        if (table) {
          table.columns.unshift({
            name: `${table.name.toLowerCase()}_id`,
            dataType: 'INTEGER',
            isPrimaryKey: true,
            isForeignKey: false,
            isNullable: false,
            isUnique: true,
            isAutoIncrement: true,
            defaultValue: null,
            references: null
          });
        }
      }
    }
  });

  return fixedSchema;
};

module.exports = {
  validateSchemaAndSql,
  applySafeAutoFix
};
