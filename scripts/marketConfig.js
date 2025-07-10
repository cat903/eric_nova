const moment = require('moment-timezone');

const MARKET_TIMEZONE = "Asia/Kuala_Lumpur";

const CLOSING_TIMES = [
  { day: 1, times: ["12:30", "18:00", "23:30"] }, // Monday
  { day: 2, times: ["12:30", "18:00", "23:30"] }, // Tuesday
  { day: 3, times: ["12:30", "18:00", "23:30"] }, // Wednesday
  { day: 4, times: ["12:30", "18:00", "23:30"] }, // Thursday
  { day: 5, times: ["12:30", "18:00"] },          // Friday (No night market)
];

const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MINUTE = 30;
const MARKET_CLOSE_HOUR = 16;
const MARKET_CLOSE_MINUTE = 0;

module.exports = {
  MARKET_TIMEZONE,
  CLOSING_TIMES,
  MARKET_OPEN_HOUR,
  MARKET_OPEN_MINUTE,
  MARKET_CLOSE_HOUR,
  MARKET_CLOSE_MINUTE,
};