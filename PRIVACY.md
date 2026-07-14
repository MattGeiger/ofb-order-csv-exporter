# Privacy Policy

Effective July 14, 2026

OFB Order CSV Exporter processes Oregon Food Bank Primarius order information
locally in the user's browser for the single purpose of creating a CSV file at
the user's request.

## Information processed

On a matching Primarius **View Order** page, the extension reads only the
information required for the export:

- the order reference and pickup or delivery date;
- product numbers and descriptions;
- quantities and weights; and
- unit prices, service fees, and grants applied.

This information is website content and may include financial information. The
extension uses the user's existing signed-in Primarius session to request the
complete order-detail table. It does not read, collect, or store passwords,
authentication cookies, or other login credentials.

## How information is used

The information is transformed into the twelve-column CSV described in the
project documentation. Processing occurs locally and begins only when the user
chooses **Export as CSV**.

## Storage and retention

The extension does not use extension storage, browser storage, or a developer
database to retain order information. The generated CSV is saved through
Chrome's normal download behavior and remains under the user's control.

## Sharing and transmission

The extension does not transmit order information, browsing activity, usage
analytics, or generated CSV files to Temple Consulting, Oregon Food Bank, an
advertising service, or any other third party. It does not sell user data or
use it for advertising, profiling, or purposes unrelated to CSV export.

## Access

The extension runs only on URLs matching:

`https://ofb.primarius.app/PWW/Order/*/Detail/*`

It requests no access beyond that narrow Primarius order-detail pattern.

## Chrome Web Store Limited Use

The extension's use of information obtained from the browser complies with the
Chrome Web Store User Data Policy, including its Limited Use requirements. Data
is used only to provide the extension's disclosed, user-facing export feature.

## Contact

Questions or privacy requests may be submitted through the project's public
[GitHub issue tracker](https://github.com/MattGeiger/ofb-order-csv-exporter/issues).
