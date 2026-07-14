# Chrome Web Store Listing

## Product details

**Name**

OFB Order CSV Exporter

**Summary**

Export complete Oregon Food Bank Primarius order details as a locally generated CSV file.

**Detailed description**

OFB Order CSV Exporter adds an **Export as CSV** button to supported Oregon
Food Bank Primarius View Order pages.

With one click, the extension reads the complete order-detail table—even when
the page is displaying only a subset of its rows—and downloads an
Excel-friendly CSV containing:

- date and reporting period;
- order and product numbers;
- product descriptions and categories;
- quantities and weights; and
- unit prices, price totals, service fees, and grants applied.

The extension is intentionally narrow. It runs only on supported Primarius
order-detail URLs, processes order information locally in Chrome, and does not
send order data, browsing activity, generated files, or analytics to the
developer or another service. It refuses to create a partial export if the
number of rows read does not match the total reported by Primarius.

This is an open-source utility made by Matt Geiger, Temple Consulting, LLC.

**Category**

Productivity

**Language**

English (United States)

**Homepage URL**

https://github.com/MattGeiger/ofb-order-csv-exporter

**Support URL**

https://github.com/MattGeiger/ofb-order-csv-exporter/issues

**Privacy policy URL**

https://github.com/MattGeiger/ofb-order-csv-exporter/blob/main/PRIVACY.md

## Privacy practices

**Single purpose**

Export complete order-detail data from Oregon Food Bank Primarius View Order
pages as a locally downloaded CSV file when the user requests it.

**Host access justification**

Access is limited to
`https://ofb.primarius.app/PWW/Order/*/Detail/*`. The extension needs this
access to read the order reference, pickup or delivery date, and complete
order-detail table after the user chooses **Export as CSV**.

**Remote code**

No. All extension code is included in the uploaded package. The extension does
not download or execute remote code.

**Data handled**

- Website content
- Financial and payment information

The extension does not collect authentication information. It uses the
browser's existing signed-in Primarius session but does not read or store
passwords, cookies, or login credentials.

**Data-use certifications**

- Data is used only for the extension's disclosed single purpose.
- Data is not sold or transferred to third parties.
- Data is not used for advertising, creditworthiness, or lending.
- Humans do not read the data.
- Data processing and CSV generation occur locally in the user's browser.

## Distribution

Recommended initial visibility: **Unlisted**.

This keeps the installation available through a Chrome Web Store link without
presenting an organization-specific Primarius utility in general search. The
item can be changed to Public later without changing the package.

Recommended regions: United States.

## Reviewer note

The extension operates only after the reviewer reaches an authenticated Oregon
Food Bank Primarius View Order page. It injects one **Export as CSV** control
and an informational About control. No functionality runs on unrelated sites.
The package contains no remote code, analytics, advertising, or external data
transmission.
