"use strict";

const assert = require("node:assert/strict");
const exportCore = require("../export-core.js");
const batch = exportCore;

function historyRow(id, reference, pickupDeliveryDate, status = "Confirmed") {
  return {
    Id: id,
    ReferenceCode: reference,
    SystemOrderStatusName: status,
    PickupDeliveryDate: pickupDeliveryDate,
    ConfirmedDate: pickupDeliveryDate,
  };
}

const request = batch.buildHistoryRequest("2026-06-01", "2026-06-30", 1, 50);
assert.equal(request.endpoint, "/PWW/Order/GetIndexData_CompletedOrders");
assert.equal(request.data.pagenum, 1);
assert.equal(request.data.recordstartindex, 50);
assert.equal(request.data.recordendindex, 100);
assert.equal(request.data.filterscount, 2);
assert.equal(request.data.filterdatafield0, "PickupDeliveryDate");
assert.equal(request.data.filtervalue0, "6/1/2026 12:00:00 AM");
assert.equal(request.data.filtercondition0, "GREATER_THAN_OR_EQUAL");
assert.equal(request.data.filtervalue1, "6/30/2026 11:59:59 PM");
assert.equal(request.data.filtercondition1, "LESS_THAN_OR_EQUAL");

const normalized = batch.normalizeCompletedOrders([
  historyRow(3, "ORDER-3", "6/30/2026 11:59:00 PM"),
  historyRow(1, "ORDER-1", "6/1/2026 12:00:00 AM"),
  historyRow(2, "ORDER-2", "6/15/2026 8:00:00 AM"),
  historyRow(4, "NOT-COMPLETE", "6/15/2026", "Released"),
  historyRow(5, "TOO-EARLY", "5/31/2026"),
  historyRow(6, "TOO-LATE", "7/1/2026"),
  historyRow(2, "ORDER-2-DUPLICATE", "6/15/2026 8:00:00 AM"),
], "2026-06-01", "2026-06-30");

assert.deepEqual(normalized.orders.map((order) => order.id), [1, 2, 3]);
assert.equal(normalized.duplicatesRemoved, 1);
assert.equal(normalized.orders[0].pickupDeliveryDate, "6/1/2026");
assert.equal(normalized.orders[0].detailUrl, "/PWW/Order/1/Detail/");
assert.equal(normalized.orders[0].detailDataUrl, "/PWW/Order/1/GetDetailIndexData/");

assert.deepEqual(
  batch.normalizeCompletedOrders([], "2026-06-01", "2026-06-30"),
  { orders: [], duplicatesRemoved: 0 },
);
assert.throws(
  () => batch.buildHistoryRequest("2026-06-30", "2026-06-01"),
  /Start date must be on or before End date/,
);

const productRows = {
  a: ["6/2/26", "6-Jun", "ORDER-10", "00560", "Crackers", "DONATED", "1.00", "1.00", "$0.00", "$0.00", "$0.00", "$0.00"],
  b: ["6/1/26", "6-Jun", "ORDER-2", "90056", "Applesauce", "PURCHASED", "1.00", "1.00", "$1.00", "$1.00", "$0.00", "$0.00"],
  c: ["6/1/26", "6-Jun", "ORDER-2", "00560", "Crackers", "DONATED", "1.00", "1.00", "$0.00", "$0.00", "$0.00", "$0.00"],
  d: ["6/1/26", "6-Jun", "ORDER-11", "00001", "First", "DONATED", "1.00", "1.00", "$0.00", "$0.00", "$0.00", "$0.00"],
};
const combined = batch.combineRows([{ rows: [productRows.a, productRows.b] }, { rows: [productRows.d, productRows.c] }]);
assert.deepEqual(combined, [productRows.c, productRows.b, productRows.d, productRows.a]);
assert.equal(batch.buildBatchFilename("2026-06-01", "2026-06-30"), "OFB_Completed_Orders_2026-06-01_to_2026-06-30.csv");

const escaped = exportCore.toCsv([["6/1/26", "6-Jun", "ORDER-2", "00560", "Crackers, \"Saltines\"", "DONATED", "1.00", "1.00", "$0.00", "$0.00", "$0.00", "$0.00"]]);
assert.match(escaped, /"Crackers, ""Saltines"""/);
assert.match(escaped, /,00560,/);

console.log("batch-core tests passed");
