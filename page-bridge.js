(function initializeOFBGridBridge() {
  "use strict";

  const SOURCE = "ofb-order-csv-exporter";
  const GRID_ID = "grdOrderDetailsIndex";
  const REQUIRED_HEADERS = ["Product", "Qty", "Weight", "Unit Price", "Service Fee", "Grants Applied"];

  function normalizeHeader(value) {
    const container = document.createElement("div");
    container.innerHTML = String(value ?? "");
    return (container.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  function respond(requestId, payload) {
    window.postMessage({
      source: SOURCE,
      type: "GRID_ROWS_RESPONSE",
      requestId,
      ...payload,
    }, "*");
  }

  function mapRows(rawRows, fields) {
    return rawRows
      .map((row) => ({
        product: String(row[fields.get("Product")] ?? "").trim(),
        quantity: String(row[fields.get("Qty")] ?? "").trim(),
        weight: String(row[fields.get("Weight")] ?? "").trim(),
        unitPrice: String(row[fields.get("Unit Price")] ?? "").trim(),
        serviceFee: String(row[fields.get("Service Fee")] ?? "").trim(),
        grantsApplied: String(row[fields.get("Grants Applied")] ?? "").trim(),
      }))
      .filter((row) => /^\((?:C-)?\d{5}\)/i.test(row.product));
  }

  function unwrapResponse(response) {
    let payload = response?.d ?? response;
    if (typeof payload === "string") payload = JSON.parse(payload);
    return payload;
  }

  function requestPage(jq, endpoint, fields, pageNumber, pageSize, totalRows) {
    return new Promise((resolve, reject) => {
      jq.ajax({
        url: endpoint,
        method: "GET",
        dataType: "json",
        cache: false,
        headers: { "X-Requested-With": "XMLHttpRequest" },
        data: {
          pagenum: pageNumber,
          pagesize: pageSize,
          recordstartindex: pageNumber * pageSize,
          recordendindex: Math.min((pageNumber + 1) * pageSize, totalRows),
          filterscount: 0,
          groupscount: 0,
          sortdatafield: "",
          sortorder: "",
        },
      }).done((response) => {
        try {
          const payload = unwrapResponse(response);
          const rawRows = payload?.Data ?? payload?.data ?? payload;
          if (!Array.isArray(rawRows)) throw new Error("The order-data response did not contain rows.");
          resolve(mapRows(rawRows, fields));
        } catch (error) {
          reject(error);
        }
      }).fail((_xhr, _status, error) => {
        reject(new Error(error || "The complete order data request failed."));
      });
    });
  }

  async function requestAllRows(jq, fields, totalRows) {
    const endpoint = window.defaultDataSourceUrl_grdOrderDetailsIndex;
    if (typeof endpoint !== "string" || !endpoint) {
      throw new Error("The Primarius order-data address is unavailable.");
    }
    const pageSize = Math.min(50, totalRows);
    const pageCount = Math.ceil(totalRows / pageSize);
    const pages = [];
    for (let pageNumber = 0; pageNumber < pageCount; pageNumber += 1) {
      pages.push(await requestPage(jq, endpoint, fields, pageNumber, pageSize, totalRows));
    }
    return pages.flat();
  }

  window.addEventListener("message", async (event) => {
    const message = event.data;
    if (event.source !== window || message?.source !== SOURCE || message?.type !== "GRID_ROWS_REQUEST") return;

    try {
      const jq = window.jQuery ?? window.$;
      if (typeof jq !== "function" || typeof jq.fn?.jqxGrid !== "function") {
        throw new Error("The Primarius table interface is unavailable.");
      }

      const grid = jq(`#${GRID_ID}`);
      const columnResult = grid.jqxGrid("columns");
      const columns = Array.isArray(columnResult) ? columnResult : columnResult?.records;
      if (!Array.isArray(columns)) throw new Error("The Primarius table columns could not be read.");

      const fields = new Map(
        columns.map((column) => [normalizeHeader(column.text), column.datafield]),
      );
      for (const header of REQUIRED_HEADERS) {
        if (!fields.get(header)) throw new Error(`The table is missing its ${header} field.`);
      }

      const rawRows = grid.jqxGrid("getrows");
      if (!Array.isArray(rawRows)) throw new Error("The Primarius order rows could not be read.");
      let rows = mapRows(rawRows, fields);
      const totalRows = Number(message.totalRows);
      if (Number.isInteger(totalRows) && totalRows > rows.length) {
        rows = await requestAllRows(jq, fields, totalRows);
      }

      respond(message.requestId, { ok: true, rows });
    } catch (error) {
      respond(message.requestId, {
        ok: false,
        error: error instanceof Error ? error.message : "The complete table could not be read.",
      });
    }
  });
})();
