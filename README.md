# OFB Order CSV Exporter

OFB Order CSV Exporter is a focused Chrome extension for Oregon Food Bank Primarius. It can export one **View Order** page or combine every completed order in an inclusive pickup/delivery date range into one analysis-ready CSV.

## What it exports

The CSV contains:

`Date`, `Period`, `Order #`, `Product #`, `Product Description`, `Category`, `Qty`, `Weight`, `Unit Price`, `Price Total`, `Service Fee`, and `Grants Applied`.

The exporter:

- uses the displayed pickup/delivery date and order reference;
- finds completed orders from Order History before a batch download begins;
- reads all server-backed rows regardless of the current 5/10/20/50-row view;
- preserves observed four-, five-, and six-digit product identifiers and normalizes narrowly defined legacy `x`, `z`, `-Z`, `.0`, and `.1` label variants;
- assigns `DONATED`, `PURCH-DON`, `GOVERNMENT`, or `PURCHASED` from the product-number family, including observed `4xxxx` Fresh Alliance products as `DONATED`;
- calculates `Price Total` from quantity and the displayed, cent-rounded unit price;
- sorts an individual order by product number and a combined export by Date, Order #, then Product #;
- creates an Excel-friendly UTF-8 CSV; and
- refuses to create a partial file when any reported and extracted row counts differ.

## Install in Chrome

1. Download and unzip the release archive, or clone this repository.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Choose **Load unpacked**.
5. Select the unzipped project folder.
6. Reload an open Primarius **Order History** or **View Order** page.

The extension runs only on the Primarius Order History page and matching View Order pages.

## Use

### Export a date range

1. Sign in to Primarius normally and open **Order History**.
2. Choose inclusive **Start date** and **End date** values. These refer to **Delivery/Pickup**, not the Confirmed date.
3. Choose **Find completed orders** and review the qualifying Confirmed-order count.
4. Choose **Export combined CSV**.
5. Keep the page open while the extension processes orders sequentially. You can cancel the run.
6. Confirm that the success status and reconciliation counts match expectations.

The file is named `OFB_Completed_Orders_YYYY-MM-DD_to_YYYY-MM-DD.csv`. If any order fails, changes during retrieval, contains duplicate detail-row IDs, or reports a different extracted row count, no partial CSV is downloaded. The on-page reconciliation identifies failed and skipped orders. An expired Primarius session stops the run explicitly.

### Export one order

1. From **Order History**, select **View** for an order.
2. Choose **Export as CSV** above the order-detail table.
3. Confirm that the status reports the expected exported row count.

Choose the **Info** icon beside the export button for product details, credits,
version, license, privacy information, and a link to the source code.

The extension does not collect credentials, transmit order data to another service, or run outside the matching Primarius Order History and order-detail pages. See [PRIVACY.md](PRIVACY.md).

## Primarius integration verified July 14, 2026

The authenticated, read-only inspection found this server-backed contract:

- Order History grid DOM ID: `grdOrderIndex`.
- Visible columns: View, Order Ref, Status, Released, Picked, Confirmed, Delivery/Pickup, Delivery/Pickup Location, Order Warehouse, and Pickup Warehouse. Entry Origin and Shipping Method are also defined columns.
- Stable history fields include `Id`, `ReferenceCode`, `SystemOrderStatusName`, `ReleasedDate`, `PickedCompleteDate`, `ConfirmedDate`, and `PickupDeliveryDate`. The View link is constructed as `/PWW/Order/{Id}/Detail/`.
- Primarius's completed-order value is `Confirmed`. The Complete grid source is `/PWW/Order/GetIndexData_CompletedOrders`; Active uses `/PWW/Order/GetIndexData_OpenOrders`.
- The grid supports server-side range filters on Released, Picked, Confirmed, and Delivery/Pickup, plus a Status text filter. The extension uses inclusive `PickupDeliveryDate` filters because that is the Date written to the CSV.
- Requests use jqxGrid GET parameters: `pagenum`, `pagesize`, `recordstartindex`, `recordendindex`, `filterscount`, `filterdatafieldN`, `filtervalueN`, `filterconditionN`, `filteroperatorN`, `groupscount`, `sortdatafield`, and `sortorder`.
- Responses are JSON objects with `Data` rows and `TotalRecords`. The live Complete view reported `1-10 of 2154` during inspection.
- A distinct `ConfirmedDate` exists and is the closest completion timestamp. It can differ from `PickupDeliveryDate`; it is available in the history response but does not define batch membership.
- Order details use `grdOrderDetailsIndex` and `/PWW/Order/{Id}/GetDetailIndexData/`. This pattern was verified on completed orders `558851` and `558763`, whose detail pages used the matching `/PWW/Order/{Id}/Detail/` pattern.
- Both history and detail data are same-origin authenticated GET requests. No anti-forgery token or per-page request value was present or required; the extension uses the existing signed-in browser session and never reads cookies or credentials.

For support, use the public [GitHub issue tracker](https://github.com/MattGeiger/ofb-order-csv-exporter/issues). Do not post order data or login information in a public issue.

## Reliability scope

Version 1.0.0 was validated against a private historical corpus covering 39 orders and 1,894 rows from October 2025 through July 2026. The final seven-order, 342-row holdout was not used to develop the parsing rules and passed without an unsupported live format.

This release is intentionally narrow: it supports the observed Oregon Food Bank Primarius Order History and order-detail layouts. If Primarius changes its fields or endpoints, the exporter fails with an on-page message instead of silently creating a partial file.

## Test

Install Node.js 20 or newer, then run:

```sh
npm test
```

The private reconciliation data is deliberately excluded from this repository. Public tests use synthetic order rows.

## Build a release

Run `npm run build:release` to create a versioned Chrome Web Store ZIP in
`dist/`. The package includes only runtime assets and project documentation.

## License

This project is free software licensed under the [GNU Affero General Public License, version 3](LICENSE) (`AGPL-3.0-only`).
