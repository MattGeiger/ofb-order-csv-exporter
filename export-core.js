(function attachOFBExportCore(root, factory) {
  const api = factory();
  root.OFBExportCore = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
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

  const COMPLETED_STATUS = "Confirmed";
  const HISTORY_ENDPOINT = "/PWW/Order/GetIndexData_CompletedOrders";

  function normalizeText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function validateDateParts(year, month, day, label) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new Error(`${label} is not a valid calendar date.`);
    }
    return { year, month, day };
  }

  function parseIsoDate(value, label = "Date") {
    const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw new Error(`${label} must use YYYY-MM-DD.`);
    return validateDateParts(Number(match[1]), Number(match[2]), Number(match[3]), label);
  }

  function parsePrimariusDate(value, label = "Primarius date") {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return {
        year: value.getFullYear(),
        month: value.getMonth() + 1,
        day: value.getDate(),
      };
    }

    const text = String(value ?? "").trim();
    const aspNet = text.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//i);
    if (aspNet) {
      const date = new Date(Number(aspNet[1]));
      if (!Number.isFinite(date.getTime())) throw new Error(`${label} is invalid.`);
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
      };
    }

    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T|\s|$)/);
    if (iso) {
      return validateDateParts(Number(iso[1]), Number(iso[2]), Number(iso[3]), label);
    }

    const mdy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/);
    if (mdy) {
      return validateDateParts(Number(mdy[3]), Number(mdy[1]), Number(mdy[2]), label);
    }
    throw new Error(`${label} is missing or uses an unsupported format.`);
  }

  function dateKey(parts) {
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  }

  function formatMdy(parts) {
    return `${parts.month}/${parts.day}/${parts.year}`;
  }

  function buildHistoryRequest(startDate, endDate, pageNumber = 0, pageSize = 50) {
    const start = parseIsoDate(startDate, "Start date");
    const end = parseIsoDate(endDate, "End date");
    if (dateKey(start) > dateKey(end)) {
      throw new Error("Start date must be on or before End date.");
    }
    if (!Number.isInteger(pageNumber) || pageNumber < 0) throw new Error("Page number is invalid.");
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) throw new Error("Page size is invalid.");

    return {
      endpoint: HISTORY_ENDPOINT,
      data: {
        pagenum: pageNumber,
        pagesize: pageSize,
        recordstartindex: pageNumber * pageSize,
        recordendindex: (pageNumber + 1) * pageSize,
        filterscount: 2,
        groupscount: 0,
        filterdatafield0: "PickupDeliveryDate",
        filtervalue0: `${start.month}/${start.day}/${start.year} 12:00:00 AM`,
        filtercondition0: "GREATER_THAN_OR_EQUAL",
        filteroperator0: 0,
        filterdatafield1: "PickupDeliveryDate",
        filtervalue1: `${end.month}/${end.day}/${end.year} 11:59:59 PM`,
        filtercondition1: "LESS_THAN_OR_EQUAL",
        filteroperator1: 0,
        sortdatafield: "PickupDeliveryDate",
        sortorder: "asc",
      },
    };
  }

  function normalizeCompletedOrders(rawRows, startDate, endDate) {
    if (!Array.isArray(rawRows)) throw new Error("The order-history response did not contain rows.");
    const startKey = dateKey(parseIsoDate(startDate, "Start date"));
    const endKey = dateKey(parseIsoDate(endDate, "End date"));
    if (startKey > endKey) throw new Error("Start date must be on or before End date.");

    const seen = new Set();
    const orders = [];
    let duplicatesRemoved = 0;
    for (const row of rawRows) {
      const status = String(
        row?.SystemOrderStatusName ??
        row?.SystemOrderStatusId_FormattedValue ??
        row?.Status ??
        "",
      ).trim();
      if (status.toLowerCase() !== COMPLETED_STATUS.toLowerCase()) continue;

      const id = Number(row?.Id ?? row?.OrderId);
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error("A completed history row is missing its stable internal order ID.");
      }
      const reference = String(row?.ReferenceCode ?? row?.OrderReference ?? "").trim();
      if (!reference) throw new Error(`Completed order ${id} is missing its order reference.`);

      const pickupParts = parsePrimariusDate(row?.PickupDeliveryDate, `Pickup/delivery date for ${reference}`);
      const pickupKey = dateKey(pickupParts);
      if (pickupKey < startKey || pickupKey > endKey) continue;

      if (seen.has(id)) {
        duplicatesRemoved += 1;
        continue;
      }
      seen.add(id);

      let confirmedDate = "";
      if (row?.ConfirmedDate) {
        confirmedDate = formatMdy(parsePrimariusDate(row.ConfirmedDate, `Confirmed date for ${reference}`));
      }
      orders.push({
        id,
        reference,
        status: COMPLETED_STATUS,
        pickupDeliveryDate: formatMdy(pickupParts),
        pickupDateKey: pickupKey,
        confirmedDate,
        detailUrl: `/PWW/Order/${id}/Detail/`,
        detailDataUrl: `/PWW/Order/${id}/GetDetailIndexData/`,
      });
    }

    orders.sort((a, b) => (
      a.pickupDateKey.localeCompare(b.pickupDateKey) ||
      a.reference.localeCompare(b.reference, "en", { numeric: true, sensitivity: "base" }) ||
      a.id - b.id
    ));
    return { orders, duplicatesRemoved };
  }

  function csvDateKey(value) {
    const match = String(value ?? "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (!match) throw new Error(`Combined CSV row has an invalid Date value: ${value}`);
    const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : Number(match[3]);
    return dateKey(validateDateParts(year, Number(match[1]), Number(match[2]), "CSV Date"));
  }

  function combineRows(orderExports) {
    if (!Array.isArray(orderExports)) throw new Error("Order exports are unavailable.");
    const rows = orderExports.flatMap((entry) => {
      if (!Array.isArray(entry?.rows)) throw new Error("An order export did not contain rows.");
      return entry.rows;
    });
    return rows.slice().sort((a, b) => (
      csvDateKey(a[0]).localeCompare(csvDateKey(b[0])) ||
      String(a[2]).localeCompare(String(b[2]), "en", { numeric: true, sensitivity: "base" }) ||
      String(a[3]).localeCompare(String(b[3])) ||
      String(a[4]).localeCompare(String(b[4]))
    ));
  }

  function buildBatchFilename(startDate, endDate) {
    parseIsoDate(startDate, "Start date");
    parseIsoDate(endDate, "End date");
    return `OFB_Completed_Orders_${startDate}_to_${endDate}.csv`;
  }

  function parseProduct(value) {
    const text = normalizeText(value);
    const match = text.match(/^\((?:C-)?(\d{4,6})(?:[xz]|-z|\.[01])?\)\s*(.*)$/i);
    if (!match) {
      throw new Error(`Could not read a supported product number from: ${text || "(blank)"}`);
    }
    return { productNumber: match[1], description: match[2].trim() };
  }

  function categoryFromProductNumber(productNumber) {
    const firstDigit = String(productNumber ?? "").charAt(0);
    if (["0", "1", "2", "3", "4"].includes(firstDigit)) return "DONATED";
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
    COMPLETED_STATUS,
    HISTORY_ENDPOINT,
    HEADERS,
    buildBatchFilename,
    buildExport,
    buildExportRows,
    buildHistoryRequest,
    categoryFromProductNumber,
    combineRows,
    escapeCsv,
    formatMoney,
    normalizeCompletedOrders,
    parseIsoDate,
    parsePagerLabel,
    parsePickupDate,
    parsePrimariusDate,
    parseProduct,
    toCsv,
  };
});
