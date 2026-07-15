(function initializeOFBGridBridge() {
  "use strict";

  const SOURCE = "ofb-order-csv-exporter";
  const GRID_ID = "grdOrderDetailsIndex";
  const REQUIRED_HEADERS = ["Product", "Qty", "Weight", "Unit Price", "Service Fee", "Grants Applied"];
  const PAGE_SIZE = 50;
  const TRANSIENT_STATUSES = new Set([0, 408, 429, 500, 502, 503, 504]);
  const activeRequests = new Map();
  const cancelledBatches = new Set();

  function normalizeHeader(value) {
    const container = document.createElement("div");
    container.innerHTML = String(value ?? "");
    return (container.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  function respond(type, requestId, payload) {
    window.postMessage({
      source: SOURCE,
      type,
      requestId,
      ...payload,
    }, "*");
  }

  function makeError(message, code, details = {}) {
    const error = new Error(message);
    error.code = code;
    Object.assign(error, details);
    return error;
  }

  function serializeError(error) {
    return {
      error: error instanceof Error ? error.message : "The Primarius request failed.",
      code: error?.code || "REQUEST_FAILED",
      expectedRows: Number.isInteger(error?.expectedRows) ? error.expectedRows : undefined,
      extractedRows: Number.isInteger(error?.extractedRows) ? error.extractedRows : undefined,
    };
  }

  function unwrapResponse(response) {
    let payload = response?.d ?? response;
    if (typeof payload === "string") {
      if (/^\s*</.test(payload)) {
        throw makeError("Primarius returned a sign-in page. Sign in again before retrying.", "SESSION_EXPIRED");
      }
      payload = JSON.parse(payload);
    }
    if (!payload || typeof payload !== "object") {
      throw makeError("The Primarius response was not valid order data.", "INVALID_RESPONSE");
    }
    return payload;
  }

  function rowsFromPayload(payload, label, totalRows) {
    const rows = payload?.Data ?? payload?.data;
    if ((rows === null || rows === undefined) && totalRows === 0) return [];
    if (!Array.isArray(rows)) throw makeError(`${label} did not contain rows.`, "INVALID_RESPONSE");
    return rows;
  }

  function totalFromPayload(payload, label) {
    const total = Number(payload?.TotalRecords ?? payload?.totalRecords);
    if (!Number.isInteger(total) || total < 0) {
      throw makeError(`${label} did not report a valid total row count.`, "INVALID_RESPONSE");
    }
    return total;
  }

  function addActiveRequest(batchId, request) {
    if (!batchId || !request) return;
    if (!activeRequests.has(batchId)) activeRequests.set(batchId, new Set());
    activeRequests.get(batchId).add(request);
  }

  function removeActiveRequest(batchId, request) {
    const requests = activeRequests.get(batchId);
    if (!requests) return;
    requests.delete(request);
    if (!requests.size) activeRequests.delete(batchId);
  }

  function cancelBatch(batchId) {
    if (!batchId) return;
    cancelledBatches.add(batchId);
    for (const request of activeRequests.get(batchId) ?? []) {
      if (typeof request.abort === "function") request.abort();
    }
  }

  function assertNotCancelled(batchId) {
    if (cancelledBatches.has(batchId)) {
      throw makeError("Batch export cancelled.", "CANCELLED");
    }
  }

  function isSessionFailure(xhr) {
    const status = Number(xhr?.status ?? 0);
    const responseUrl = String(xhr?.responseURL ?? "");
    const responseText = String(xhr?.responseText ?? "");
    return status === 401 || status === 403 || /\/login(?:[/?#]|$)/i.test(responseUrl) ||
      /<form[^>]+(?:login|password)|<input[^>]+type=["']password/i.test(responseText);
  }

  function ajaxJson(jq, options, batchId, maxRetries = 2) {
    let attempt = 0;
    return new Promise((resolve, reject) => {
      function run() {
        try {
          assertNotCancelled(batchId);
        } catch (error) {
          reject(error);
          return;
        }

        const request = jq.ajax({
          method: "GET",
          dataType: "json",
          cache: false,
          timeout: 15000,
          headers: { "X-Requested-With": "XMLHttpRequest" },
          ...options,
        });
        addActiveRequest(batchId, request);
        request.done((response) => {
          removeActiveRequest(batchId, request);
          try {
            assertNotCancelled(batchId);
            resolve(unwrapResponse(response));
          } catch (error) {
            reject(error);
          }
        });
        request.fail((xhr, statusText, errorText) => {
          removeActiveRequest(batchId, request);
          if (cancelledBatches.has(batchId) || statusText === "abort") {
            reject(makeError("Batch export cancelled.", "CANCELLED"));
            return;
          }
          if (isSessionFailure(xhr)) {
            reject(makeError("Your Primarius session appears to have expired. Sign in again before retrying.", "SESSION_EXPIRED"));
            return;
          }

          const status = Number(xhr?.status ?? 0);
          const transient = TRANSIENT_STATUSES.has(status) || statusText === "timeout";
          if (transient && attempt < maxRetries) {
            attempt += 1;
            window.setTimeout(run, 400 * attempt);
            return;
          }
          reject(makeError(
            errorText || `Primarius request failed${status ? ` with HTTP ${status}` : ""}.`,
            transient ? "TRANSIENT_FAILURE" : "REQUEST_FAILED",
          ));
        });
      }
      run();
    });
  }

  function validatePageLength(rows, totalRows, pageNumber, pageSize, label) {
    const expected = Math.min(pageSize, Math.max(0, totalRows - (pageNumber * pageSize)));
    if (rows.length !== expected) {
      throw makeError(
        `${label} reports ${expected} rows for page ${pageNumber + 1}, but ${rows.length} were extracted.`,
        "ROW_COUNT_MISMATCH",
        { expectedRows: expected, extractedRows: rows.length },
      );
    }
  }

  function historyPageData(requestData, pageNumber) {
    if (!requestData || typeof requestData !== "object") {
      throw makeError("The order-history filter request is unavailable.", "INVALID_REQUEST");
    }
    if (
      requestData.filterdatafield0 !== "PickupDeliveryDate" ||
      requestData.filterdatafield1 !== "PickupDeliveryDate" ||
      requestData.filtercondition0 !== "GREATER_THAN_OR_EQUAL" ||
      requestData.filtercondition1 !== "LESS_THAN_OR_EQUAL"
    ) {
      throw makeError("The order-history date filters are invalid.", "INVALID_REQUEST");
    }
    return {
      ...requestData,
      pagenum: pageNumber,
      pagesize: PAGE_SIZE,
      recordstartindex: pageNumber * PAGE_SIZE,
      recordendindex: (pageNumber + 1) * PAGE_SIZE,
    };
  }

  async function requestHistory(jq, requestData, batchId) {
    const firstPayload = await ajaxJson(jq, {
      url: "/PWW/Order/GetIndexData_CompletedOrders",
      data: historyPageData(requestData, 0),
    }, batchId);
    const totalRows = totalFromPayload(firstPayload, "The order-history response");
    const firstRows = rowsFromPayload(firstPayload, "The order-history response", totalRows);
    validatePageLength(firstRows, totalRows, 0, PAGE_SIZE, "Order history");

    const rawRows = firstRows.slice();
    const pageCount = Math.ceil(totalRows / PAGE_SIZE);
    for (let pageNumber = 1; pageNumber < pageCount; pageNumber += 1) {
      assertNotCancelled(batchId);
      const payload = await ajaxJson(jq, {
        url: "/PWW/Order/GetIndexData_CompletedOrders",
        data: historyPageData(requestData, pageNumber),
      }, batchId);
      const pageTotal = totalFromPayload(payload, "The order-history response");
      if (pageTotal !== totalRows) {
        throw makeError(
          `Order History changed while it was being read (${totalRows} rows became ${pageTotal}).`,
          "ROW_COUNT_MISMATCH",
          { expectedRows: totalRows, extractedRows: rawRows.length },
        );
      }
      const pageRows = rowsFromPayload(payload, "The order-history response", pageTotal);
      validatePageLength(pageRows, totalRows, pageNumber, PAGE_SIZE, "Order history");
      rawRows.push(...pageRows);
    }
    if (rawRows.length !== totalRows) {
      throw makeError(
        `Order History reports ${totalRows} rows, but ${rawRows.length} were extracted.`,
        "ROW_COUNT_MISMATCH",
        { expectedRows: totalRows, extractedRows: rawRows.length },
      );
    }

    return {
      rawRows,
      reportedRows: totalRows,
      extractedRows: rawRows.length,
    };
  }

  function detailRequestData(pageNumber, pageSize) {
    return {
      pagenum: pageNumber,
      pagesize: pageSize,
      recordstartindex: pageNumber * pageSize,
      recordendindex: (pageNumber + 1) * pageSize,
      filterscount: 0,
      groupscount: 0,
      sortdatafield: "ProductDisp",
      sortorder: "asc",
    };
  }

  function mapDirectDetailRows(rawRows) {
    return rawRows.map((row) => ({
      product: String(row?.ProductDisp ?? "").trim(),
      quantity: String(row?.Quantity ?? "").trim(),
      weight: String(row?.Weight ?? "").trim(),
      unitPrice: String(row?.Price ?? "").trim(),
      serviceFee: String(row?.ServiceFee ?? "").trim(),
      grantsApplied: String(row?.GrantsApplied ?? "").trim(),
    }));
  }

  function detectDuplicateDetailRows(rawRows) {
    const seen = new Set();
    for (const row of rawRows) {
      if (row?.Id === undefined || row?.Id === null || row?.Id === "") continue;
      const id = String(row.Id);
      if (seen.has(id)) throw makeError(`Primarius returned duplicate order-detail row ${id}.`, "DUPLICATE_DETAIL_ROW");
      seen.add(id);
    }
  }

  async function requestOrderRows(jq, orderId, batchId) {
    const id = Number(orderId);
    if (!Number.isInteger(id) || id <= 0) throw makeError("The internal order ID is invalid.", "INVALID_ORDER");
    const endpoint = `/PWW/Order/${id}/GetDetailIndexData/`;

    const firstPayload = await ajaxJson(jq, { url: endpoint, data: detailRequestData(0, PAGE_SIZE) }, batchId);
    const totalRows = totalFromPayload(firstPayload, `Order ${id}`);
    const firstRows = rowsFromPayload(firstPayload, `Order ${id}`, totalRows);
    validatePageLength(firstRows, totalRows, 0, PAGE_SIZE, `Order ${id}`);

    const rawRows = firstRows.slice();
    const pageCount = Math.ceil(totalRows / PAGE_SIZE);
    for (let pageNumber = 1; pageNumber < pageCount; pageNumber += 1) {
      assertNotCancelled(batchId);
      const payload = await ajaxJson(jq, { url: endpoint, data: detailRequestData(pageNumber, PAGE_SIZE) }, batchId);
      const pageTotal = totalFromPayload(payload, `Order ${id}`);
      if (pageTotal !== totalRows) {
        throw makeError(
          `Order ${id} changed while it was being read (${totalRows} rows became ${pageTotal}).`,
          "ROW_COUNT_MISMATCH",
          { expectedRows: totalRows, extractedRows: rawRows.length },
        );
      }
      const pageRows = rowsFromPayload(payload, `Order ${id}`, pageTotal);
      validatePageLength(pageRows, totalRows, pageNumber, PAGE_SIZE, `Order ${id}`);
      rawRows.push(...pageRows);
    }

    detectDuplicateDetailRows(rawRows);
    const rows = mapDirectDetailRows(rawRows);
    if (rows.length !== totalRows) {
      throw makeError(
        `Order ${id} reports ${totalRows} rows, but ${rows.length} were extracted.`,
        "ROW_COUNT_MISMATCH",
        { expectedRows: totalRows, extractedRows: rows.length },
      );
    }
    return { rows, expectedRows: totalRows, extractedRows: rows.length, endpoint };
  }

  function mapGridRows(rawRows, fields) {
    return rawRows
      .map((row) => ({
        product: String(row[fields.get("Product")] ?? "").trim(),
        quantity: String(row[fields.get("Qty")] ?? "").trim(),
        weight: String(row[fields.get("Weight")] ?? "").trim(),
        unitPrice: String(row[fields.get("Unit Price")] ?? "").trim(),
        serviceFee: String(row[fields.get("Service Fee")] ?? "").trim(),
        grantsApplied: String(row[fields.get("Grants Applied")] ?? "").trim(),
      }))
      .filter((row) => /^\((?:C-)?\d{4,6}(?:[xz]|-z|\.[01])?\)/i.test(row.product));
  }

  async function requestSingleOrderGrid(jq, fields, totalRows) {
    const endpoint = window.defaultDataSourceUrl_grdOrderDetailsIndex;
    if (typeof endpoint !== "string" || !endpoint) {
      throw new Error("The Primarius order-data address is unavailable.");
    }
    const parsedId = endpoint.match(/\/Order\/(\d+)\/GetDetailIndexData\//i);
    if (parsedId) {
      const result = await requestOrderRows(jq, Number(parsedId[1]), `single-${Date.now()}`);
      return result.rows;
    }

    const pageSize = Math.min(PAGE_SIZE, totalRows);
    const payload = await ajaxJson(jq, { url: endpoint, data: detailRequestData(0, pageSize) }, `single-${Date.now()}`);
    const responseTotal = totalFromPayload(payload, "The order-data response");
    return mapGridRows(rowsFromPayload(payload, "The order-data response", responseTotal), fields);
  }

  async function handleSingleGridRows(message) {
    try {
      const jq = window.jQuery ?? window.$;
      if (typeof jq !== "function" || typeof jq.fn?.jqxGrid !== "function") {
        throw new Error("The Primarius table interface is unavailable.");
      }

      const grid = jq(`#${GRID_ID}`);
      const columnResult = grid.jqxGrid("columns");
      const columns = Array.isArray(columnResult) ? columnResult : columnResult?.records;
      if (!Array.isArray(columns)) throw new Error("The Primarius table columns could not be read.");
      const fields = new Map(columns.map((column) => [normalizeHeader(column.text), column.datafield]));
      for (const header of REQUIRED_HEADERS) {
        if (!fields.get(header)) throw new Error(`The table is missing its ${header} field.`);
      }

      const rawRows = grid.jqxGrid("getrows");
      if (!Array.isArray(rawRows)) throw new Error("The Primarius order rows could not be read.");
      let rows = mapGridRows(rawRows, fields);
      const totalRows = Number(message.totalRows);
      if (Number.isInteger(totalRows) && totalRows > rows.length) {
        rows = await requestSingleOrderGrid(jq, fields, totalRows);
      }
      respond("GRID_ROWS_RESPONSE", message.requestId, { ok: true, rows });
    } catch (error) {
      respond("GRID_ROWS_RESPONSE", message.requestId, { ok: false, ...serializeError(error) });
    }
  }

  async function handleHistoryRequest(message) {
    try {
      const jq = window.jQuery ?? window.$;
      if (typeof jq?.ajax !== "function") throw makeError("The Primarius request interface is unavailable.", "EXTENSION_ERROR");
      const result = await requestHistory(jq, message.historyRequest, message.batchId);
      respond("HISTORY_RESPONSE", message.requestId, { ok: true, ...result });
    } catch (error) {
      respond("HISTORY_RESPONSE", message.requestId, { ok: false, ...serializeError(error) });
    }
  }

  async function handleOrderRequest(message) {
    try {
      const jq = window.jQuery ?? window.$;
      if (typeof jq?.ajax !== "function") throw makeError("The Primarius request interface is unavailable.", "EXTENSION_ERROR");
      const result = await requestOrderRows(jq, message.orderId, message.batchId);
      respond("ORDER_ROWS_RESPONSE", message.requestId, { ok: true, ...result });
    } catch (error) {
      respond("ORDER_ROWS_RESPONSE", message.requestId, { ok: false, ...serializeError(error) });
    }
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (event.source !== window || message?.source !== SOURCE) return;
    if (message.type === "CANCEL_BATCH") {
      cancelBatch(message.batchId);
      return;
    }
    if (message.type === "GRID_ROWS_REQUEST") void handleSingleGridRows(message);
    if (message.type === "HISTORY_REQUEST") void handleHistoryRequest(message);
    if (message.type === "ORDER_ROWS_REQUEST") void handleOrderRequest(message);
  });
})();
