const express = require('express');
const path = require('path');
require('dotenv').config();
const bcrypt = require('bcrypt');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const cookieParser = require('cookie-parser');
const getOpenPosition = require('./scripts/getOpenPosition.js');
const getOrderHistory = require('./scripts/getOrderHistory.js');
const db = require('./database.js');
const { Worker } = require('worker_threads');
const fs = require('fs');
const { exec } = require('child_process');


const app = express();
const port = 3000;

app.set('trust proxy', 1); // Trust Nginx as a proxy

app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecretkey',
  resave: false,
  saveUninitialized: false,
  store: new SQLiteStore({ db: 'sessions.db', dir: __dirname }), // Store sessions in sessions.db
  cookie: { secure: process.env.NODE_ENV === 'production', sameSite: 'Lax' } // Set secure to true in production for HTTPS, add sameSite
}));
app.use(express.static(path.join(__dirname)));

const activeWorkers = new Set();

function spawnWorker(scriptPath, data) {
    const workerKey = `${data.algoName || 'default'}-${data.type}`;

    if (activeWorkers.has(workerKey)) {
        console.log(`Worker for ${workerKey} is already active. Skipping.`);
        return Promise.resolve('Worker already active');
    }

    activeWorkers.add(workerKey);

    return new Promise((resolve, reject) => {
        const worker = new Worker(scriptPath, { workerData: data });

        worker.on('message', (message) => {
            console.log(`Worker finished with message: ${message}`);
            activeWorkers.delete(workerKey);
            resolve(message);
        });

        worker.on('error', (error) => {
            console.error(`Worker error: ${error}`);
            activeWorkers.delete(workerKey);
            reject(error);
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`Worker exited with code ${code}`);
                activeWorkers.delete(workerKey);
                reject(new Error(`Worker exited with code ${code}`));
            }
        });
    });
}

function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
}

// Middleware to check for API key authentication
function isApiKeyAuthenticated(req, res, next) {
  const apiKey = req.headers['x-api-key']; // Assuming API key is sent in a custom header
  if (!apiKey || apiKey !== process.env.WEBHOOK_API_KEY) {
    return res.status(401).json({ message: 'Unauthorized: Invalid API Key' });
  }
  next();
}

app.get('/', (req, res) => {
  if (req.session.userId) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.redirect('/login.html');
  }
});

app.post('/register', async (req, res) => {
  if (process.env.ALLOW_REGISTRATION === 'false' || process.env.ALLOW_REGISTRATION === '0') {
    return res.status(403).json({ message: 'User registration is currently disabled.' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ message: 'User already exists.' });
        }
        console.error('Error registering user:', err);
        return res.status(500).json({ message: 'Error registering user.' });
      }
      res.status(201).json({ message: 'User registered successfully.' });
    });
  } catch (error) {
    console.error('Error hashing password:', error);
    res.status(500).json({ message: 'Error registering user.' });
  }
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      console.error('Error fetching user:', err);
      return res.status(500).json({ message: 'Error logging in.' });
    }
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (match) {
      req.session.userId = user.id;
      console.log('User logged in. Session ID:', req.session.id, 'User ID:', req.session.userId);
      res.json({ message: 'Logged in successfully.' });
    } else {
      res.status(400).json({ message: 'Invalid credentials.' });
    }
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ message: 'Error logging out.' });
    }
    res.json({ message: 'Logged out successfully.' });
  });
});

app.post('/signal', isApiKeyAuthenticated, async (req, res) => {
    const webhookData = req.body;
    console.log('Received webhook:', webhookData);
    if (webhookData.type === '-1' || webhookData.type === '1') {
        console.log('Spawning worker for entry action...');
        await spawnWorker('./scripts/marketentry_worker.js', webhookData);
    }
    if (webhookData.type === '0') {
        console.log('Spawning worker for exit action...');
        await spawnWorker('./scripts/marketexit_worker.js', webhookData);
    }

    res.status(200).json({ message: 'Webhook processed successfully!' });
});

app.get('/api/open-positions', isAuthenticated, async (req, res) => {
  try {
    const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    const openPositions = await getOpenPosition(config);
    res.json(openPositions);
  } catch (error) {
    console.error('Error getting open positions:', error);
    res.status(500).json({ error: 'Failed to get open positions' });
  }
});

app.get('/api/order-history', isAuthenticated, (req, res) => {
  const { date } = req.query;
  let query = 'SELECT * FROM orders';
  const params = [];

  if (date) {
    query += ' WHERE DATE(createdTime) = ?';
    params.push(date);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error getting order history:', err);
      res.status(500).json({ error: 'Failed to get order history' });
      return;
    }
    res.json(rows);
  });
});

async function fetchOrderHistory() {
  try {
    const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    const orders = await getOrderHistory(config);

    if (orders && Array.isArray(orders) && orders.length > 0) {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO orders (
          orderId, symbol, side, orderType, quantity, price, status, createdTime, tradeId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      orders.forEach(order => {
        stmt.run(
          order.OrderId,
          order.SeriesTradeCode,
          order.BuySell === 1 ? 'BUY' : 'SELL',
          order.OrderTypeDesc,
          order.FilledQuantity,
          order.AveragePrice,
          order.OrderStatusDesc,
          order.OrderSubmissionDt,
          order.TradeId
        );
      });
      stmt.finalize();
    }
  } catch (error) {
    console.error('Error fetching and saving order history:', error);
  }
}

function scheduleOrderHistoryFetch() {
  fetchOrderHistory();
  setTimeout(scheduleOrderHistoryFetch, 2 * 60 * 1000); // Check every 2 minutes
}

app.get('/api/autoshutoff/status', isAuthenticated, (req, res) => {
  const controlFilePath = path.join(__dirname, 'autoshutoff.control');
  const isEnabled = fs.existsSync(controlFilePath);
  res.json({ enabled: isEnabled });
});

app.post('/api/autoshutoff/toggle', isAuthenticated, (req, res) => {
  const { enable } = req.body;
  const controlFilePath = path.join(__dirname, 'autoshutoff.control');

  try {
    if (enable) {
      fs.writeFileSync(controlFilePath, 'enabled');
      console.log('Autoshutoff enabled.');
    } else {
      fs.unlinkSync(controlFilePath);
      console.log('Autoshutoff disabled.');
    }

    // Restart PM2 process for force_exit to apply changes
    exec('pm2 restart force_exit', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error restarting PM2 process: ${error.message}`);
        return res.status(500).json({ success: false, message: 'Failed to restart PM2 process.', error: error.message });
      }
      if (stderr) {
        console.warn(`PM2 restart stderr: ${stderr}`);
      }
      console.log(`PM2 restart stdout: ${stdout}`);
      res.json({ success: true, message: `Autoshutoff ${enable ? 'enabled' : 'disabled'} and PM2 process restarted.` });
    });

  } catch (error) {
    console.error('Error toggling autoshutoff:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle autoshutoff.', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  scheduleOrderHistoryFetch();
});
