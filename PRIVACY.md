# Privacy

OFB Order CSV Exporter processes order information locally in the browser.

- It runs only on matching Oregon Food Bank Primarius order-detail pages.
- It uses the user's existing signed-in Primarius session to read the order-detail table.
- It does not collect login credentials.
- It does not send order data, browsing activity, or analytics to the developer or to another service.
- It saves the generated CSV only through Chrome's normal local download behavior.

The extension requests no permissions beyond access to the matching Primarius order-detail URL pattern declared in `manifest.json`.
