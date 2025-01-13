const { parentPort, workerData } = require('worker_threads');
const getOpenPosition = require('./getOpenPosition.js');
const marketOrder = require('./marketOrder.js');
const getOrderHistory = require('./getOrderHistory.js');
const calculateProfitLoss = require('./calculateProfitLoss.js');
const sendtoDiscord = require('./sendtoDiscord.js');
const moment = require('moment-timezone');

async function delay(time) { return new Promise(function (resolve) { setTimeout(resolve, time) }) };

async function executeMarketExitAction(data) {
  const openPositions = await getOpenPosition(require('./config.json'));
  const status = data.action === 'buy' ? 'short' : 'long';
  if (openPositions?.length === 1) {
    const resultofOrder = await marketOrder(data.action,require('./config.json'),data.seriesCode);
    await sendtoDiscord(`exit ->-> ${data.action} ->-> ${data.symbol}@${data.entryPrice}`);
    await delay(15000);
    const openPositions = await getOpenPosition(require('./config.json'));
    if (openPositions?.length === 0){
      await sendtoDiscord(`${moment().tz("Asia/Kuala_Lumpur").format('YYYY-MM-DD HH:mm:ss')} ->-> filled exit ->-> ${data.action} ->-> ${data.symbol}@${openPositions[0].AveragePrice}`);
      const orderHistory = await getOrderHistory(require('./config.json'));
      const profitLoss = calculateProfitLoss(orderHistory,status);
      await sendtoDiscord(`${profitLoss?.result} -> RM ${profitLoss?.amount}`);
      console.log('exit action completed successfully');
    }
    else{
      await sendtoDiscord(`trade rejected exit ->-> ${data.action} ->-> ${data.symbol}@${data.entryPrice}`);
      console.log('exit action failed trade rejected');
    }
    return 'exit attempt completed successfully!';
  }
}

executeMarketExitAction(workerData)
  .then((result) => parentPort.postMessage(result))
  .catch((error) => {
    parentPort.postMessage(`Error in exit action: ${error.message}`);
    process.exit(1);
  });
