const express = require('express');
const path = require('path');
const getOpenPosition = require('./scripts/getOpenPosition.js');
const db = require('./database.js');
const { Worker } = require('worker_threads');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

function spawnWorker(scriptPath, data) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(scriptPath, { workerData: data });

        worker.on('message', (message) => {
            console.log(`Worker finished with message: ${message}`);
            resolve(message);
        });

        worker.on('error', (error) => {
            console.error(`Worker error: ${error}`);
            reject(error);
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                console.error(`Worker exited with code ${code}`);
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

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
