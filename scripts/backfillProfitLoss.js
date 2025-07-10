const db = require('../database.js');

// Helper to "promisify" db.all, making it compatible with async/await
const dbAllAsync = (sql, params) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Helper to "promisify" db.run
const dbRunAsync = (sql, params) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

/**
 * Calculates profit/loss for trades and logs them to the 'realized_trades' table.
 * This function is idempotent and can be run multiple times.
 * It handles partial fills and both long and short positions.
 */
async function backfillProfitLoss() {
  console.log('Starting backfill of profit/loss...');

  // Create the logging table if it doesn't already exist.
  // This makes the script safe and reliable.
  await dbRunAsync(`
    CREATE TABLE IF NOT EXISTS realized_trades (
      tradeId INTEGER PRIMARY KEY AUTOINCREMENT,
      entryOrderId TEXT NOT NULL,
      exitOrderId TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      profitLossAmount REAL NOT NULL,
      profitLossResult TEXT NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Select all filled orders.
  const orders = await dbAllAsync(
    `SELECT * FROM orders 
     WHERE status = ? 
     ORDER BY createdTime ASC`,
    ['Filled']
  );
  
  if (orders.length < 2) {
    console.log('Not enough new filled orders to form a trade pair.');
    return;
  }
  
  // Track remaining quantities for each order to handle partial fills.
  const remainingQuantities = new Map(orders.map(o => [o.orderId, o.quantity]));

  for (const entryOrder of orders) {
    let entryRemaining = remainingQuantities.get(entryOrder.orderId);

    // Skip if this order has already been fully processed in this run
    if (entryRemaining <= 0) {
      continue;
    }

    // Find subsequent orders to match against
    for (const exitOrder of orders) {
      let exitRemaining = remainingQuantities.get(exitOrder.orderId);
      
      // Conditions for a valid pair
      const isMatch = exitRemaining > 0 &&
                      entryOrder.symbol === exitOrder.symbol &&
                      entryOrder.side !== exitOrder.side &&
                      new Date(exitOrder.createdTime) > new Date(entryOrder.createdTime);

      if (isMatch) {
        const tradeQuantity = Math.min(entryRemaining, exitRemaining);

        const profitLossRaw = (entryOrder.side === 'BUY')
          ? (exitOrder.price - entryOrder.price)  // Long trade
          : (entryOrder.price - exitOrder.price); // Short trade

        const profitLossAmount = profitLossRaw * 25 * tradeQuantity;
        const profitLossResult = profitLossAmount >= 0 ? "Profit" : "Loss";
        
        // Log the realized trade into the 'realized_trades' table.
        await dbRunAsync(
          `INSERT INTO realized_trades (entryOrderId, exitOrderId, quantity, profitLossAmount, profitLossResult) VALUES (?, ?, ?, ?, ?)`,
          [entryOrder.orderId, exitOrder.orderId, tradeQuantity, profitLossAmount, profitLossResult]
        );
        console.log(`Logged trade: ${tradeQuantity} units between ${entryOrder.orderId} and ${exitOrder.orderId}. P/L: ${profitLossAmount}`);
        
        // Update the remaining quantities in our map.
        entryRemaining -= tradeQuantity;
        exitRemaining -= tradeQuantity;
        remainingQuantities.set(entryOrder.orderId, entryRemaining);
        remainingQuantities.set(exitOrder.orderId, exitRemaining);

        // If the entry order is fully matched, break to find a match for the next entry order.
        if (entryRemaining <= 0) {
          break; 
        }
      }
    }
  }

  console.log('Profit/loss backfill complete.');
}

// Run the function and catch any potential errors.
backfillProfitLoss().catch(err => {
  console.error("An error occurred during the backfill process:", err);
});