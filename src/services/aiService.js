const { GoogleGenerativeAI } = require('@google/generative-ai');

const executeGeminiPrompt = async (prompt) => {
  const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please set GEMINI_API_KEY in your AI BE/.env file.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const preferredModel = process.env.AI_MODEL || 'gemini-2.0-flash';
  const candidateModels = Array.from(new Set([
    preferredModel,
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash',
    'gemini-1.5-flash-latest'
  ]));

  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastError = err;
      const errMsg = err.message || '';
      
      // If 404 model not found, fallback to next available model
      if (errMsg.includes('404 Not Found') || errMsg.includes('is no longer available')) {
        console.warn(`Gemini model ${modelName} not available, trying next model...`);
        continue;
      }

      // Format rate limit / quota exceeded error
      if (errMsg.includes('429') || errMsg.includes('Quota exceeded') || errMsg.includes('Too Many Requests')) {
        throw new Error('Gemini API free tier rate limit or quota exceeded. Please wait a minute before retrying, or check your Gemini API quota.');
      }

      throw new Error(`Gemini API call failed: ${errMsg}`);
    }
  }

  if (lastError) {
    if (lastError.message && lastError.message.includes('404')) {
      throw new Error('Configured Gemini model not found. Defaulting to gemini-2.0-flash.');
    }
    throw new Error(lastError.message);
  }
};

const analyzeRequirement = async (requirementText, databaseType = 'PostgreSQL') => {
  const provider = process.env.AI_PROVIDER || 'gemini';
  const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;

  if (provider === 'gemini' && apiKey) {
    try {
      const prompt = `
You are an expert Database Architect. Analyze the following software database requirement for target database dialect: ${databaseType}.
Extract domain, entities, attributes, data types, primary keys, foreign keys, relationships, cardinalities, business rules, assumptions, and warnings.

Requirement:
"${requirementText}"

Respond ONLY with valid, unformatted JSON matching this exact structure:
{
  "domain": "Domain Name",
  "entities": [
    {
      "name": "EntityName",
      "attributes": [
        {
          "name": "attribute_name",
          "type": "INTEGER | VARCHAR(255) | TEXT | BOOLEAN | TIMESTAMP | DECIMAL(10,2) | UUID | DATE",
          "primaryKey": true,
          "foreignKey": false,
          "nullable": false,
          "unique": true,
          "autoIncrement": true
        }
      ]
    }
  ],
  "relationships": [
    {
      "source": "SourceEntity",
      "target": "TargetEntity",
      "type": "one-to-many | one-to-one | many-to-one | many-to-many",
      "description": "Description of relationship"
    }
  ],
  "businessRules": ["Rule 1"],
  "assumptions": ["Assumption 1"],
  "warnings": ["Warning 1"]
}
`;
      const responseText = await executeGeminiPrompt(prompt);
      const cleanedJson = cleanJsonResponse(responseText);
      const parsed = JSON.parse(cleanedJson);
      return validateAndCleanAnalysisJson(parsed);
    } catch (err) {
      console.warn('AI Provider API call failed. Falling back to structured rule engine:', err.message);
    }
  }

  return fallbackRequirementAnalysis(requirementText, databaseType);
};

const reviewDatabaseDesign = async (databaseDesign) => {
  const prompt = `
You are a senior Database Architect and DBA auditing a database design for target dialect: ${databaseDesign.databaseType || 'PostgreSQL'}.

Analyze the CURRENT database design provided below:

Entities and Attributes:
${JSON.stringify(databaseDesign.entities || [], null, 2)}

Relationships:
${JSON.stringify(databaseDesign.relationships || [], null, 2)}

Generated Relational Schema:
${JSON.stringify(databaseDesign.schema || null, null, 2)}

Generated DDL SQL Script:
${databaseDesign.ddlSql || 'None'}

Auditing Checklist - Inspect the design for all 20 of the following database design aspects:
1. Missing entities needed for business domain completeness
2. Missing attributes in existing entities
3. Unnecessary or redundant attributes
4. Incorrect data types (e.g. FLOAT for currency, missing VARCHAR lengths, inappropriate types)
5. Missing primary keys
6. Foreign-key problems or type mismatches
7. Missing relationships between entities
8. Incorrect relationship cardinality (1:1, 1:N, N:M)
9. Many-to-many relationship problems
10. Missing junction / associative tables
11. Normalization problems (1NF, 2NF, 3NF violations)
12. Duplicate data possibilities or data redundancy
13. Missing NOT NULL constraints where values should be required
14. Missing UNIQUE constraints (e.g., email, code, username)
15. Useful CHECK constraints (e.g. positive prices, status enums)
16. Naming inconsistencies (case convention, singular vs plural)
17. General database design improvements
18. Scalability concerns for large dataset growth
19. Performance concerns (unindexed foreign keys, frequent scan columns)
20. Useful index recommendations

CRITICAL INSTRUCTIONS:
1. Provide useful, actionable suggestions for any weaknesses or issues found.
2. If the current design is already well-structured with no significant flaws, return an empty array for "suggestions".
3. Return STRICTLY JSON matching this exact structure:

{
  "summary": "Clear, concise overall summary of the database design assessment.",
  "suggestions": [
    {
      "severity": "CRITICAL" | "WARNING" | "IMPROVEMENT",
      "category": "Constraint | Data Type | Index | Normalization | Relationship | Entity | Performance | Scalability | Naming",
      "title": "Short title describing the issue",
      "table": "table or entity name (or empty string if not table-specific)",
      "column": "column or attribute name (or empty string if N/A)",
      "description": "Explanation of why this is an issue or limitation",
      "suggestion": "Actionable, concrete suggestion for how to improve it"
    }
  ]
}
`;

  try {
    const text = await executeGeminiPrompt(prompt);
    const cleaned = cleanJsonResponse(text);
    const parsed = JSON.parse(cleaned);
    return validateAndCleanReviewJson(parsed);
  } catch (err) {
    console.error('Gemini API Review Error:', err.message);
    throw new Error(err.message || 'Failed to analyze database design with Gemini API.');
  }
};

const validateAndCleanReviewJson = (parsed) => {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid response structure returned by Gemini API.');
  }

  const summary = typeof parsed.summary === 'string' && parsed.summary.trim()
    ? parsed.summary.trim()
    : 'Database design review completed.';

  const suggestions = [];
  if (Array.isArray(parsed.suggestions)) {
    for (let s of parsed.suggestions) {
      if (!s || typeof s !== 'object') continue;

      let severity = String(s.severity || 'IMPROVEMENT').toUpperCase().trim();
      if (!['CRITICAL', 'WARNING', 'IMPROVEMENT'].includes(severity)) {
        if (severity.includes('CRIT')) severity = 'CRITICAL';
        else if (severity.includes('WARN')) severity = 'WARNING';
        else severity = 'IMPROVEMENT';
      }

      suggestions.push({
        severity,
        category: String(s.category || 'General').trim(),
        title: String(s.title || 'Database Recommendation').trim(),
        table: String(s.table || '').trim(),
        column: String(s.column || '').trim(),
        description: String(s.description || s.reason || '').trim(),
        suggestion: String(s.suggestion || s.recommendedChange || '').trim()
      });
    }
  }

  return { summary, suggestions };
};


const cleanJsonResponse = (rawText) => {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```/, '').replace(/```$/, '');
  }
  return cleaned.trim();
};

const validateAndCleanAnalysisJson = (json) => {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid JSON output from AI provider.');
  }

  return {
    domain: json.domain || 'General Software Platform',
    entities: Array.isArray(json.entities) ? json.entities.map(e => ({
      name: sanitizeIdentifier(e.name || 'Entity'),
      attributes: Array.isArray(e.attributes) ? e.attributes.map(a => ({
        name: sanitizeIdentifier(a.name || 'id'),
        type: a.type || 'VARCHAR(255)',
        primaryKey: Boolean(a.primaryKey),
        foreignKey: Boolean(a.foreignKey),
        nullable: a.nullable !== undefined ? Boolean(a.nullable) : !a.primaryKey,
        unique: Boolean(a.unique),
        autoIncrement: Boolean(a.autoIncrement)
      })) : []
    })) : [],
    relationships: Array.isArray(json.relationships) ? json.relationships.map(r => ({
      source: r.source || r.from || '',
      target: r.target || r.to || '',
      type: r.type || 'one-to-many',
      description: r.description || ''
    })) : [],
    businessRules: Array.isArray(json.businessRules) ? json.businessRules : [],
    assumptions: Array.isArray(json.assumptions) ? json.assumptions : [],
    warnings: Array.isArray(json.warnings) ? json.warnings : []
  };
};

const sanitizeIdentifier = (str) => {
  return str.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
};

const fallbackRequirementAnalysis = (text, databaseType) => {
  const lower = text.toLowerCase();
  
  if (lower.includes('shopping') || lower.includes('order') || lower.includes('product') || lower.includes('customer')) {
    return {
      domain: 'E-Commerce / Online Shopping',
      entities: [
        {
          name: 'Customer',
          attributes: [
            { name: 'customer_id', type: 'INTEGER', primaryKey: true, foreignKey: false, nullable: false, unique: true, autoIncrement: true },
            { name: 'name', type: 'VARCHAR(100)', primaryKey: false, foreignKey: false, nullable: false, unique: false, autoIncrement: false },
            { name: 'email', type: 'VARCHAR(255)', primaryKey: false, foreignKey: false, nullable: false, unique: true, autoIncrement: false },
            { name: 'phone', type: 'VARCHAR(20)', primaryKey: false, foreignKey: false, nullable: true, unique: false, autoIncrement: false },
            { name: 'created_at', type: 'TIMESTAMP', primaryKey: false, foreignKey: false, nullable: true, unique: false, autoIncrement: false }
          ]
        },
        {
          name: 'Category',
          attributes: [
            { name: 'category_id', type: 'INTEGER', primaryKey: true, foreignKey: false, nullable: false, unique: true, autoIncrement: true },
            { name: 'name', type: 'VARCHAR(100)', primaryKey: false, foreignKey: false, nullable: false, unique: true, autoIncrement: false }
          ]
        },
        {
          name: 'Product',
          attributes: [
            { name: 'product_id', type: 'INTEGER', primaryKey: true, foreignKey: false, nullable: false, unique: true, autoIncrement: true },
            { name: 'category_id', type: 'INTEGER', primaryKey: false, foreignKey: true, nullable: false, unique: false, autoIncrement: false },
            { name: 'name', type: 'VARCHAR(255)', primaryKey: false, foreignKey: false, nullable: false, unique: false, autoIncrement: false },
            { name: 'price', type: 'DECIMAL(10,2)', primaryKey: false, foreignKey: false, nullable: false, unique: false, autoIncrement: false },
            { name: 'stock_quantity', type: 'INTEGER', primaryKey: false, foreignKey: false, nullable: false, unique: false, autoIncrement: false }
          ]
        },
        {
          name: 'Order',
          attributes: [
            { name: 'order_id', type: 'INTEGER', primaryKey: true, foreignKey: false, nullable: false, unique: true, autoIncrement: true },
            { name: 'customer_id', type: 'INTEGER', primaryKey: false, foreignKey: true, nullable: false, unique: false, autoIncrement: false },
            { name: 'order_date', type: 'TIMESTAMP', primaryKey: false, foreignKey: false, nullable: false, unique: false, autoIncrement: false },
            { name: 'total_amount', type: 'DECIMAL(10,2)', primaryKey: false, foreignKey: false, nullable: false, unique: false, autoIncrement: false }
          ]
        },
        {
          name: 'OrderItem',
          attributes: [
            { name: 'order_item_id', type: 'INTEGER', primaryKey: true, foreignKey: false, nullable: false, unique: true, autoIncrement: true },
            { name: 'order_id', type: 'INTEGER', primaryKey: false, foreignKey: true, nullable: false, unique: false, autoIncrement: false },
            { name: 'product_id', type: 'INTEGER', primaryKey: false, foreignKey: true, nullable: false, unique: false, autoIncrement: false },
            { name: 'quantity', type: 'INTEGER', primaryKey: false, foreignKey: false, nullable: false, unique: false, autoIncrement: false },
            { name: 'unit_price', type: 'DECIMAL(10,2)', primaryKey: false, foreignKey: false, nullable: false, unique: false, autoIncrement: false }
          ]
        },
        {
          name: 'Payment',
          attributes: [
            { name: 'payment_id', type: 'INTEGER', primaryKey: true, foreignKey: false, nullable: false, unique: true, autoIncrement: true },
            { name: 'order_id', type: 'INTEGER', primaryKey: false, foreignKey: true, nullable: false, unique: true, autoIncrement: false },
            { name: 'payment_method', type: 'VARCHAR(50)', primaryKey: false, foreignKey: false, nullable: false, unique: false, autoIncrement: false },
            { name: 'amount', type: 'DECIMAL(10,2)', primaryKey: false, foreignKey: false, nullable: false, unique: false, autoIncrement: false }
          ]
        },
        {
          name: 'Shipping',
          attributes: [
            { name: 'shipping_id', type: 'INTEGER', primaryKey: true, foreignKey: false, nullable: false, unique: true, autoIncrement: true },
            { name: 'order_id', type: 'INTEGER', primaryKey: false, foreignKey: true, nullable: false, unique: true, autoIncrement: false },
            { name: 'address', type: 'TEXT', primaryKey: false, foreignKey: false, nullable: false, unique: false, autoIncrement: false },
            { name: 'tracking_number', type: 'VARCHAR(100)', primaryKey: false, foreignKey: false, nullable: true, unique: true, autoIncrement: false }
          ]
        }
      ],
      relationships: [
        { source: 'Customer', target: 'Order', type: 'one-to-many', description: 'Customers can place multiple orders' },
        { source: 'Category', target: 'Product', type: 'one-to-many', description: 'Products belong to categories' },
        { source: 'Order', target: 'OrderItem', type: 'one-to-many', description: 'Order contains multiple order items' },
        { source: 'Product', target: 'OrderItem', type: 'one-to-many', description: 'Product appears in multiple order items' },
        { source: 'Order', target: 'Payment', type: 'one-to-one', description: 'Order has payment information' },
        { source: 'Order', target: 'Shipping', type: 'one-to-one', description: 'Order contains shipping information' }
      ],
      businessRules: [
        'Customers register using name, email and phone number.',
        'Each order can contain multiple products and each product can appear in multiple orders.',
        'Products belong to categories.',
        'Customers can make payments for their orders.'
      ],
      assumptions: [
        'Each customer email address is unique.',
        'Orders have single payment and shipping records.'
      ],
      warnings: [
        'Ensure unit_price in OrderItem is snapshot value to prevent unexpected price alterations.'
      ]
    };
  }

  return {
    domain: 'Custom Software System',
    entities: [
      {
        name: 'User',
        attributes: [
          { name: 'id', type: 'INTEGER', primaryKey: true, foreignKey: false, nullable: false, unique: true, autoIncrement: true },
          { name: 'username', type: 'VARCHAR(100)', primaryKey: false, foreignKey: false, nullable: false, unique: true, autoIncrement: false },
          { name: 'email', type: 'VARCHAR(255)', primaryKey: false, foreignKey: false, nullable: false, unique: true, autoIncrement: false }
        ]
      },
      {
        name: 'Item',
        attributes: [
          { name: 'id', type: 'INTEGER', primaryKey: true, foreignKey: false, nullable: false, unique: true, autoIncrement: true },
          { name: 'user_id', type: 'INTEGER', primaryKey: false, foreignKey: true, nullable: false, unique: false, autoIncrement: false },
          { name: 'title', type: 'VARCHAR(255)', primaryKey: false, foreignKey: false, nullable: false, unique: false, autoIncrement: false }
        ]
      }
    ],
    relationships: [
      { source: 'User', target: 'Item', type: 'one-to-many', description: 'User owns items' }
    ],
    businessRules: ['Items belong to a registered user.'],
    assumptions: ['User emails are unique.'],
    warnings: ['Index foreign key user_id.']
  };
};

const generateDeterministicReviewSuggestions = (entities, relationships, databaseType) => {
  const suggestions = [];

  relationships.forEach((rel) => {
    suggestions.push({
      severity: 'Improvement',
      category: 'Index',
      table: (rel.target || rel.to || '').toLowerCase(),
      title: `Add Index on Foreign Key ${(rel.target || rel.to)}`,
      reason: 'B-Tree foreign key indexing accelerates JOINs and foreign key lookup operations.',
      recommendedChange: `CREATE INDEX idx_${(rel.target || rel.to).toLowerCase()}_fk ON ${(rel.target || rel.to).toLowerCase()}(${(rel.source || rel.from).toLowerCase()}_id);`
    });
  });

  return { suggestions };
};

const modifyDesignWithReview = async (databaseDesign, suggestions = []) => {
  const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const prompt = `
You are a Database Architect. Modify and update the current database design to fix all issues identified in the AI Review suggestions.

Current Entities and Attributes:
${JSON.stringify(databaseDesign.entities || [], null, 2)}

Current Relationships:
${JSON.stringify(databaseDesign.relationships || [], null, 2)}

AI Review Suggestions to Apply:
${JSON.stringify(suggestions || [], null, 2)}

Requirements:
1. Fix destructive CASCADE deletes by setting appropriate ON DELETE constraints (RESTRICT, SET NULL, or NO ACTION) where financial/order history needs protection.
2. Add missing status/lifecycle attributes, timestamp columns, unique constraints, and check constraints mentioned in suggestions.
3. Fix invalid data types (e.g. change unconstrained numbers/floats for currency to DECIMAL(10,2)).
4. Add any missing junction/associative tables or missing entities required.
5. Respond ONLY with valid, unformatted JSON matching this exact structure:

{
  "entities": [
    {
      "name": "EntityName",
      "description": "Description",
      "attributes": [
        {
          "name": "column_name",
          "type": "INTEGER | VARCHAR(255) | TEXT | BOOLEAN | TIMESTAMP | DECIMAL(10,2) | UUID | DATE",
          "primaryKey": true,
          "foreignKey": false,
          "nullable": false,
          "unique": false,
          "autoIncrement": true,
          "defaultValue": null
        }
      ]
    }
  ],
  "relationships": [
    {
      "source": "SourceEntity",
      "target": "TargetEntity",
      "type": "one-to-many | one-to-one | many-to-one | many-to-many",
      "sourceColumn": "column_name",
      "targetColumn": "column_name",
      "foreignKeyColumn": "foreign_key_column",
      "onDelete": "RESTRICT",
      "onUpdate": "CASCADE",
      "description": "Description"
    }
  ]
}
`;
      const responseText = await executeGeminiPrompt(prompt);
      const cleaned = cleanJsonResponse(responseText);
      const parsed = JSON.parse(cleaned);
      return validateAndCleanModifiedDesign(parsed, databaseDesign);
    } catch (err) {
      console.warn('Gemini modify API call failed. Applying fallback rule-based modify:', err.message);
    }
  }

  return fallbackModifyDesign(databaseDesign, suggestions);
};

const validateAndCleanModifiedDesign = (parsed, originalDesign) => {
  if (!parsed || typeof parsed !== 'object') {
    return fallbackModifyDesign(originalDesign, []);
  }

  const entities = Array.isArray(parsed.entities) ? parsed.entities.map(e => ({
    name: sanitizeIdentifier(e.name || 'Entity'),
    description: e.description || '',
    attributes: Array.isArray(e.attributes) ? e.attributes.map(a => ({
      name: sanitizeIdentifier(a.name || 'id'),
      type: a.type || 'VARCHAR(255)',
      primaryKey: Boolean(a.primaryKey),
      foreignKey: Boolean(a.foreignKey),
      nullable: a.nullable !== undefined ? Boolean(a.nullable) : !a.primaryKey,
      unique: Boolean(a.unique),
      autoIncrement: Boolean(a.autoIncrement),
      defaultValue: a.defaultValue || null
    })) : []
  })) : (originalDesign.entities || []);

  const relationships = Array.isArray(parsed.relationships) ? parsed.relationships.map(r => ({
    source: r.source || r.from || '',
    target: r.target || r.to || '',
    type: r.type || 'one-to-many',
    sourceColumn: r.sourceColumn || null,
    targetColumn: r.targetColumn || null,
    foreignKeyColumn: r.foreignKeyColumn || null,
    onDelete: r.onDelete || 'RESTRICT',
    onUpdate: r.onUpdate || 'CASCADE',
    description: r.description || ''
  })) : (originalDesign.relationships || []);

  return { entities, relationships };
};

const fallbackModifyDesign = (databaseDesign, suggestions = []) => {
  const entities = JSON.parse(JSON.stringify(databaseDesign.entities || []));
  const relationships = JSON.parse(JSON.stringify(databaseDesign.relationships || []));

  relationships.forEach(rel => {
    const src = (rel.source || '').toLowerCase();
    const tgt = (rel.target || '').toLowerCase();
    if (src === 'customer' && (tgt === 'order' || tgt === 'orders')) {
      rel.onDelete = 'RESTRICT';
    }
  });

  entities.forEach(ent => {
    const entName = ent.name.toLowerCase();
    if (entName === 'order' || entName === 'orders') {
      const hasStatus = ent.attributes.some(a => a.name.toLowerCase() === 'status');
      if (!hasStatus) {
        ent.attributes.push({
          name: 'status',
          type: "VARCHAR(50)",
          primaryKey: false,
          foreignKey: false,
          nullable: false,
          unique: false,
          autoIncrement: false
        });
      }
    }
  });

  return { entities, relationships };
};

module.exports = {
  analyzeRequirement,
  reviewDatabaseDesign,
  modifyDesignWithReview
};
