const express = require('express');
const path = require('path');
require('dotenv').config();
const getOpenPosition = require('./scripts/getOpenPosition.js');
const getOrderHistory = require('./scripts/getOrderHistory.js');
const db = require('./database.js');
const { Worker } = require('worker_threads');
const fs = require('fs');


const app = express();
const port = 3000;

app.use(express.json());
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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/signal', async (req, res) => {
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

app.get('/api/open-positions', async (req, res) => {
  try {
    const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    const openPositions = await getOpenPosition(config);
    res.json(openPositions);
  } catch (error) {
    console.error('Error getting open positions:', error);
    res.status(500).json({ error: 'Failed to get open positions' });
  }
});

app.get('/api/order-history', (req, res) => {
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

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  scheduleOrderHistoryFetch();
});
