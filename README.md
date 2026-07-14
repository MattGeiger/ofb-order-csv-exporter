# OFB Order CSV Exporter

OFB Order CSV Exporter is a focused Chrome extension for Oregon Food Bank Primarius **View Order** pages. It adds an **Export Clean CSV** button and turns the complete order-detail table into an analysis-ready CSV without manual copying or cleanup.

## What it exports

The CSV contains:

`Date`, `Period`, `Order #`, `Product #`, `Product Description`, `Category`, `Qty`, `Weight`, `Unit Price`, `Price Total`, `Service Fee`, and `Grants Applied`.

The exporter:

- uses the displayed pickup/delivery date and order reference;
- reads all server-backed rows regardless of the current 5/10/20/50-row view;
- supports the observed five-digit and `C-`-prefixed product formats;
- assigns `DONATED`, `PURCH-DON`, `GOVERNMENT`, or `PURCHASED` from the product-number family;
- calculates `Price Total` from quantity and the displayed, cent-rounded unit price;
- sorts rows by product number;
- creates an Excel-friendly UTF-8 CSV; and
- refuses to create a partial file when the reported and extracted row counts differ.

## Install in Chrome

1. Download and unzip the release archive, or clone this repository.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Choose **Load unpacked**.
5. Select the unzipped project folder.
6. Reload an open Primarius **View Order** page.

The extension runs only on URLs matching `https://ofb.primarius.app/PWW/Order/*/Detail/*`.

## Use

1. Sign in to Primarius normally.
2. Open **Order History**, then select **View** for an order.
3. Choose **Export Clean CSV** above the order-detail table.
4. Confirm that the status reports the expected exported row count.

The extension does not collect credentials, transmit order data to another service, or run outside the matching order-detail pages. See [PRIVACY.md](PRIVACY.md).

## Reliability scope

Version 1.0.0 was validated against a private historical corpus covering 39 orders and 1,894 rows from October 2025 through July 2026. The final seven-order, 342-row holdout was not used to develop the parsing rules and passed without an unsupported live format.

This release is intentionally narrow: it supports the observed Oregon Food Bank Primarius order-detail layout. If Primarius changes its table fields or data endpoint, the exporter fails with an on-page message instead of silently creating a partial file.

## Test

Install Node.js 20 or newer, then run:

```sh
npm test
```

The private reconciliation data is deliberately excluded from this repository. Public tests use synthetic order rows.

## License

This project is free software licensed under the [GNU Affero General Public License, version 3](LICENSE) (`AGPL-3.0-only`).
