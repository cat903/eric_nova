const db = require('../database.js');

async function backfillProfitLoss() {
  console.log('Starting backfill of profit/loss...');

  db.all('SELECT * FROM orders WHERE status = ? AND profitLossAmount IS NULL ORDER BY createdTime ASC', ['Filled'], async (err, rows) => {
    if (err) {
      console.error('Error fetching orders for backfill:', err);
      return;
    }

    if (rows.length === 0) {
      console.log('No filled orders found requiring profit/loss backfill.');
      return;
    }

    const unprocessedOrders = [...rows];
    const processedOrderIds = new Set();

    for (let i = 0; i < unprocessedOrders.length; i++) {
      const order1 = unprocessedOrders[i];

      if (processedOrderIds.has(order1.orderId)) {
        continue; // Skip if already processed as part of a pair
      }

      // Find a matching order (opposite side, same symbol, later time)
      for (let j = i + 1; j < unprocessedOrders.length; j++) {
        const order2 = unprocessedOrders[j];

        if (processedOrderIds.has(order2.orderId)) {
          continue; // Skip if already processed
        }

        if (order1.symbol === order2.symbol && order1.side !== order2.side) {
          // Found a potential pair
          const entryOrder = new Date(order1.createdTime) < new Date(order2.createdTime) ? order1 : order2;
          const exitOrder = new Date(order1.createdTime) < new Date(order2.createdTime) ? order2 : order1;

          // For simplicity, assume full closure for the minimum quantity
          const lotSize = Math.min(entryOrder.quantity, exitOrder.quantity);

          if (lotSize > 0) {
            let profitLossRaw = 0;
            const entryPrice = entryOrder.price; // Use 'price' from DB for backfill
            const exitPrice = exitOrder.price;   // Use 'price' from DB for backfill

            if (entryOrder.side === 'SELL') { // Short position: Sold first, then bought to cover
                profitLossRaw = entryPrice - exitPrice;
            } else if (entryOrder.side === 'BUY') { // Long position: Bought first, then sold to close
                profitLossRaw = exitPrice - entryPrice;
            }

            const profitLossResult = profitLossRaw >= 0 ? "Profit" : "Loss";
            const profitLossAmount = (Math.abs(profitLossRaw) * 25 * lotSize);

            if (profitLossAmount !== undefined && profitLossResult) {
              db.run(
                'UPDATE orders SET profitLossAmount = ?, profitLossResult = ? WHERE orderId = ?',
                [profitLossAmount, profitLossResult, entryOrder.orderId],
                function(err) {
                  if (err) console.error('Error updating entry order P/L:', err);
                  else console.log(`Backfilled P/L for entry order ${entryOrder.orderId}: ${profitLossResult} ${profitLossAmount}`);
                }
              );
              db.run(
                'UPDATE orders SET profitLossAmount = ?, profitLossResult = ? WHERE orderId = ?',
                [profitLossAmount, profitLossResult, exitOrder.orderId],
                function(err) {
                  if (err) console.error('Error updating exit order P/L:', err);
                  else console.log(`Backfilled P/L for exit order ${exitOrder.orderId}: ${profitLossResult} ${profitLossAmount}`);
                }
              );

              processedOrderIds.add(entryOrder.orderId);
              processedOrderIds.add(exitOrder.orderId);
              break; // Move to the next unprocessed order1
            }
          }
        }
      }
    }
    console.log('Profit/loss backfill complete.');
  });
}

backfillProfitLoss();
