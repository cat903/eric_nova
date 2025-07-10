const getOrderHistory = require('./getOrderHistory');
const db = require('../database');
const config = require('../config.json');

async function archiveOrders() {
  try {
    const orders = await getOrderHistory(config);
    if (!orders || !Array.isArray(orders)) {
      console.log('No orders to archive.');
      return;
    }

    db.serialize(() => {
      const stmt = db.prepare(`INSERT INTO orders (
        orderId, clientOrderId, symbol, side, orderType, quantity, price, stopPrice, timeInForce, status,
        icebergQuantity, time, updateTime, isWorking, accountId, lastExecutedQuantity, lastExecutedPrice,
        averageFillPrice, commission, commissionAsset, net, netAsset, rebate, rebateAsset, realizedPnl,
        unrealizedPnl, pnlAsset, goodTillDate, source, triggerPrice, stopLossPrice, takeProfitPrice,
        workingType, closePosition, trailingStopPercent, trailingStopActivationPrice, reduceOnly, positionSide,
        activatePrice, priceRate, selfTradePreventionMode, lastQuoteAssetTransacted, createdTime, tradeId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const order of orders) {
        db.get('SELECT id FROM orders WHERE orderId = ?', [order.OrderId], (err, row) => {
          if (err) {
            console.error('Error checking for existing order:', err);
            return;
          }
          if (!row) {
            stmt.run(
              order.OrderId, order.ClientOrderId, order.Symbol, order.Side, order.OrderType, order.Quantity, order.Price,
              order.StopPrice, order.TimeInForce, order.Status, order.IcebergQuantity, order.Time, order.UpdateTime,
              order.IsWorking, order.AccountId, order.LastExecutedQuantity, order.LastExecutedPrice, order.AverageFillPrice,
              order.Commission, order.CommissionAsset, order.Net, order.NetAsset, order.Rebate, order.RebateAsset,
              order.RealizedPnl, order.UnrealizedPnl, order.PnlAsset, order.GoodTillDate, order.Source, order.TriggerPrice,
              order.StopLossPrice, order.TakeProfitPrice, order.WorkingType, order.ClosePosition, order.TrailingStopPercent,
              order.TrailingStopActivationPrice, order.ReduceOnly, order.PositionSide, order.ActivatePrice, order.PriceRate,
              order.SelfTradePreventionMode, order.LastQuoteAssetTransacted, order.OrderSubmissionDt, order.TradeId
            );
          }
        });
      }

      stmt.finalize();
    });

    console.log(`${orders.length} orders checked for archiving.`);
  } catch (error) {
    console.error('Error archiving orders:', error);
  }
}

archiveOrders();
