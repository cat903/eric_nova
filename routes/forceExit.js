const express = require('express');
const fs = require('fs');

const router = express.Router();

const CONTROL_FILE = './autoshutoff.control';

router.get('/enableForceExit', (req, res) => {
  fs.writeFileSync(CONTROL_FILE, 'ENABLED');
  console.log('✅ Auto Force Exit ENABLED');
  res.status(200).json({ message: '✅ Auto Force Exit ENABLED' });
});

router.get('/disableForceExit', (req, res) => {
  if (fs.existsSync(CONTROL_FILE)) {
    fs.unlinkSync(CONTROL_FILE);
  }
  console.log('⛔ Auto Force Exit Disabled');
  res.status(200).json({ message: '⛔ Auto Force Exit Disabled' });
});

module.exports = router;
