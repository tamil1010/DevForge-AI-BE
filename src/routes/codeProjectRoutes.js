const express = require('express');
const router = express.Router();
const controller = require('../controllers/codeProjectController');

// Requirement Analysis
router.post('/analyze-requirement', controller.analyzeRequirement);

// DB Project Linked Code Generator Endpoints
router.get('/by-db-project/:dbProjectId', controller.getByDatabaseProjectId);
router.post('/generate-for-db-project', controller.generateForDatabaseProject);

// Project CRUD
router.get('/', controller.getAllProjects);
router.post('/', controller.createProject);
router.get('/:id', controller.getProjectById);
router.put('/:id', controller.updateProject);
router.delete('/:id', controller.deleteProject);
router.post('/:id/duplicate', controller.duplicateProject);

// File Operations
router.post('/:id/files', controller.saveFile);

// Database & Generators
router.post('/:id/import-database', controller.importDatabaseSchema);
router.post('/:id/generate-crud', controller.generateCrud);
router.post('/:id/generate-api', controller.generateApi);
router.post('/:id/generate-auth', controller.generateAuth);

// Debugger, Modification & Reviews
router.post('/:id/debug', controller.debugCode);
router.post('/:id/modify', controller.modifyCode);
router.get('/:id/review', controller.reviewCode);
router.post('/:id/generate-tests', controller.generateTests);
router.post('/:id/optimize', controller.optimizeCode);
router.post('/:id/explain', controller.explainCode);
router.get('/:id/docs', controller.getDocs);

// Security & Dependencies
router.get('/:id/security-scan', controller.scanSecurity);
router.get('/:id/dependencies', controller.scanDependencies);

// AI Coding Chat
router.get('/:id/chats', controller.getChatHistory);
router.post('/:id/chats', controller.sendChatMessage);

// Version History
router.get('/:id/versions', controller.getVersions);
router.post('/:id/versions', controller.createVersion);
router.post('/:id/versions/:versionNumber/restore', controller.restoreVersion);

// Export
router.get('/:id/export', controller.exportProjectZip);

module.exports = router;
