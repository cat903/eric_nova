const { parentPort, workerData } = require('worker_threads');
const getOpenPosition = require('./getOpenPosition.js');
const marketOrder = require('./marketOrder.js');
const sendtoDiscord = require('./sendtoDiscord.js');
const moment = require('moment-timezone');

async function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

async function logAndNotify(message) {
  console.log(message);
  await sendtoDiscord(message);
}

async function checkOpenPositions(action, symbol, entryPrice) {
  const openPositions = await getOpenPosition(require('./config.json'));
  if (openPositions?.length !== 0 && openPositions?.length !== 1) {
    const errorMessage = `demo nova server timed out, rejected action ->-> ${action} ->-> ${symbol}@${entryPrice}`;
    await logAndNotify(errorMessage);
    return null;
  }
  return openPositions;
}

async function processEntryCompletion(action, symbol, entryPrice, openPositions) {
  if (openPositions.length === 1) {
    const timestamp = moment().tz("Asia/Kuala_Lumpur").format('YYYY-MM-DD HH:mm:ss');
    const successMessage = `${timestamp} ->-> filled entry ->-> ${action} ->-> ${symbol}@${openPositions[0].AveragePrice}`;
    await logAndNotify(successMessage);

    console.log('Entry filled successfully!');
    return true;
  }
  return false;
}

async function executeMarketEntryAction(data) {
  const openPositions = await checkOpenPositions(data.action, data.symbol, data.entryPrice);

  if (!openPositions) return 'Entry action failed: could not get open positions';

  if (openPositions.length === 0) {
    await marketOrder(data.action, require('./config.json'), data.seriesCode);
    await logAndNotify(`Asking For Entry ->-> ${data.action} ->-> ${data.symbol}@${data.entryPrice}`);
    await delay(15000);

    const refreshedOpenPositions = await checkOpenPositions(data.action, data.symbol, data.entryPrice);
    if (!refreshedOpenPositions) return 'Entry action failed: could not get refreshed open positions';

    const success = await processEntryCompletion(data.action, data.symbol, data.entryPrice, refreshedOpenPositions);
    return success ? 'Entry attempt completed successfully!' : 'Entry attempt failed: could not fill the order';
  }

  return 'Entry action not required: position already open';
}

executeMarketEntryAction(workerData)
  .then((result) => parentPort.postMessage(result))
  .catch((error) => {
    parentPort.postMessage(`Error in entry action: ${error.message}`);
    process.exit(1);
  });
