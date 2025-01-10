const fetch = require('node-fetch');

const url = 'https://demo.phillipmobile.com/MobileControlService.svc/GetOpenPositionList';

const headers = {
  Accept: '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Content-Type': 'application/json',
  Priority: 'u=1, i',
  'Sec-CH-UA': '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-CH-UA-Mobile': '?0',
  'Sec-CH-UA-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'X-Requested-With': 'XMLHttpRequest',
  Referer: 'https://demo.phillipmobile.com/desktop/order_history_trade.html?v5',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};


const requestBody = {
  Language: 'EN',
  SubAccount: null,
};


async function getOpenPositionList(config) {
  headers['X-Session-IV'] = config.xSessionIv;
  requestBody.Token = config.token;
  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody),
  });
  const result = (await response.json());
  const openPositions = result.GetOpenPositionListResult.Item1;
  return openPositions;
};

// (async function () {
//   const openPositions = await getOpenPositionList();
//   console.log(openPositions.length === 0)
// })()

module.exports = getOpenPositionList