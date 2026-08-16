const test = require('node:test');
const assert = require('assert');
const aiCodeService = require('../src/services/aiCodeService');

test('AI Code Service Requirement Analysis Test', async () => {
  const reqText = 'Create a student management system with authentication, CRUD operations, and PostgreSQL';
  const result = await aiCodeService.analyzeCodeRequirement(reqText, {
    language: 'JavaScript',
    framework: 'Express.js',
    database: 'PostgreSQL',
    projectType: 'Full Stack'
  });

  assert.ok(result.requirementsDetected && result.requirementsDetected.length > 0);
  assert.ok(result.entitiesDetected && result.entitiesDetected.length > 0);
  assert.ok(result.apiEndpointsDetected && result.apiEndpointsDetected.length > 0);
});

test('AI Code Architecture & Multi-File Code Generation Test', async () => {
  const reqText = 'Build a hospital management API';
  const arch = await aiCodeService.generateProjectArchitecture(reqText, {
    language: 'JavaScript',
    framework: 'Express.js'
  });
  assert.ok(Array.isArray(arch) && arch.length > 0);

  const files = await aiCodeService.generateFullProjectCode(reqText, {
    language: 'JavaScript',
    framework: 'Express.js'
  }, arch);

  assert.ok(Array.isArray(files) && files.length > 0);
  const serverFile = files.find(f => f.name === 'server.js');
  assert.ok(serverFile && serverFile.content.includes('express'));
});
