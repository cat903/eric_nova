const express = require('express');
const fs = require('fs');
const { spawnWorker } = require('../utils/workerUtils');

const router = express.Router();

const CONTROL_FILE = './autoshutoff.control';

router.get('/', (req, res) => {
  let forceExitStatus;
  if (fs.existsSync(CONTROL_FILE)) {
    forceExitStatus = '✅ Auto Force Exit ON';
  } else {
    forceExitStatus = '⛔ Auto Force Exit OFF';
  }

  res.status(200).json({ message: `server running, ${forceExitStatus}` });
});

router.post('/signal', async (req, res) => {
  const webhookData = req.body;
  // Process the webhook data as needed
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

module.exports = router;
