# Changelog

## 1.1.3

- Preserve observed historical four- and six-digit product identifiers instead of inventing padding or truncating digits.
- Normalize the observed `.0` and `-Z` legacy label variants to their underlying product identifier.
- Apply the expanded historical-label validation consistently to batch and single-order fallback extraction.

## 1.1.2

- Normalize the observed historical trailing-`x` and `.1` product-label variants to their five-digit Product #.
- Continue rejecting unobserved letter and decimal suffixes instead of silently guessing.

## 1.1.1

- Normalize the observed legacy trailing-`z` product labels, such as `(70105z)`, to their five-digit Product #.
- Keep suffix handling narrow: arbitrary product-label suffixes remain validation errors.

## 1.1.0

- Add an Order History panel for inclusive Delivery/Pickup date-range exports of Confirmed orders.
- Preview the qualifying order count before retrieval and provide sequential progress and cancellation.
- Construct stable detail-data endpoints from the history response's internal order ID.
- Validate history totals and every order's expected/extracted detail-row counts.
- Deduplicate history orders by internal ID and detect duplicate detail-row IDs when available.
- Classify the live `4xxxx` Fresh Alliance product family as `DONATED` and retain row counts when normalization fails.
- Retry only transient failures, stop explicitly on session expiry, and never download a partial CSV.
- Combine and sort rows deterministically by Date, Order #, Product #, and Product Description.
- Add an expandable per-order reconciliation report and synthetic batch-export tests.
- Consolidate batch normalization into the established isolated-world export core to avoid cross-world helper loading failures.
- Expand the narrow manifest access to the Primarius Order History URL while preserving individual export.

## 1.0.2

- Restyle the About dialog to match FEED's card, typography, spacing, backdrop, and controls.
- Add linked Oregon Food Bank credit and a GitHub icon to the source button.
- Derive the displayed version from the extension manifest.

## 1.0.1

- Add OFB extension icons and Temple Consulting credits.
- Add an accessible About dialog with product, privacy, version, license, and source information.
- Rename the primary action to **Export as CSV**.
- Add Chrome Web Store release metadata, listing materials, and repeatable packaging.

## 1.0.0

- Export the complete server-backed order table from any supported page-size view.
- Refuse partial exports when the site's reported and extracted row counts differ.
- Generate the cleaned twelve-column OFB ledger format.
- Derive category, period, product number, price total, and release filename.
- Support standard five-digit and observed `C-`-prefixed product codes.
- Validate against 39 historical orders, including an untouched seven-order holdout.
- Release the project under the GNU Affero General Public License, version 3.
