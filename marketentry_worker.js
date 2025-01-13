const { parentPort, workerData } = require('worker_threads');
const getOpenPosition = require('./getOpenPosition.js');
const marketOrder = require('./marketOrder.js');
const sendtoDiscord = require('./sendtoDiscord.js');
const moment = require('moment');

async function delay(time) { return new Promise(function (resolve) { setTimeout(resolve, time) }) };

async function executeMarketEntryAction(data) {
    const openPositions = await getOpenPosition(require('./config.json'));
    const status = data.type === '-1' ? 'short' : 'long'
    if (openPositions.length === 0) {
        const resultofOrder = await marketOrder(data.action,require('./config.json'));
        await sendtoDiscord(`entry ->-> ${data.action} ->-> ${data.symbol}@${data.entryPrice}`);
        await delay(15000);
        const openPositions = await getOpenPosition(require('./config.json'));
        if(openPositions.length === 1){
            await sendtoDiscord(`${moment().tz("Asia/Kuala_Lumpur").format('YYYY-MM-DD HH:mm:ss')} ->-> filled entry ->-> ${data.action} ->-> ${data.symbol}@${openPositions[0].AveragePrice}`);
        }
        else{
            await sendtoDiscord(`${moment().tz("Asia/Kuala_Lumpur").format('YYYY-MM-DD HH:mm:ss')} ->-> failed to fill entry ->-> ${data.action} ->-> ${data.symbol}@${data.entryPrice}`);
        }
    }
    return 'entry action completed successfully!';
}

executeMarketEntryAction(workerData)
    .then((result) => parentPort.postMessage(result))
    .catch((error) => {
        parentPort.postMessage(`Error in entry action: ${error.message}`);
        process.exit(1);
    });
