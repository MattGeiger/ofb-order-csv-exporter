# Changelog

## 1.0.0

- Export the complete server-backed order table from any supported page-size view.
- Refuse partial exports when the site's reported and extracted row counts differ.
- Generate the cleaned twelve-column OFB ledger format.
- Derive category, period, product number, price total, and release filename.
- Support standard five-digit and observed `C-`-prefixed product codes.
- Validate against 39 historical orders, including an untouched seven-order holdout.
- Release the project under the GNU Affero General Public License, version 3.
