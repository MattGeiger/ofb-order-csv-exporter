"use strict";

const assert = require("node:assert/strict");
const core = require("../export-core.js");

assert.deepEqual(core.parseProduct("(00560) Snacks, Crackers, Saltines"), {
  productNumber: "00560",
  description: "Snacks, Crackers, Saltines",
});

assert.deepEqual(core.parseProduct("(C-03840) Bev, non-alcohol alternative"), {
  productNumber: "03840",
  description: "Bev, non-alcohol alternative",
});

assert.deepEqual(core.parsePickupDate("6/15/2026 7:00:00 AM"), {
  date: "6/15/26",
  period: "6-Jun",
  isoDate: "2026-06-15",
});

assert.deepEqual(core.parsePagerLabel("1-38 of 38"), { first: 1, last: 38, total: 38 });
assert.equal(core.parsePagerLabel("1-38 of 38 50"), null);
assert.equal(core.parsePagerLabel("50"), null);

assert.equal(core.categoryFromProductNumber("00560"), "DONATED");
assert.equal(core.categoryFromProductNumber("60404"), "PURCH-DON");
assert.equal(core.categoryFromProductNumber("80103"), "GOVERNMENT");
assert.equal(core.categoryFromProductNumber("98130"), "PURCHASED");

const exported = core.buildExport(
  { orderReference: "806667", pickupDeliveryDate: "6/15/2026 7:00:00 AM" },
  [
    {
      product: "(98130) Veg, Green Beans 24/15 oz.",
      quantity: "12",
      weight: "276.00",
      unitPrice: "$17.10",
      serviceFee: "$0.00",
      grantsApplied: "$0.00",
    },
    {
      product: "(00560) Snacks, Crackers, Saltines",
      quantity: "2",
      weight: "10.00",
      unitPrice: "$0.00",
      serviceFee: "$0.00",
      grantsApplied: "$0.00",
    },
  ],
);

assert.equal(exported.filename, "OFB_Order_806667_2026-06-15.csv");
assert.equal(exported.rows.length, 2);
assert.deepEqual(exported.rows[0], [
  "6/15/26",
  "6-Jun",
  "806667",
  "00560",
  "Snacks, Crackers, Saltines",
  "DONATED",
  "2.00",
  "10.00",
  "$0.00",
  "$0.00",
  "$0.00",
  "$0.00",
]);
assert.equal(exported.rows[1][9], "$205.20");
assert.match(exported.csv, /"Snacks, Crackers, Saltines"/);

const precisionExport = core.buildExport(
  { orderReference: "804961", pickupDeliveryDate: "6/8/2026 7:00:00 AM" },
  [{
    product: "(90056) Fruit, Applesauce, 8/48 oz.",
    quantity: "5",
    weight: "125",
    unitPrice: "4.76190476",
    serviceFee: "0",
    grantsApplied: "0",
  }],
);
assert.equal(precisionExport.rows[0][8], "$4.76");
assert.equal(precisionExport.rows[0][9], "$23.80");

console.log("export-core tests passed");
