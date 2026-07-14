"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const allRows = Array.from({ length: 38 }, (_, index) => ({
  ProductDisp: index === 0
    ? "(C-03840) Bev, non-alcohol alternative"
    : `(${String(index + 1).padStart(5, "0")}) Product ${index + 1}`,
  Quantity: index + 1,
  Weight: (index + 1) * 2,
  Price: index < 30 ? 0 : 1.25,
  ServiceFee: 0,
  GrantsApplied: 0,
}));

const columns = [
  { text: "Product", datafield: "ProductDisp" },
  { text: "Qty", datafield: "Quantity" },
  { text: "Weight", datafield: "Weight" },
  { text: "Unit Price", datafield: "Price" },
  { text: "Service Fee", datafield: "ServiceFee" },
  { text: "Grants Applied", datafield: "GrantsApplied" },
];

let messageListener;
let responseMessage;
let ajaxOptions;

function jq() {
  return {
    jqxGrid(method) {
      if (method === "columns") return { records: columns };
      if (method === "getrows") return allRows.slice(0, 10);
      throw new Error(`Unexpected jqxGrid method: ${method}`);
    },
  };
}

jq.fn = { jqxGrid() {} };
jq.ajax = (options) => {
  ajaxOptions = options;
  return {
    done(callback) {
      callback({ TotalRecords: 38, Data: allRows });
      return this;
    },
    fail() {
      return this;
    },
  };
};

const windowObject = {
  jQuery: jq,
  defaultDataSourceUrl_grdOrderDetailsIndex: "/PWW/Order/552543/GetDetailIndexData/",
  addEventListener(type, callback) {
    if (type === "message") messageListener = callback;
  },
  postMessage(message) {
    responseMessage = message;
  },
};

const context = vm.createContext({
  console,
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
  Math,
  Number,
  Promise,
  String,
  window: windowObject,
});

vm.runInContext(fs.readFileSync(require.resolve("../page-bridge.js"), "utf8"), context);

(async () => {
  await messageListener({
    source: windowObject,
    data: {
      source: "ofb-order-csv-exporter",
      type: "GRID_ROWS_REQUEST",
      requestId: "test-request",
      totalRows: 38,
    },
  });

  assert.equal(ajaxOptions.url, "/PWW/Order/552543/GetDetailIndexData/");
  assert.equal(ajaxOptions.data.pagesize, 38);
  assert.equal(ajaxOptions.data.pagenum, 0);
  assert.equal(responseMessage.ok, true);
  assert.equal(responseMessage.rows.length, 38);
  assert.deepEqual(JSON.parse(JSON.stringify(responseMessage.rows[0])), {
    product: "(C-03840) Bev, non-alcohol alternative",
    quantity: "1",
    weight: "2",
    unitPrice: "0",
    serviceFee: "0",
    grantsApplied: "0",
  });
  console.log("page-bridge tests passed");
})();
