try {
  require('dotenv').config();
} catch (e) {
  // Dotenv fallback
}

const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const app = require('./app');
const { initDb } = require('./config/database');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await initDb();

    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: '*',
        credentials: true
      }
    });

    app.set('io', io);

    io.on('connection', (socket) => {
      socket.on('join:contest', (contestId) => {
        socket.join(`contest:${contestId}`);
      });
    });

    server.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(` DEVFORGE AI PLATFORM BACKEND (All Modules Active)`);
      console.log(` - AI Database Designer`);
      console.log(` - AI Code Generator (Core)`);
      console.log(` - CodeArena (Competitive Programming & Judge0)`);
      console.log(` Running on: http://localhost:${PORT}`);
      console.log(` Health Check: http://localhost:${PORT}/api/health`);
      console.log(` Socket.IO: Initialized`);
      console.log(`==================================================`);
    });
  } catch (err) {
    console.error('Failed to start backend server:', err.message);
    process.exit(1);
  }
};

startServer();
