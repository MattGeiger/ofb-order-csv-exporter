(function initializeOFBBatchExporter() {
  "use strict";

  const SOURCE = "ofb-order-csv-exporter";
  const GRID_ID = "grdOrderIndex";
  const PANEL_ID = "ofb-batch-export-panel";
  const NETWORK_TIMEOUT_MS = 120000;

  let preview = null;
  let activeBatchId = null;
  let cancelRequested = false;
  let reconciliation = [];

  function exportCore() {
    if (!globalThis.OFBExportCore) {
      throw new Error("The CSV-export helper did not load. Reload the extension, then reload Order History.");
    }
    return globalThis.OFBExportCore;
  }

  function element(id) {
    return document.getElementById(id);
  }

  function makeBatchId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function bridgeRequest(type, responseType, payload, batchId) {
    return new Promise((resolve, reject) => {
      const requestId = makeBatchId();
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", receive);
        reject(Object.assign(new Error("Primarius did not respond before the request timed out."), { code: "TIMEOUT" }));
      }, NETWORK_TIMEOUT_MS);

      function receive(event) {
        const message = event.data;
        if (
          event.source !== window ||
          message?.source !== SOURCE ||
          message?.type !== responseType ||
          message?.requestId !== requestId
        ) return;
        window.clearTimeout(timeout);
        window.removeEventListener("message", receive);
        if (message.ok) resolve(message);
        else {
          const error = new Error(message.error || "The Primarius request failed.");
          error.code = message.code || "REQUEST_FAILED";
          error.expectedRows = message.expectedRows;
          error.extractedRows = message.extractedRows;
          reject(error);
        }
      }

      window.addEventListener("message", receive);
      window.postMessage({ source: SOURCE, type, requestId, batchId, ...payload }, "*");
    });
  }

  function setStatus(message, type = "") {
    const status = element("ofb-batch-status");
    if (!status) return;
    status.textContent = message;
    status.dataset.type = type;
  }

  function setBusy(busy, allowCancel = busy) {
    element("ofb-batch-find").disabled = busy;
    element("ofb-batch-export").disabled = busy || !preview?.orders?.length;
    element("ofb-batch-start").disabled = busy;
    element("ofb-batch-end").disabled = busy;
    element("ofb-batch-cancel").hidden = !allowCancel;
    element("ofb-batch-cancel").disabled = false;
  }

  function resetPreview() {
    if (activeBatchId) return;
    preview = null;
    reconciliation = [];
    element("ofb-batch-export").disabled = true;
    element("ofb-batch-reconciliation").hidden = true;
    setStatus("Choose a start and end date, then find completed orders.");
  }

  function selectedDates() {
    const startDate = element("ofb-batch-start").value;
    const endDate = element("ofb-batch-end").value;
    const historyRequest = exportCore().buildHistoryRequest(startDate, endDate).data;
    return { startDate, endDate, historyRequest };
  }

  function downloadCsv(filename, rows) {
    const csv = exportCore().toCsv(rows);
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderReconciliation() {
    const details = element("ofb-batch-reconciliation");
    const summary = details.querySelector("summary");
    const output = element("ofb-batch-reconciliation-output");
    const failures = reconciliation.filter((item) => item.status !== "ok");
    const expected = reconciliation.reduce((sum, item) => sum + (Number(item.expectedRows) || 0), 0);
    const extracted = reconciliation.reduce((sum, item) => sum + (Number(item.extractedRows) || 0), 0);
    summary.textContent = `Reconciliation: ${reconciliation.length} orders, ${expected} expected rows, ${extracted} extracted rows${failures.length ? `, ${failures.length} failed or skipped` : ""}`;
    output.textContent = reconciliation.map((item) => {
      const counts = `expected=${item.expectedRows ?? "unknown"}, extracted=${item.extractedRows ?? "unknown"}`;
      return `${item.reference} (ID ${item.id}): ${item.status}; ${counts}${item.error ? `; ${item.error}` : ""}`;
    }).join("\n");
    details.hidden = false;
    if (failures.length) details.open = true;
  }

  function describeHistory(result) {
    const duplicateNote = result.duplicatesRemoved
      ? ` ${result.duplicatesRemoved} duplicate history ${result.duplicatesRemoved === 1 ? "row was" : "rows were"} removed by internal order ID.`
      : "";
    return `Found ${result.orders.length} completed ${result.orders.length === 1 ? "order" : "orders"} in the selected pickup/delivery date range.${duplicateNote}`;
  }

  async function findOrders() {
    let dates;
    try {
      dates = selectedDates();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Choose a valid date range.", "error");
      return;
    }

    activeBatchId = makeBatchId();
    cancelRequested = false;
    preview = null;
    reconciliation = [];
    setBusy(true, true);
    setStatus("Finding completed orders…", "working");
    try {
      const result = await bridgeRequest("HISTORY_REQUEST", "HISTORY_RESPONSE", dates, activeBatchId);
      if (cancelRequested) throw Object.assign(new Error("Search cancelled."), { code: "CANCELLED" });
      const normalized = exportCore().normalizeCompletedOrders(
        result.rawRows,
        dates.startDate,
        dates.endDate,
      );
      preview = {
        ...normalized,
        reportedRows: result.reportedRows,
        extractedRows: result.extractedRows,
        startDate: dates.startDate,
        endDate: dates.endDate,
      };
      setStatus(describeHistory(preview), preview.orders.length ? "success" : "empty");
    } catch (error) {
      preview = null;
      setStatus(error instanceof Error ? error.message : "Completed orders could not be found.", error?.code === "CANCELLED" ? "" : "error");
    } finally {
      activeBatchId = null;
      setBusy(false, false);
    }
  }

  async function exportOrders() {
    if (!preview?.orders?.length) return;
    const currentDates = selectedDates();
    if (currentDates.startDate !== preview.startDate || currentDates.endDate !== preview.endDate) {
      resetPreview();
      setStatus("The date range changed. Find completed orders again before exporting.", "error");
      return;
    }

    activeBatchId = makeBatchId();
    cancelRequested = false;
    reconciliation = [];
    const exports = [];
    let stopForSession = false;
    setBusy(true, true);

    for (let index = 0; index < preview.orders.length; index += 1) {
      const order = preview.orders[index];
      if (cancelRequested || stopForSession) {
        reconciliation.push({
          id: order.id,
          reference: order.reference,
          status: "skipped",
          error: cancelRequested ? "Batch export cancelled." : "Skipped after the Primarius session expired.",
        });
        continue;
      }

      setStatus(`Processing order ${index + 1} of ${preview.orders.length}: ${order.reference}…`, "working");
      let expectedRows;
      let extractedRows;
      try {
        const result = await bridgeRequest(
          "ORDER_ROWS_REQUEST",
          "ORDER_ROWS_RESPONSE",
          { orderId: order.id },
          activeBatchId,
        );
        expectedRows = result.expectedRows;
        extractedRows = result.extractedRows;
        if (result.expectedRows !== result.extractedRows || result.rows.length !== result.expectedRows) {
          throw Object.assign(
            new Error(`Order ${order.reference} row counts did not match.`),
            {
              code: "ROW_COUNT_MISMATCH",
              expectedRows: result.expectedRows,
              extractedRows: result.rows.length,
            },
          );
        }
        const exported = exportCore().buildExport(
          {
            orderReference: order.reference,
            pickupDeliveryDate: order.pickupDeliveryDate,
          },
          result.rows,
        );
        exports.push(exported);
        reconciliation.push({
          id: order.id,
          reference: order.reference,
          status: "ok",
          expectedRows: result.expectedRows,
          extractedRows: exported.rows.length,
        });
      } catch (error) {
        if (error?.code === "CANCELLED") cancelRequested = true;
        if (error?.code === "SESSION_EXPIRED") stopForSession = true;
        reconciliation.push({
          id: order.id,
          reference: order.reference,
          status: "failed",
          expectedRows: error?.expectedRows ?? expectedRows,
          extractedRows: error?.extractedRows ?? extractedRows,
          error: error instanceof Error ? error.message : "Order retrieval failed.",
        });
      }
    }

    const failures = reconciliation.filter((item) => item.status !== "ok");
    renderReconciliation();
    if (cancelRequested) {
      setStatus("Batch export cancelled. No CSV was created.", "error");
    } else if (failures.length) {
      setStatus(`Batch export failed for ${failures.length} ${failures.length === 1 ? "order" : "orders"}. No partial CSV was created.`, "error");
    } else {
      const rows = exportCore().combineRows(exports);
      const filename = exportCore().buildBatchFilename(preview.startDate, preview.endDate);
      downloadCsv(filename, rows);
      setStatus(`Exported ${rows.length} rows from ${preview.orders.length} completed orders.`, "success");
    }

    activeBatchId = null;
    setBusy(false, false);
  }

  function cancelExport() {
    if (!activeBatchId) return;
    cancelRequested = true;
    window.postMessage({ source: SOURCE, type: "CANCEL_BATCH", batchId: activeBatchId }, "*");
    setStatus("Cancelling after the current request…", "working");
    element("ofb-batch-cancel").disabled = true;
  }

  function createLabeledDate(id, labelText) {
    const label = document.createElement("label");
    label.setAttribute("for", id);
    label.textContent = labelText;
    const input = document.createElement("input");
    input.id = id;
    input.type = "date";
    input.required = true;
    input.addEventListener("change", resetPreview);
    label.append(input);
    return label;
  }

  function addBatchExporter() {
    if (element(PANEL_ID)) return true;
    const grid = element(GRID_ID);
    if (!grid) return false;

    const panel = document.createElement("section");
    panel.id = PANEL_ID;
    panel.setAttribute("aria-labelledby", "ofb-batch-title");
    const title = document.createElement("h3");
    title.id = "ofb-batch-title";
    title.textContent = "Export completed orders";
    const description = document.createElement("p");
    description.textContent = "Date range uses the Delivery/Pickup date shown in Order History. Orders must have Primarius status Confirmed.";

    const controls = document.createElement("div");
    controls.id = "ofb-batch-controls";
    const start = createLabeledDate("ofb-batch-start", "Start date");
    const end = createLabeledDate("ofb-batch-end", "End date");
    const find = document.createElement("button");
    find.id = "ofb-batch-find";
    find.type = "button";
    find.textContent = "Find completed orders";
    find.addEventListener("click", findOrders);
    const exportButton = document.createElement("button");
    exportButton.id = "ofb-batch-export";
    exportButton.type = "button";
    exportButton.textContent = "Export combined CSV";
    exportButton.disabled = true;
    exportButton.addEventListener("click", exportOrders);
    const cancel = document.createElement("button");
    cancel.id = "ofb-batch-cancel";
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.hidden = true;
    cancel.addEventListener("click", cancelExport);
    controls.append(start, end, find, exportButton, cancel);

    const status = document.createElement("p");
    status.id = "ofb-batch-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = "Choose a start and end date, then find completed orders.";

    const details = document.createElement("details");
    details.id = "ofb-batch-reconciliation";
    details.hidden = true;
    const summary = document.createElement("summary");
    const output = document.createElement("pre");
    output.id = "ofb-batch-reconciliation-output";
    details.append(summary, output);

    panel.append(title, description, controls, status, details);
    grid.parentElement?.insertBefore(panel, grid);
    return true;
  }

  if (!addBatchExporter()) {
    const observer = new MutationObserver(() => {
      if (addBatchExporter()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 30000);
  }
})();
