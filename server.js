const express = require('express');
const helmet = require('helmet');

const app = express();

// Import routes
const mainRoutes = require('./routes/main');
const forceExitRoutes = require('./routes/forceExit');
const openPositionRoutes = require('./routes/openPosition');

// Middleware to set security HTTP headers
app.use(helmet());

// Middleware to parse JSON bodies
app.use(express.json());

// Use routes
app.use('/', mainRoutes);
app.use('/', forceExitRoutes);
app.use('/', openPositionRoutes);

// Handle undefined routes (404)
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global error handler (500)
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start the server on port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
