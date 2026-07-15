"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const batchCore = require("../export-core.js");

const requests = [];
const responses = [];
let messageListener;

function responseFor(options) {
  if (options.url === "/PWW/Order/GetIndexData_CompletedOrders") {
    return {
      TotalRecords: 2,
      Data: [
        {
          Id: 101,
          ReferenceCode: "ORDER-101",
          SystemOrderStatusName: "Confirmed",
          PickupDeliveryDate: "6/1/2026 8:00:00 AM",
          ConfirmedDate: "6/2/2026",
        },
        {
          Id: 102,
          ReferenceCode: "ORDER-102",
          SystemOrderStatusName: "Confirmed",
          PickupDeliveryDate: "6/30/2026 8:00:00 AM",
          ConfirmedDate: "7/1/2026",
        },
      ],
    };
  }
  if (options.url === "/PWW/Order/101/GetDetailIndexData/") {
    return {
      TotalRecords: 1,
      Data: [{
        Id: 9001,
        ProductDisp: "(00560) Crackers, Saltines",
        Quantity: 2,
        Weight: 10,
        Price: 0,
        ServiceFee: 0,
        GrantsApplied: 0,
      }],
    };
  }
  if (options.url === "/PWW/Order/102/GetDetailIndexData/") {
    return {
      TotalRecords: 2,
      Data: [{
        Id: 9002,
        ProductDisp: "(90056) Applesauce",
        Quantity: 1,
        Weight: 5,
        Price: 1,
        ServiceFee: 0,
        GrantsApplied: 0,
      }],
    };
  }
  throw new Error(`Unexpected URL: ${options.url}`);
}

function jq() {
  throw new Error("Grid access was not expected in batch tests.");
}

jq.ajax = (options) => {
  requests.push(options);
  const payload = responseFor(options);
  return {
    abort() {},
    done(callback) {
      callback(payload);
      return this;
    },
    fail() {
      return this;
    },
  };
};

const windowObject = {
  OFBBatchCore: batchCore,
  jQuery: jq,
  addEventListener(type, callback) {
    if (type === "message") messageListener = callback;
  },
  postMessage(message) {
    responses.push(message);
  },
  setTimeout(callback) {
    callback();
  },
};

const context = vm.createContext({
  console,
  Date,
  document: {
    createElement() {
      return {
        _html: "",
        get textContent() { return this._html.replace(/<[^>]*>/g, ""); },
        set innerHTML(value) { this._html = String(value); },
      };
    },
  },
  Error,
  JSON,
  Map,
  Math,
  Number,
  Promise,
  Set,
  String,
  window: windowObject,
});

vm.runInContext(fs.readFileSync(require.resolve("../page-bridge.js"), "utf8"), context);

async function send(data) {
  messageListener({ source: windowObject, data: { source: "ofb-order-csv-exporter", ...data } });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  return responses.find((response) => response.requestId === data.requestId);
}

(async () => {
  const history = await send({
    type: "HISTORY_REQUEST",
    requestId: "history",
    batchId: "batch-history",
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    historyRequest: batchCore.buildHistoryRequest("2026-06-01", "2026-06-30").data,
  });
  assert.equal(history.ok, true);
  assert.equal(history.rawRows.length, 2);
  assert.equal(history.reportedRows, 2);
  assert.equal(history.extractedRows, 2);
  assert.equal(requests[0].data.filterdatafield0, "PickupDeliveryDate");
  assert.equal(requests[0].data.filtercondition0, "GREATER_THAN_OR_EQUAL");
  assert.equal(requests[0].data.filtercondition1, "LESS_THAN_OR_EQUAL");

  const successfulOrder = await send({
    type: "ORDER_ROWS_REQUEST",
    requestId: "order-success",
    batchId: "batch-orders",
    orderId: 101,
  });
  assert.equal(successfulOrder.ok, true);
  assert.equal(successfulOrder.expectedRows, 1);
  assert.equal(successfulOrder.extractedRows, 1);
  assert.equal(successfulOrder.rows[0].product, "(00560) Crackers, Saltines");
  assert.equal(requests[1].url, "/PWW/Order/101/GetDetailIndexData/");

  const failedOrder = await send({
    type: "ORDER_ROWS_REQUEST",
    requestId: "order-failure",
    batchId: "batch-orders",
    orderId: 102,
  });
  assert.equal(failedOrder.ok, false);
  assert.equal(failedOrder.code, "ROW_COUNT_MISMATCH");
  assert.equal(failedOrder.expectedRows, 2);
  assert.equal(failedOrder.extractedRows, 1);

  console.log("page-bridge batch tests passed");
})();
