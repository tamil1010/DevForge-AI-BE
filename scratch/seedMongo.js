const mongoose = require('mongoose');
require('dotenv').config();

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    console.log('Connected directly to MongoDB Atlas');

    const schemaOpts = { timestamps: true, strict: false, id: false };
    const DevForgeProject = mongoose.model('DevForgeProject', new mongoose.Schema({}, schemaOpts));
    const DevForgeEntity = mongoose.model('DevForgeEntity', new mongoose.Schema({}, schemaOpts));
    const DevForgeAttribute = mongoose.model('DevForgeAttribute', new mongoose.Schema({}, schemaOpts));
    const DevForgeRelationship = mongoose.model('DevForgeRelationship', new mongoose.Schema({}, schemaOpts));
    const DevForgeGeneratedSchema = mongoose.model('DevForgeGeneratedSchema', new mongoose.Schema({}, schemaOpts));
    const DevForgeGeneratedSql = mongoose.model('DevForgeGeneratedSql', new mongoose.Schema({}, schemaOpts));
    const DevForgeValidationResult = mongoose.model('DevForgeValidationResult', new mongoose.Schema({}, schemaOpts));
    const DevForgeRequirement = mongoose.model('DevForgeRequirement', new mongoose.Schema({}, schemaOpts));

    const projects = await DevForgeProject.find({});
    console.log('Found MongoDB Projects:', projects.map(p => ({ id: p.id, name: p.name })));

    for (let p of projects) {
      const pId = p.id;
      if (!pId) continue;
      console.log('Seeding data for project:', p.name, 'ID:', pId);

      if (p.name.includes('Student')) {
        const rawText = 'Student Management System with Departments, Students, Instructors, Courses, and Enrollments';
        const analysis = {
          domain: 'Education',
          entities: [
            { name: 'Departments', attributes: [{ name: 'id', type: 'INT', primaryKey: true }, { name: 'department_name', type: 'VARCHAR(255)' }] },
            { name: 'Students', attributes: [{ name: 'id', type: 'INT', primaryKey: true }, { name: 'first_name', type: 'VARCHAR(100)' }, { name: 'email', type: 'VARCHAR(255)', unique: true }, { name: 'department_id', type: 'INT', foreignKey: true }] },
            { name: 'Instructors', attributes: [{ name: 'id', type: 'INT', primaryKey: true }, { name: 'name', type: 'VARCHAR(255)' }, { name: 'department_id', type: 'INT', foreignKey: true }] },
            { name: 'Courses', attributes: [{ name: 'id', type: 'INT', primaryKey: true }, { name: 'course_code', type: 'VARCHAR(50)' }, { name: 'title', type: 'VARCHAR(255)' }, { name: 'department_id', type: 'INT', foreignKey: true }] },
            { name: 'Enrollments', attributes: [{ name: 'id', type: 'INT', primaryKey: true }, { name: 'student_id', type: 'INT', foreignKey: true }, { name: 'course_id', type: 'INT', foreignKey: true }, { name: 'grade', type: 'VARCHAR(10)' }] }
          ],
          relationships: [
            { source: 'Departments', target: 'Students', type: '1:N' },
            { source: 'Departments', target: 'Courses', type: '1:N' },
            { source: 'Departments', target: 'Instructors', type: '1:N' },
            { source: 'Students', target: 'Enrollments', type: '1:N' },
            { source: 'Courses', target: 'Enrollments', type: '1:N' }
          ]
        };

        const schema = {
          tables: analysis.entities.map(e => ({
            name: e.name,
            tableName: e.name,
            columns: e.attributes.map(a => ({
              name: a.name,
              dataType: a.type,
              primaryKey: !!a.primaryKey,
              foreignKey: !!a.foreignKey,
              nullable: !a.primaryKey
            })),
            foreignKeys: e.attributes.filter(a => a.foreignKey).map(a => ({
              column: a.name,
              referencedTable: a.name.replace('_id', 's')
            }))
          }))
        };

        const ddl = `CREATE TABLE Departments (\n  id INT PRIMARY KEY,\n  department_name VARCHAR(255)\n);\n\nCREATE TABLE Students (\n  id INT PRIMARY KEY,\n  first_name VARCHAR(100),\n  email VARCHAR(255) UNIQUE,\n  department_id INT REFERENCES Departments(id)\n);\n\nCREATE TABLE Instructors (\n  id INT PRIMARY KEY,\n  name VARCHAR(255),\n  department_id INT REFERENCES Departments(id)\n);\n\nCREATE TABLE Courses (\n  id INT PRIMARY KEY,\n  course_code VARCHAR(50),\n  title VARCHAR(255),\n  department_id INT REFERENCES Departments(id)\n);\n\nCREATE TABLE Enrollments (\n  id INT PRIMARY KEY,\n  student_id INT REFERENCES Students(id),\n  course_id INT REFERENCES Courses(id),\n  grade VARCHAR(10)\n);`;

        const pIdMatch = [pId, String(pId)];
        if (!isNaN(Number(pId))) pIdMatch.push(Number(pId));

        await DevForgeRequirement.findOneAndUpdate({ project_id: { $in: pIdMatch } }, { id: Date.now(), project_id: pId, raw_text: rawText, domain: 'Education', analysis_json: analysis }, { upsert: true });
        await DevForgeEntity.deleteMany({ project_id: { $in: pIdMatch } });
        await DevForgeRelationship.deleteMany({ project_id: { $in: pIdMatch } });

        for (let ent of analysis.entities) {
          const entId = Date.now() + Math.random();
          await DevForgeEntity.create({ id: entId, project_id: pId, name: ent.name, description: `${ent.name} table` });
          for (let a of ent.attributes) {
            await DevForgeAttribute.create({
              id: Date.now() + Math.random(),
              entity_id: entId,
              name: a.name,
              data_type: a.type,
              is_primary_key: !!a.primaryKey,
              is_foreign_key: !!a.foreignKey,
              is_nullable: !a.primaryKey,
              is_unique: !!a.unique
            });
          }
        }

        for (let r of analysis.relationships) {
          await DevForgeRelationship.create({
            id: Date.now() + Math.random(),
            project_id: pId,
            source_entity: r.source,
            target_entity: r.target,
            type: r.type
          });
        }

        await DevForgeGeneratedSchema.findOneAndUpdate({ project_id: { $in: pIdMatch } }, { id: Date.now(), project_id: pId, schema_json: schema, normalization_status: { isNormalized: true, normalForm: '3NF' } }, { upsert: true });
        await DevForgeGeneratedSql.findOneAndUpdate({ project_id: { $in: pIdMatch } }, { id: Date.now(), project_id: pId, ddl_sql: ddl, sample_data_sql: '-- Sample Data SQL', dialect: 'PostgreSQL' }, { upsert: true });
        await DevForgeValidationResult.findOneAndUpdate({ project_id: { $in: pIdMatch } }, { id: Date.now(), project_id: pId, score: 95, is_valid: true, issues: [] }, { upsert: true });

        console.log('Successfully seeded Student DB!');
      } else if (p.name.includes('E-Commerce')) {
        const rawText = 'E-Commerce Database with Users, Products, Orders, OrderItems, and Payments';
        const analysis = {
          domain: 'E-Commerce',
          entities: [
            { name: 'Users', attributes: [{ name: 'id', type: 'INT', primaryKey: true }, { name: 'email', type: 'VARCHAR(255)', unique: true }, { name: 'full_name', type: 'VARCHAR(255)' }] },
            { name: 'Products', attributes: [{ name: 'id', type: 'INT', primaryKey: true }, { name: 'name', type: 'VARCHAR(255)' }, { name: 'price', type: 'DECIMAL(10,2)' }] },
            { name: 'Orders', attributes: [{ name: 'id', type: 'INT', primaryKey: true }, { name: 'user_id', type: 'INT', foreignKey: true }, { name: 'total_amount', type: 'DECIMAL(10,2)' }] },
            { name: 'OrderItems', attributes: [{ name: 'id', type: 'INT', primaryKey: true }, { name: 'order_id', type: 'INT', foreignKey: true }, { name: 'product_id', type: 'INT', foreignKey: true }, { name: 'quantity', type: 'INT' }] },
            { name: 'Payments', attributes: [{ name: 'id', type: 'INT', primaryKey: true }, { name: 'order_id', type: 'INT', foreignKey: true }, { name: 'amount', type: 'DECIMAL(10,2)' }, { name: 'payment_status', type: 'VARCHAR(50)' }] }
          ],
          relationships: [
            { source: 'Users', target: 'Orders', type: '1:N' },
            { source: 'Orders', target: 'OrderItems', type: '1:N' },
            { source: 'Products', target: 'OrderItems', type: '1:N' },
            { source: 'Orders', target: 'Payments', type: '1:1' }
          ]
        };

        const schema = {
          tables: analysis.entities.map(e => ({
            name: e.name,
            tableName: e.name,
            columns: e.attributes.map(a => ({
              name: a.name,
              dataType: a.type,
              primaryKey: !!a.primaryKey,
              foreignKey: !!a.foreignKey,
              nullable: !a.primaryKey
            })),
            foreignKeys: e.attributes.filter(a => a.foreignKey).map(a => ({
              column: a.name,
              referencedTable: a.name.replace('_id', 's')
            }))
          }))
        };

        const ddl = `CREATE TABLE Users (\n  id INT PRIMARY KEY,\n  email VARCHAR(255) UNIQUE,\n  full_name VARCHAR(255)\n);\n\nCREATE TABLE Products (\n  id INT PRIMARY KEY,\n  name VARCHAR(255),\n  price DECIMAL(10,2)\n);\n\nCREATE TABLE Orders (\n  id INT PRIMARY KEY,\n  user_id INT REFERENCES Users(id),\n  total_amount DECIMAL(10,2)\n);\n\nCREATE TABLE OrderItems (\n  id INT PRIMARY KEY,\n  order_id INT REFERENCES Orders(id),\n  product_id INT REFERENCES Products(id),\n  quantity INT\n);\n\nCREATE TABLE Payments (\n  id INT PRIMARY KEY,\n  order_id INT REFERENCES Orders(id),\n  amount DECIMAL(10,2),\n  payment_status VARCHAR(50)\n);`;

        const pIdMatch = [pId, String(pId)];
        if (!isNaN(Number(pId))) pIdMatch.push(Number(pId));

        await DevForgeRequirement.findOneAndUpdate({ project_id: { $in: pIdMatch } }, { id: Date.now(), project_id: pId, raw_text: rawText, domain: 'E-Commerce', analysis_json: analysis }, { upsert: true });
        await DevForgeEntity.deleteMany({ project_id: { $in: pIdMatch } });
        await DevForgeRelationship.deleteMany({ project_id: { $in: pIdMatch } });

        for (let ent of analysis.entities) {
          const entId = Date.now() + Math.random();
          await DevForgeEntity.create({ id: entId, project_id: pId, name: ent.name, description: `${ent.name} table` });
          for (let a of ent.attributes) {
            await DevForgeAttribute.create({
              id: Date.now() + Math.random(),
              entity_id: entId,
              name: a.name,
              data_type: a.type,
              is_primary_key: !!a.primaryKey,
              is_foreign_key: !!a.foreignKey,
              is_nullable: !a.primaryKey,
              is_unique: !!a.unique
            });
          }
        }

        for (let r of analysis.relationships) {
          await DevForgeRelationship.create({
            id: Date.now() + Math.random(),
            project_id: pId,
            source_entity: r.source,
            target_entity: r.target,
            type: r.type
          });
        }

        await DevForgeGeneratedSchema.findOneAndUpdate({ project_id: { $in: pIdMatch } }, { id: Date.now(), project_id: pId, schema_json: schema, normalization_status: { isNormalized: true, normalForm: '3NF' } }, { upsert: true });
        await DevForgeGeneratedSql.findOneAndUpdate({ project_id: { $in: pIdMatch } }, { id: Date.now(), project_id: pId, ddl_sql: ddl, sample_data_sql: '-- Sample Data SQL', dialect: 'PostgreSQL' }, { upsert: true });
        await DevForgeValidationResult.findOneAndUpdate({ project_id: { $in: pIdMatch } }, { id: Date.now(), project_id: pId, score: 95, is_valid: true, issues: [] }, { upsert: true });

        console.log('Successfully seeded E-Commerce System DB!');
      }
    }

    console.log('Seeding process complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();
