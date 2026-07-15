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

assert.deepEqual(core.parseProduct("(70105z) Rice, Calrose, 24/1 lb."), {
  productNumber: "70105",
  description: "Rice, Calrose, 24/1 lb.",
});

assert.deepEqual(core.parseProduct("(20137Z) Bread, TB Stuffing Sm/Md pk"), {
  productNumber: "20137",
  description: "Bread, TB Stuffing Sm/Md pk",
});

assert.deepEqual(core.parseProduct("(11017x) Veg, Rutabagas, Bag/Box (-700 lbs)"), {
  productNumber: "11017",
  description: "Veg, Rutabagas, Bag/Box (-700 lbs)",
});

assert.deepEqual(core.parseProduct("(11018X) Veg, Turnips, Bag/Box PALLET (-750)"), {
  productNumber: "11018",
  description: "Veg, Turnips, Bag/Box PALLET (-750)",
});

assert.deepEqual(core.parseProduct("(62453.1) Meat, Bacon, Ends, 3/5 lbs."), {
  productNumber: "62453",
  description: "Meat, Bacon, Ends, 3/5 lbs.",
});

assert.deepEqual(core.parseProduct("(11101.1) Fruit, Oranges Bagged/Tote (-750lbs)"), {
  productNumber: "11101",
  description: "Fruit, Oranges Bagged/Tote (-750lbs)",
});

assert.deepEqual(core.parseProduct("(40020.0) Other, Canned & Dry Retail Prods"), {
  productNumber: "40020",
  description: "Other, Canned & Dry Retail Prods",
});

assert.deepEqual(core.parseProduct("(05250-Z) Flaxseed/Chia DO NOT USE THIS CODE"), {
  productNumber: "05250",
  description: "Flaxseed/Chia DO NOT USE THIS CODE",
});

assert.deepEqual(core.parseProduct("(8060) Rice Med Grain 2 lb."), {
  productNumber: "8060",
  description: "Rice Med Grain 2 lb.",
});

assert.deepEqual(core.parseProduct("(606194) Other Protein, AND Peanut Butter (12/18oz) PS"), {
  productNumber: "606194",
  description: "Other Protein, AND Peanut Butter (12/18oz) PS",
});

assert.deepEqual(core.parseProduct("(81210.0) Fruit, Grapes Variety Fresh CTN-19 LB"), {
  productNumber: "81210",
  description: "Fruit, Grapes Variety Fresh CTN-19 LB",
});

assert.throws(
  () => core.parseProduct("(70105q) Unsupported suffix"),
  /Could not read a supported product number/,
);

assert.throws(
  () => core.parseProduct("(62453.2) Unsupported decimal suffix"),
  /Could not read a supported product number/,
);

assert.throws(
  () => core.parseProduct("(806) Unsupported short identifier"),
  /Could not read a supported product number/,
);

assert.throws(
  () => core.parseProduct("(6061940) Unsupported long identifier"),
  /Could not read a supported product number/,
);

assert.deepEqual(core.parsePickupDate("6/15/2026 7:00:00 AM"), {
  date: "6/15/26",
  period: "6-Jun",
  isoDate: "2026-06-15",
});

assert.deepEqual(core.parsePagerLabel("1-38 of 38"), { first: 1, last: 38, total: 38 });
assert.equal(core.parsePagerLabel("1-38 of 38 50"), null);
assert.equal(core.parsePagerLabel("50"), null);

assert.equal(core.categoryFromProductNumber("00560"), "DONATED");
assert.equal(core.categoryFromProductNumber("40000"), "DONATED");
assert.equal(core.categoryFromProductNumber("42050"), "DONATED");
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

const legacySuffixExport = core.buildExport(
  { orderReference: "733866", pickupDeliveryDate: "8/1/2024 7:00:00 AM" },
  [{
    product: "(70105z) Rice, Calrose, 24/1 lb.",
    quantity: "1",
    weight: "24",
    unitPrice: "0",
    serviceFee: "0",
    grantsApplied: "0",
  }],
);
assert.equal(legacySuffixExport.rows[0][3], "70105");
assert.equal(legacySuffixExport.rows[0][4], "Rice, Calrose, 24/1 lb.");
assert.equal(legacySuffixExport.rows[0][5], "PURCH-DON");

const olderLegacySuffixExport = core.buildExport(
  { orderReference: "662954", pickupDeliveryDate: "2/1/2022 7:00:00 AM" },
  [{
    product: "(62453.1) Meat, Bacon, Ends, 3/5 lbs.",
    quantity: "1",
    weight: "15",
    unitPrice: "0",
    serviceFee: "0",
    grantsApplied: "0",
  }, {
    product: "(11017x) Veg, Rutabagas, Bag/Box (-700 lbs)",
    quantity: "1",
    weight: "700",
    unitPrice: "0",
    serviceFee: "0",
    grantsApplied: "0",
  }],
);
assert.deepEqual(olderLegacySuffixExport.rows.map((row) => [row[3], row[5]]), [
  ["11017", "DONATED"],
  ["62453", "PURCH-DON"],
]);

const oldestLegacyExport = core.buildExport(
  { orderReference: "326514", pickupDeliveryDate: "1/1/2011 7:00:00 AM" },
  [{
    product: "(40020.0) Other, Canned & Dry Retail Prods",
    quantity: "1",
    weight: "1",
    unitPrice: "0",
    serviceFee: "0",
    grantsApplied: "0",
  }, {
    product: "(05250-Z) Flaxseed/Chia DO NOT USE THIS CODE",
    quantity: "1",
    weight: "1",
    unitPrice: "0",
    serviceFee: "0",
    grantsApplied: "0",
  }, {
    product: "(8060) Rice Med Grain 2 lb.",
    quantity: "1",
    weight: "2",
    unitPrice: "0",
    serviceFee: "0",
    grantsApplied: "0",
  }, {
    product: "(606194) Other Protein, AND Peanut Butter (12/18oz) PS",
    quantity: "1",
    weight: "18",
    unitPrice: "0",
    serviceFee: "0",
    grantsApplied: "0",
  }, {
    product: "(81210.0) Fruit, Grapes Variety Fresh CTN-19 LB",
    quantity: "1",
    weight: "19",
    unitPrice: "0",
    serviceFee: "0",
    grantsApplied: "0",
  }],
);
assert.deepEqual(oldestLegacyExport.rows.map((row) => [row[3], row[5]]), [
  ["05250", "DONATED"],
  ["8060", "GOVERNMENT"],
  ["40020", "DONATED"],
  ["81210", "GOVERNMENT"],
  ["606194", "PURCH-DON"],
]);

console.log("export-core tests passed");
