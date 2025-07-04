const express = require('express');
const fs = require('fs');
const getOpenPosition = require('../scripts/getOpenPosition.js');

const router = express.Router();

router.get('/getOpenPosition', async (req, res) => {
  const configData = await fs.readFileSync('./config.json', 'utf8');
  const config = JSON.parse(configData);
  const openPositions = await getOpenPosition(config);
  res.status(200).json({ message: openPositions });
});

module.exports = router;
