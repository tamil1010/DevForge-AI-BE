try {
  require('dotenv').config();
} catch (e) {
  // Dotenv fallback
}

const mongoose = require('mongoose');
const app = require('./app');
const { initDb } = require('./config/database');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    if (process.env.MONGODB_URI) {
      mongoose.connect(process.env.MONGODB_URI, { family: 4 })
        .then(() => console.log("MongoDB Connected"))
        .catch(err => console.error("MongoDB Connection Error:", err.message));
    }

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
