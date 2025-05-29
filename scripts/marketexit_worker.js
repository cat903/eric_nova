const { parentPort, workerData } = require('worker_threads');
const getOpenPosition = require('./getOpenPosition.js');
const marketOrder = require('./marketOrder.js');
const getOrderHistory = require('./getOrderHistory.js');
const calculateProfitLoss = require('./calculateProfitLoss.js');
const sendtoDiscord = require('./sendtoDiscord.js');
const moment = require('moment-timezone');
require('dotenv').config();

async function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

async function logAndNotify(message) {
  console.log(message);
  await sendtoDiscord(message);
}

async function getConfirmedOrderHistoryWithRetry(config, expectedSymbol, expectedAction, algoName, maxRetries = 6, retryDelayMs = 5000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const orderHistory = await getOrderHistory(config);
      if (orderHistory && orderHistory.length > 0) {
        const relevantOrder = orderHistory.find(order => order.Symbol === expectedSymbol && (order.BuySell === (expectedAction === 'buy' ? 1 : 2)) && order.OrderStatusDesc === 'Filled');
        if (relevantOrder) {
          if (orderHistory.length >= 2) {
            return orderHistory;
          }
        }
      }
    } catch (error) {
      await logAndNotify(`Error fetching order history for ${algoName} on attempt ${attempt}: ${error.message}`);
    }
    if (attempt < maxRetries) {
      await delay(retryDelayMs);
    }
  }
  return null;
}

async function checkOpenPositions(action, symbol, entryPrice, retryn = 3, algoName) {
  const openPositions = await getOpenPosition(require('../config.json'));
  if ((openPositions?.length !== 0 && openPositions?.length !== 1) && retryn > 0) {
    const errorMessage = `${retryn} ${process.env.PLATFORM} server timed out, rejected exit ->-> ${algoName} ->-> ${action} ->-> ${symbol}@${entryPrice}`;
    await logAndNotify(errorMessage);
    await delay(5000);
    return checkOpenPositions(action, symbol, entryPrice, --retryn, algoName);
  }
  return openPositions;
}

async function processExitCompletion(action, symbol, entryPrice, status, openPositions, algoName) {
  if (!openPositions?.length) {
    const timestamp = moment().tz("Asia/Kuala_Lumpur").format('YYYY-MM-DD HH:mm:ss');
    const confirmedOrderHistory = await getConfirmedOrderHistoryWithRetry(require('../config.json'), symbol, action, algoName);
    if (!confirmedOrderHistory) {
      const failureMessage = `${timestamp} ->-> ${algoName} ->-> Exit for ${symbol} appears complete (no open positions), but FAILED TO CONFIRM in order history. P/L calculation SKIPPED.`;
      await logAndNotify(failureMessage);
      return true;
    }
    const profitLoss = calculateProfitLoss(confirmedOrderHistory, status);
    const successMessage = `${timestamp} ->-> ${algoName} ->-> filled exit ->-> ${action} ->-> ${symbol}@${profitLoss.top}`;
    await logAndNotify(successMessage);
    const profitLossMessage = `${profitLoss?.result} -> RM ${profitLoss?.amount}`;
    await logAndNotify(profitLossMessage);
    console.log('Exit action completed successfully');
    return true;
  } else {
    const failureMessage = `Could not fill exit order, rejected exit ->-> ${algoName} ->-> ${action} ->-> ${symbol}@${entryPrice}`;
    await logAndNotify(failureMessage);
    console.log('Exit action failed, market order failed');
    return false;
  }
}

async function executeMarketExitAction(data) {
  sendtoDiscord(`Asking For Exit ->-> ${data?.algoName} ->-> ${data.action} ->-> ${data.symbol}@${data.entryPrice} --> LotSize ${data.lotSize}`);
  const openPositions = await checkOpenPositions(data.action, data.symbol, data.entryPrice, undefined, data?.algoName);
  if (!openPositions) { console.log('checkifsessioninvalid', openPositions); return 'sessionexpired in nova platform' };
  if (openPositions.length === 0) { return `no open order in ${process.env.PLATFORM} platform` }
  if (!(openPositions[0]?.OpenQuantity)) { console.log('nova changed something', openPositions) }; //remove later
  const entryStatus = (openPositions[0]?.OpenQuantity < 0) ? 'sell' : 'buy';
  const oppositeStatus = data.action !== entryStatus
  console.log(`entryStatus:${entryStatus},exitStatus:${data.action},isitOpposite:${oppositeStatus}, positionOpen:${openPositions.length === 1}, procceding exit:${((openPositions.length === 1) && (oppositeStatus))}`);
  if (openPositions.length === 1 && oppositeStatus) {
    await marketOrder(data?.action, require('../config.json'), data?.seriesCode, data?.lotSize);
    let refreshedOpenPositions = null;
    for (let i = 0; i < 5; i++) {
      refreshedOpenPositions = await checkOpenPositions(data.action, data.symbol, data.entryPrice, 0, data?.algoName);
      if (refreshedOpenPositions && refreshedOpenPositions.length === 0) {
        break;
      }
      await delay(3000);
    }
    if (!refreshedOpenPositions) return 'Exit action failed: could not get refreshed open positions';
    await processExitCompletion(data.action, data.symbol, data.entryPrice, entryStatus, refreshedOpenPositions, data?.algoName);
  }
}

executeMarketExitAction(workerData)
  .then((result) => parentPort.postMessage(result || 'Exit attempt completed successfully!'))
  .catch((error) => {
    parentPort.postMessage(`Error in exit action: ${error.message}`);
    process.exit(1);
  });
