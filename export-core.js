(function attachOFBExportCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.OFBExportCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createOFBExportCore() {
  "use strict";

  const HEADERS = [
    "Date",
    "Period",
    "Order #",
    "Product #",
    "Product Description",
    "Category",
    "Qty",
    "Weight",
    "Unit Price",
    "Price Total",
    "Service Fee",
    "Grants Applied",
  ];

  const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  function normalizeText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function parseProduct(value) {
    const text = normalizeText(value);
    const match = text.match(/^\((?:C-)?(\d{5})\)\s*(.*)$/i);
    if (!match) {
      throw new Error(`Could not read a five-digit product number from: ${text || "(blank)"}`);
    }
    return { productNumber: match[1], description: match[2].trim() };
  }

  function categoryFromProductNumber(productNumber) {
    const firstDigit = String(productNumber ?? "").charAt(0);
    if (["0", "1", "2", "3"].includes(firstDigit)) return "DONATED";
    if (["6", "7"].includes(firstDigit)) return "PURCH-DON";
    if (firstDigit === "8") return "GOVERNMENT";
    if (firstDigit === "9") return "PURCHASED";
    throw new Error(`No category rule is defined for product number ${productNumber}.`);
  }

  function numberFrom(value) {
    const normalized = String(value ?? "").replace(/[$,\s]/g, "");
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Could not read a number from: ${value}`);
    }
    return parsed;
  }

  function formatDecimal(value) {
    return numberFrom(value).toFixed(2);
  }

  function formatMoney(value) {
    return `$${numberFrom(value).toFixed(2)}`;
  }

  function roundMoney(value) {
    return Math.round((numberFrom(value) + Number.EPSILON) * 100) / 100;
  }

  function parsePickupDate(value) {
    const text = normalizeText(value);
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!match) throw new Error(`Could not read the pickup/delivery date: ${text || "(blank)"}`);
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(`Pickup/delivery date is invalid: ${text}`);
    }
    return {
      date: `${month}/${day}/${String(year).slice(-2)}`,
      period: `${month}-${MONTH_NAMES[month - 1]}`,
      isoDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  }

  function parsePagerLabel(value) {
    const match = String(value ?? "").trim().match(/^(\d+)\s*[-–]\s*(\d+)\s+of\s+(\d+)$/i);
    return match ? { first: Number(match[1]), last: Number(match[2]), total: Number(match[3]) } : null;
  }

  function buildExportRows(meta, sourceRows) {
    const pickup = parsePickupDate(meta.pickupDeliveryDate);
    const orderReference = normalizeText(meta.orderReference);
    if (!orderReference) throw new Error("The displayed order reference is missing.");

    return sourceRows
      .map((source) => {
        const product = parseProduct(source.product);
        const quantity = numberFrom(source.quantity);
        const unitPrice = roundMoney(source.unitPrice);
        return {
          sortKey: Number(product.productNumber),
          values: [
            pickup.date,
            pickup.period,
            orderReference,
            product.productNumber,
            product.description,
            categoryFromProductNumber(product.productNumber),
            quantity.toFixed(2),
            formatDecimal(source.weight),
            formatMoney(unitPrice),
            formatMoney(quantity * unitPrice),
            formatMoney(source.serviceFee),
            formatMoney(source.grantsApplied),
          ],
        };
      })
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((row) => row.values);
  }

  function escapeCsv(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function toCsv(rows) {
    return [HEADERS, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  }

  function buildExport(meta, sourceRows) {
    const rows = buildExportRows(meta, sourceRows);
    const pickup = parsePickupDate(meta.pickupDeliveryDate);
    return {
      rows,
      csv: toCsv(rows),
      filename: `OFB_Order_${normalizeText(meta.orderReference)}_${pickup.isoDate}.csv`,
    };
  }

  return {
    HEADERS,
    buildExport,
    buildExportRows,
    categoryFromProductNumber,
    escapeCsv,
    formatMoney,
    parsePagerLabel,
    parsePickupDate,
    parseProduct,
    toCsv,
  };
});
