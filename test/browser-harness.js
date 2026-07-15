(function initializeBrowserHarness() {
  "use strict";

  const SOURCE = "ofb-order-csv-exporter";
  const nativeAnchorClick = HTMLAnchorElement.prototype.click;

  HTMLAnchorElement.prototype.click = function captureSyntheticDownload() {
    if (this.download && this.href.startsWith("blob:")) {
      const filename = this.download;
      window.__ofbHarnessDownload = { filename, csv: null };
      const output = document.createElement("pre");
      output.id = "harness-download-output";
      output.textContent = `Captured ${filename}; reading CSV…`;
      document.body.append(output);
      fetch(this.href)
        .then((response) => response.text())
        .then((csv) => {
          window.__ofbHarnessDownload.csv = csv;
          output.textContent = `Filename: ${filename}\n${csv}`;
          window.dispatchEvent(new CustomEvent("ofb-harness-download"));
        });
      return;
    }
    nativeAnchorClick.call(this);
  };

  const orders = [
    {
      id: 101,
      reference: "ORDER-101",
      status: "Confirmed",
      pickupDeliveryDate: "6/1/2026",
      pickupDateKey: "2026-06-01",
      confirmedDate: "6/2/2026",
      detailUrl: "/PWW/Order/101/Detail/",
      detailDataUrl: "/PWW/Order/101/GetDetailIndexData/",
    },
    {
      id: 102,
      reference: "ORDER-102",
      status: "Confirmed",
      pickupDeliveryDate: "6/2/2026",
      pickupDateKey: "2026-06-02",
      confirmedDate: "6/3/2026",
      detailUrl: "/PWW/Order/102/Detail/",
      detailDataUrl: "/PWW/Order/102/GetDetailIndexData/",
    },
  ];

  const detailRows = {
    101: [{
      product: "(00560) Crackers, \"Saltines\"",
      quantity: "2",
      weight: "10",
      unitPrice: "0",
      serviceFee: "0",
      grantsApplied: "0",
    }, {
      product: "(40000) Produce (Fresh Alliance)",
      quantity: "1",
      weight: "25",
      unitPrice: "0",
      serviceFee: "0",
      grantsApplied: "0",
    }, {
      product: "(70105z) Rice, Calrose, 24/1 lb.",
      quantity: "1",
      weight: "24",
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
    }, {
      product: "(62453.1) Meat, Bacon, Ends, 3/5 lbs.",
      quantity: "1",
      weight: "15",
      unitPrice: "0",
      serviceFee: "0",
      grantsApplied: "0",
    }, {
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
    102: [{
      product: "(90056) Applesauce",
      quantity: "3",
      weight: "15",
      unitPrice: "1.25",
      serviceFee: "0.50",
      grantsApplied: "0",
    }],
  };

  function respond(request, type, payload) {
    window.setTimeout(() => {
      window.postMessage({
        source: SOURCE,
        type,
        requestId: request.requestId,
        ...payload,
      }, "*");
    }, 20);
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (event.source !== window || message?.source !== SOURCE) return;
    if (message.type === "HISTORY_REQUEST") {
      const selected = orders.filter((order) => (
        order.pickupDateKey >= message.startDate && order.pickupDateKey <= message.endDate
      ));
      respond(message, "HISTORY_RESPONSE", {
        ok: true,
        rawRows: selected.map((order) => ({
          Id: order.id,
          ReferenceCode: order.reference,
          SystemOrderStatusName: order.status,
          PickupDeliveryDate: order.pickupDeliveryDate,
          ConfirmedDate: order.confirmedDate,
        })),
        reportedRows: selected.length,
        extractedRows: selected.length,
      });
    }
    if (message.type === "ORDER_ROWS_REQUEST") {
      const rows = detailRows[message.orderId] ?? [];
      respond(message, "ORDER_ROWS_RESPONSE", {
        ok: true,
        rows,
        expectedRows: rows.length,
        extractedRows: rows.length,
        endpoint: `/PWW/Order/${message.orderId}/GetDetailIndexData/`,
      });
    }
  });
})();
