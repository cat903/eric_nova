const moment = require('moment-timezone');
const getOpenPosition = require('./getOpenPosition.js');
const marketOrder = require('./marketOrder.js');
const getOrderHistory = require('./getOrderHistory.js');
const calculateProfitLoss = require('./calculateProfitLoss.js');
const sendtoDiscord = require('./sendtoDiscord.js');


async function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

async function logAndNotify(message) {
  console.log(message);
  await sendtoDiscord(message);
}

async function checkOpenPositions() {
  const openPositions = await getOpenPosition(require('./config.json'));
  if (openPositions?.length !== 0 && openPositions?.length !== 1) {
    const errorMessage = `demo nova server timed out, rejected force exit`;
    await logAndNotify(errorMessage);
    return null;
  }
  return openPositions;
}


async function processExitCompletion(action, symbol, status, openPositions) {
  if (!openPositions?.length) {
    const timestamp = moment().tz("Asia/Kuala_Lumpur").format('YYYY-MM-DD HH:mm:ss');
    const orderHistory = await getOrderHistory(require('./config.json'));
    const profitLoss = calculateProfitLoss(orderHistory, status);
    const successMessage = `${timestamp} ->-> filled force exit ->-> ${action} ->-> ${symbol}@${profitLoss.top}`;
    await logAndNotify(successMessage);
    const profitLossMessage = `${profitLoss?.result} -> RM ${profitLoss?.amount}`;
    await logAndNotify(profitLossMessage);
    console.log('Exit action completed successfully');
    return true;
  } else {
    const failureMessage = `Could not fill force exit order, rejected exit ->-> ${action} ->-> ${symbol}`;
    await logAndNotify(failureMessage);
    console.log('Force Exit action failed, market order failed');
    return false;
  }
}

async function executeForceMarketExitAction() {
  const openPositions = await checkOpenPositions();
  if (!openPositions) return;
  const tradeInfo = openPositions[0]
  const action = tradeInfo?.OpenQuantity === '-1.0' ? 'buy' : 'sell';
  const status = tradeInfo?.OpenQuantity === '-1.0' ? 'sell' : 'buy';

  if (openPositions.length === 1) {
    await marketOrder(action, require('./config.json'), tradeInfo.SeriesCode);
    await logAndNotify(`Asking For Force Exit ->-> ${action} ->-> ${tradeInfo.SeriesTradeCode}`);
    await delay(15000);

    const refreshedOpenPositions = await checkOpenPositions();
    await processExitCompletion(action,tradeInfo.SeriesTradeCode, status, refreshedOpenPositions);
  }
}



// Market closing times
const closingTimes = [
    { day: 1, times: ["12:27", "17:55", "23:25"] }, // Monday
    { day: 2, times: ["12:27", "17:55", "23:25"] }, // Tuesday
    { day: 3, times: ["12:27", "17:55", "23:25"] }, // Wednesday
    { day: 4, times: ["12:25", "17:55", "23:25"] }, // Thursday
    { day: 5, times: ["12:25", "17:55"] },          // Friday (No night market)
];

function checkMarketClosing() {
    const now = moment().tz("Asia/Kuala_Lumpur");
    const currentDay = now.isoWeekday(); // Monday = 1, Sunday = 7
    const currentTime = now.format('HH:mm');

    const marketDay = closingTimes.find(day => day.day === currentDay);
    if (!marketDay) return; // No market today (Saturday/Sunday)

    marketDay.times.forEach(closingTime => {
        const closingMoment = moment.tz(`${now.format('YYYY-MM-DD')} ${closingTime}`, "Asia/Kuala_Lumpur");
        const diffMinutes = closingMoment.diff(now, 'minutes');

        if (diffMinutes >= 0 && diffMinutes <= 30) {
            console.log(`Market closing soon (${closingTime}), calling close()...`);
            executeForceMarketExitAction()
        }
    });
}

// Run check every minute
checkMarketClosing();
