const generateRelationalSchema = (entities = [], relationships = []) => {
  const schema = {
    tables: []
  };

  const processedEntities = JSON.parse(JSON.stringify(entities));
  const processedRelationships = JSON.parse(JSON.stringify(relationships));

  processedEntities.forEach((entity) => {
    const table = {
      name: entity.name,
      columns: entity.attributes.map((attr) => ({
        name: attr.name,
        dataType: attr.type,
        isPrimaryKey: Boolean(attr.primaryKey),
        isForeignKey: Boolean(attr.foreignKey),
        isNullable: attr.nullable !== undefined ? Boolean(attr.nullable) : !attr.primaryKey,
        isUnique: Boolean(attr.unique),
        isAutoIncrement: Boolean(attr.autoIncrement),
        defaultValue: attr.defaultValue || null,
        references: null
      }))
    };
    schema.tables.push(table);
  });

  processedRelationships.forEach((rel) => {
    const fromName = rel.source || rel.from;
    const toName = rel.target || rel.to;
    if (!fromName || !toName) return;

    const sourceTable = schema.tables.find((t) => t.name.toLowerCase() === fromName.toLowerCase());
    const targetTable = schema.tables.find((t) => t.name.toLowerCase() === toName.toLowerCase());

    if (!sourceTable || !targetTable) return;

    if (rel.type === 'one-to-many' || rel.type === 'many-to-one') {
      const parentTable = rel.type === 'one-to-many' ? sourceTable : targetTable;
      const childTable = rel.type === 'one-to-many' ? targetTable : sourceTable;

      const parentPk = parentTable.columns.find((c) => c.isPrimaryKey) || parentTable.columns[0];
      const fkColName = rel.foreignKeyColumn || rel.targetColumn || `${parentTable.name.toLowerCase()}_id`;

      let fkCol = childTable.columns.find((c) => c.name.toLowerCase() === fkColName.toLowerCase());
      if (!fkCol) {
        fkCol = {
          name: fkColName,
          dataType: parentPk ? parentPk.dataType : 'INTEGER',
          isPrimaryKey: false,
          isForeignKey: true,
          isNullable: false,
          isUnique: false,
          isAutoIncrement: false,
          defaultValue: null,
          references: {
            table: parentTable.name,
            column: parentPk ? parentPk.name : 'id',
            onDelete: rel.onDelete || 'CASCADE',
            onUpdate: rel.onUpdate || 'CASCADE'
          }
        };
        childTable.columns.push(fkCol);
      } else {
        fkCol.isForeignKey = true;
        fkCol.references = {
          table: parentTable.name,
          column: parentPk ? parentPk.name : 'id',
          onDelete: rel.onDelete || 'CASCADE',
          onUpdate: rel.onUpdate || 'CASCADE'
        };
      }
    } else if (rel.type === 'one-to-one') {
      const parentPk = sourceTable.columns.find((c) => c.isPrimaryKey) || sourceTable.columns[0];
      const fkColName = rel.foreignKeyColumn || `${sourceTable.name.toLowerCase()}_id`;

      let fkCol = targetTable.columns.find((c) => c.name.toLowerCase() === fkColName.toLowerCase());
      if (!fkCol) {
        fkCol = {
          name: fkColName,
          dataType: parentPk ? parentPk.dataType : 'INTEGER',
          isPrimaryKey: false,
          isForeignKey: true,
          isNullable: false,
          isUnique: true,
          isAutoIncrement: false,
          defaultValue: null,
          references: {
            table: sourceTable.name,
            column: parentPk ? parentPk.name : 'id',
            onDelete: rel.onDelete || 'CASCADE',
            onUpdate: rel.onUpdate || 'CASCADE'
          }
        };
        targetTable.columns.push(fkCol);
      } else {
        fkCol.isForeignKey = true;
        fkCol.isUnique = true;
        fkCol.references = {
          table: sourceTable.name,
          column: parentPk ? parentPk.name : 'id',
          onDelete: rel.onDelete || 'CASCADE',
          onUpdate: rel.onUpdate || 'CASCADE'
        };
      }
    } else if (rel.type === 'many-to-many') {
      const junctionTableName = `${sourceTable.name}_${targetTable.name}`;
      const existingJunction = schema.tables.find((t) => t.name.toLowerCase() === junctionTableName.toLowerCase());

      if (!existingJunction) {
        const sourcePk = sourceTable.columns.find((c) => c.isPrimaryKey) || sourceTable.columns[0];
        const targetPk = targetTable.columns.find((c) => c.isPrimaryKey) || targetTable.columns[0];

        const sourceFkName = `${sourceTable.name.toLowerCase()}_id`;
        const targetFkName = `${targetTable.name.toLowerCase()}_id`;

        const junctionTable = {
          name: junctionTableName,
          isJunctionTable: true,
          columns: [
            {
              name: sourceFkName,
              dataType: sourcePk ? sourcePk.dataType : 'INTEGER',
              isPrimaryKey: true,
              isForeignKey: true,
              isNullable: false,
              isUnique: false,
              isAutoIncrement: false,
              defaultValue: null,
              references: {
                table: sourceTable.name,
                column: sourcePk ? sourcePk.name : 'id',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
              }
            },
            {
              name: targetFkName,
              dataType: targetPk ? targetPk.dataType : 'INTEGER',
              isPrimaryKey: true,
              isForeignKey: true,
              isNullable: false,
              isUnique: false,
              isAutoIncrement: false,
              defaultValue: null,
              references: {
                table: targetTable.name,
                column: targetPk ? targetPk.name : 'id',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
              }
            },
            {
              name: 'created_at',
              dataType: 'TIMESTAMP',
              isPrimaryKey: false,
              isForeignKey: false,
              isNullable: true,
              isUnique: false,
              isAutoIncrement: false,
              defaultValue: 'CURRENT_TIMESTAMP',
              references: null
            }
          ]
        };
        schema.tables.push(junctionTable);
      }
    }
  });

  return schema;
};

module.exports = {
  generateRelationalSchema
};
