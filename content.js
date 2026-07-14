(function initializeOFBExporter() {
  "use strict";

  const BUTTON_ID = "ofb-export-csv-button";
  const ABOUT_BUTTON_ID = "ofb-export-about-button";
  const ABOUT_DIALOG_ID = "ofb-export-about-dialog";
  const STATUS_ID = "ofb-export-csv-status";
  const GRID_ID = "grdOrderDetailsIndex";
  const MESSAGE_SOURCE = "ofb-order-csv-exporter";

  function getText(selector) {
    return document.querySelector(selector)?.textContent?.trim() ?? "";
  }

  function getPagerInfo(grid) {
    for (const element of grid.querySelectorAll("*")) {
      for (const node of element.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const pager = OFBExportCore.parsePagerLabel(node.nodeValue);
        if (pager) return pager;
      }
    }
    return null;
  }

  function extractVisibleSourceRows() {
    const grid = document.getElementById(GRID_ID);
    if (!grid) throw new Error("The Order Details table was not found.");

    const headers = Array.from(grid.querySelectorAll('[role="columnheader"]'))
      .map((header) => header.textContent.trim());
    const columnIndex = new Map(headers.map((header, index) => [header, index]));
    const required = ["Product", "Qty", "Weight", "Unit Price", "Service Fee", "Grants Applied"];
    for (const header of required) {
      if (!columnIndex.has(header)) throw new Error(`The table is missing its ${header} column.`);
    }

    const rows = Array.from(grid.querySelectorAll('[role="row"]'))
      .map((row) => Array.from(row.querySelectorAll('[role="gridcell"]')).map((cell) => cell.textContent.trim()))
      .filter((cells) => /^\((?:C-)?\d{5}\)/i.test(cells[columnIndex.get("Product")] ?? ""))
      .map((cells) => ({
        product: cells[columnIndex.get("Product")],
        quantity: cells[columnIndex.get("Qty")],
        weight: cells[columnIndex.get("Weight")],
        unitPrice: cells[columnIndex.get("Unit Price")],
        serviceFee: cells[columnIndex.get("Service Fee")],
        grantsApplied: cells[columnIndex.get("Grants Applied")],
      }));

    if (!rows.length) throw new Error("The Order Details table does not contain any populated rows.");
    return rows;
  }

  function requestCompleteGridRows(totalRows) {
    return new Promise((resolve, reject) => {
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", receive);
        reject(new Error("The complete table did not respond."));
      }, 10000);

      function receive(event) {
        const message = event.data;
        if (
          event.source !== window ||
          message?.source !== MESSAGE_SOURCE ||
          message?.type !== "GRID_ROWS_RESPONSE" ||
          message?.requestId !== requestId
        ) return;
        window.clearTimeout(timeout);
        window.removeEventListener("message", receive);
        if (message.ok && Array.isArray(message.rows)) resolve(message.rows);
        else reject(new Error(message.error || "The complete table could not be read."));
      }

      window.addEventListener("message", receive);
      window.postMessage({
        source: MESSAGE_SOURCE,
        type: "GRID_ROWS_REQUEST",
        requestId,
        totalRows,
      }, "*");
    });
  }

  async function extractSourceRows() {
    const grid = document.getElementById(GRID_ID);
    if (!grid) throw new Error("The Order Details table was not found.");
    const visibleRows = extractVisibleSourceRows();
    const pager = getPagerInfo(grid);
    let rows = visibleRows;
    try {
      const completeRows = await requestCompleteGridRows(pager?.total);
      if (completeRows.length > rows.length) rows = completeRows;
    } catch (error) {
      console.warn("OFB complete-grid extraction was unavailable", error);
    }

    const expectedRows = pager?.total ?? rows.length;
    if (expectedRows !== rows.length) {
      throw new Error(`The page reports ${expectedRows} order rows, but only ${rows.length} could be read. No partial file was created.`);
    }
    return rows;
  }

  async function extractOrder() {
    return OFBExportCore.buildExport(
      {
        orderReference: getText("#ReferenceCode"),
        pickupDeliveryDate: getText("#PickupDeliveryDate"),
      },
      await extractSourceRows(),
    );
  }

  function downloadCsv(exported) {
    const blob = new Blob(["\uFEFF", exported.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exported.filename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setStatus(message, type) {
    const status = document.getElementById(STATUS_ID);
    if (!status) return;
    status.textContent = message;
    status.dataset.type = type;
  }

  async function handleExport() {
    const button = document.getElementById(BUTTON_ID);
    if (button) button.disabled = true;
    setStatus("Preparing CSV…", "working");
    try {
      const exported = await extractOrder();
      downloadCsv(exported);
      setStatus(`Exported ${exported.rows.length} rows.`, "success");
    } catch (error) {
      console.error("OFB CSV export failed", error);
      setStatus(error instanceof Error ? error.message : "The CSV could not be created.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function addFact(list, label, value) {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    if (value instanceof Node) description.append(value);
    else description.textContent = value;
    list.append(term, description);
  }

  function externalLink(label, href) {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    return link;
  }

  function createInfoIcon() {
    const namespace = "http://www.w3.org/2000/svg";
    const icon = document.createElementNS(namespace, "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");

    const circle = document.createElementNS(namespace, "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", "12");
    circle.setAttribute("r", "10");
    const stem = document.createElementNS(namespace, "path");
    stem.setAttribute("d", "M12 16v-4");
    const dot = document.createElementNS(namespace, "path");
    dot.setAttribute("d", "M12 8h.01");
    icon.append(circle, stem, dot);
    return icon;
  }

  function createCloseIcon() {
    const namespace = "http://www.w3.org/2000/svg";
    const icon = document.createElementNS(namespace, "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("aria-hidden", "true");
    const first = document.createElementNS(namespace, "path");
    first.setAttribute("d", "M18 6 6 18");
    const second = document.createElementNS(namespace, "path");
    second.setAttribute("d", "m6 6 12 12");
    icon.append(first, second);
    return icon;
  }

  function createGithubIcon() {
    const namespace = "http://www.w3.org/2000/svg";
    const icon = document.createElementNS(namespace, "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");
    const body = document.createElementNS(namespace, "path");
    body.setAttribute("d", "M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.28 0 6.72-2 6.72-5.5A4.5 4.5 0 0 0 19.5 5.8 4.22 4.22 0 0 0 19.4 2S18.23 1.65 15 3.48a13.38 13.38 0 0 0-7 0C4.77 1.65 3.6 2 3.6 2a4.22 4.22 0 0 0-.1 3.8A4.5 4.5 0 0 0 2.28 9c0 3.5 3.44 5.5 6.72 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4");
    const branch = document.createElementNS(namespace, "path");
    branch.setAttribute("d", "M9 18c-4.51 2-5-2-7-2");
    icon.append(body, branch);
    return icon;
  }

  function createAboutDialog() {
    const existing = document.getElementById(ABOUT_DIALOG_ID);
    if (existing) return existing;

    const dialog = document.createElement("dialog");
    dialog.id = ABOUT_DIALOG_ID;
    dialog.setAttribute("aria-labelledby", "ofb-export-about-title");
    dialog.setAttribute("aria-describedby", "ofb-export-about-description");

    const closeButton = document.createElement("button");
    closeButton.id = "ofb-export-about-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close About dialog");
    closeButton.append(createCloseIcon());
    closeButton.addEventListener("click", () => dialog.close());

    const card = document.createElement("div");
    card.id = "ofb-export-about-card";

    const logo = document.createElement("img");
    logo.id = "ofb-export-about-logo";
    logo.src = chrome.runtime.getURL("assets/temple-logo-light.svg");
    logo.alt = "Temple Consulting, LLC.";
    logo.width = 112;
    logo.height = 112;

    const heading = document.createElement("div");
    heading.id = "ofb-export-about-heading";

    const title = document.createElement("h2");
    title.id = "ofb-export-about-title";
    title.textContent = "OFB Order CSV Exporter";

    const tagline = document.createElement("p");
    tagline.id = "ofb-export-about-tagline";
    tagline.textContent = "Order data, ready for analysis";

    const description = document.createElement("p");
    description.id = "ofb-export-about-description";
    description.textContent = "Exports complete Primarius order details as a structured CSV.";
    heading.append(title, tagline, description);

    const identity = document.createElement("div");
    identity.id = "ofb-export-about-identity";
    identity.append(logo, heading);

    const facts = document.createElement("dl");
    facts.id = "ofb-export-about-facts";

    const maker = document.createElement("span");
    maker.append(
      externalLink("Matt Geiger", "https://www.geigertron.com/"),
      ", ",
      externalLink("Temple Consulting, LLC.", "https://templepdx.com/"),
      " 2026",
    );
    addFact(facts, "Made by", maker);
    addFact(facts, "Made for", externalLink("Oregon Food Bank", "https://www.oregonfoodbank.org/"));
    addFact(facts, "Made with", "JavaScript, Chrome Extensions, and Codex");
    addFact(facts, "Version", chrome.runtime.getManifest().version);
    addFact(facts, "License", "AGPL-3.0-only");

    const legal = document.createElement("p");
    legal.id = "ofb-export-about-legal";
    legal.textContent = "The extension code is open source. Oregon Food Bank and Primarius names and branding are not covered by the software license. Order information is processed locally and is not sent to the developer.";

    const source = externalLink(
      "Source Code on GitHub",
      "https://github.com/MattGeiger/ofb-order-csv-exporter",
    );
    source.id = "ofb-export-about-source";
    source.prepend(createGithubIcon());

    card.append(identity, facts, legal, source);
    dialog.append(card, closeButton);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    document.body.append(dialog);
    return dialog;
  }

  function handleAbout() {
    const dialog = createAboutDialog();
    if (!dialog.open) dialog.showModal();
  }

  function addExporter() {
    if (document.getElementById(BUTTON_ID)) return true;
    const grid = document.getElementById(GRID_ID);
    if (!grid) return false;

    const panel = document.createElement("div");
    panel.id = "ofb-export-csv-panel";
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "Export as CSV";
    button.addEventListener("click", handleExport);
    const aboutButton = document.createElement("button");
    aboutButton.id = ABOUT_BUTTON_ID;
    aboutButton.type = "button";
    aboutButton.setAttribute("aria-label", "About");
    aboutButton.title = "About";
    aboutButton.append(createInfoIcon());
    aboutButton.addEventListener("click", handleAbout);
    const status = document.createElement("span");
    status.id = STATUS_ID;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    panel.append(button, aboutButton, status);
    grid.parentElement?.insertBefore(panel, grid);
    return true;
  }

  if (!addExporter()) {
    const observer = new MutationObserver(() => {
      if (addExporter()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 30000);
  }
})();
