const { parentPort, workerData } = require('worker_threads');
const getOpenPosition = require('./getOpenPosition.js');
const marketOrder = require('./marketOrder.js');
const getOrderHistory = require('./getOrderHistory.js');
const calculateProfitLoss = require('./calculateProfitLoss.js');
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
    const errorMessage = `demo nova server timed out, rejected exit ->-> ${action} ->-> ${symbol}@${entryPrice}`;
    await logAndNotify(errorMessage);
    return null;
  }
  return openPositions;
}

async function processExitCompletion(action, symbol, entryPrice, status, openPositions) {
  if (!openPositions?.length) {
    const timestamp = moment().tz("Asia/Kuala_Lumpur").format('YYYY-MM-DD HH:mm:ss');
    const orderHistory = await getOrderHistory(require('./config.json'));
    const profitLoss = calculateProfitLoss(orderHistory, status);
    const successMessage = `${timestamp} ->-> filled exit ->-> ${action} ->-> ${symbol}@${profitLoss.top}`;
    await logAndNotify(successMessage);
    const profitLossMessage = `${profitLoss?.result} -> RM ${profitLoss?.amount}`;
    await logAndNotify(profitLossMessage);
    console.log('Exit action completed successfully');
    return true;
  } else {
    const failureMessage = `Could not fill exit order, rejected exit ->-> ${action} ->-> ${symbol}@${entryPrice}`;
    await logAndNotify(failureMessage);
    console.log('Exit action failed, market order failed');
    return false;
  }
}

async function executeMarketExitAction(data) {
  const openPositionList = await checkOpenPositions(data.action, data.symbol, data.entryPrice);
  if (!openPositionList) return;
  const openPositions = openPositionList?.GetOpenPositionListResult?.Item1[0]?.OpenQuantity || openPositionList[0]?.OpenQuantity  
  const entryStatus = (openPositions<0) ? 'sell' : 'buy';
  const oppositeStatus = data.action !== entryStatus;
  console.log(`entryStatus:${entryStatus},exitStatus:${data.action},isitOpposite:${oppositeStatus}, positionOpen:${openPositionList.length >= 1}, procceding exit:${((openPositionList.length >= 1) && (oppositeStatus))}`);
  if ((openPositionList.length >= 1) && (oppositeStatus)) {
    await marketOrder(data.action, require('./config.json'), data.seriesCode);
    await logAndNotify(`Asking For Exit ->-> ${data.action} ->-> ${data.symbol}@${data.entryPrice}`);
    await delay(15000);

    const refreshedOpenPositions = await checkOpenPositions(data.action, data.symbol, data.entryPrice);
    if (!refreshedOpenPositions) return;

    await processExitCompletion(data.action, data.symbol, data.entryPrice, entryStatus, refreshedOpenPositions);
  }
}

executeMarketExitAction(workerData)
  .then((result) => parentPort.postMessage(result || 'Exit attempt completed successfully!'))
  .catch((error) => {
    parentPort.postMessage(`Error in exit action: ${error.message}`);
    process.exit(1);
  });
