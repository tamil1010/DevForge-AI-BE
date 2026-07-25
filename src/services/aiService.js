const { GoogleGenerativeAI } = require('@google/generative-ai');

const analyzeRequirement = async (requirementText, databaseType = 'PostgreSQL') => {
  const provider = process.env.AI_PROVIDER || 'gemini';
  const apiKey = process.env.AI_API_KEY;

  if (provider === 'gemini' && apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: process.env.AI_MODEL || 'gemini-1.5-flash' });

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

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const cleanedJson = cleanJsonResponse(responseText);
      const parsed = JSON.parse(cleanedJson);
      return validateAndCleanAnalysisJson(parsed);
    } catch (err) {
      console.warn('AI Provider API call failed. Falling back to structured rule engine:', err.message);
    }
  }

  return fallbackRequirementAnalysis(requirementText, databaseType);
};

const reviewDatabaseDesign = async (entities, relationships, databaseType = 'PostgreSQL') => {
  const apiKey = process.env.AI_API_KEY;
  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: process.env.AI_MODEL || 'gemini-1.5-flash' });

      const prompt = `
You are a senior Database Administrator reviewing a database schema for ${databaseType}.
Analyze the entities and relationships:

Entities: ${JSON.stringify(entities, null, 2)}
Relationships: ${JSON.stringify(relationships, null, 2)}

Return strictly JSON matching this structure:
{
  "suggestions": [
    {
      "severity": "Critical | Warning | Improvement",
      "category": "Index | Normalization | Datatype | Constraint | Security",
      "table": "table_name",
      "title": "Short title",
      "reason": "Why this matters",
      "recommendedChange": "Specific change suggested"
    }
  ]
}
`;
      const result = await model.generateContent(prompt);
      const cleaned = cleanJsonResponse(result.response.text());
      return JSON.parse(cleaned);
    } catch (err) {
      console.warn('AI Review call failed. Generating deterministic review suggestions:', err.message);
    }
  }

  return generateDeterministicReviewSuggestions(entities, relationships, databaseType);
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

module.exports = {
  analyzeRequirement,
  reviewDatabaseDesign
};
