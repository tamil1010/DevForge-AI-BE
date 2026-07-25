try {
  require('dotenv').config();
} catch (e) {
  // Dotenv fallback
}

const app = require('./app');
const { initDb } = require('./config/database');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await initDb();

    app.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(` DEVFORGE AI - AI DATABASE DESIGNER BACKEND`);
      console.log(` Running on: http://localhost:${PORT}`);
      console.log(` Health Check: http://localhost:${PORT}/api/health`);
      console.log(`==================================================`);
    });
  } catch (err) {
    console.error('Failed to start backend server:', err.message);
    process.exit(1);
  }
};

startServer();
