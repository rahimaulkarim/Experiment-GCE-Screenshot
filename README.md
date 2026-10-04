# Full Screen Capture

A local-only Chrome Manifest V3 extension that captures the active tab's visible viewport and downloads it as a high-quality JPG or a same-aspect-ratio PDF.

## Install

1. Open `chrome://extensions` in Google Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this `Experiment-GCE Screenshot` folder.
5. Pin **Full Screen Capture** if desired.

## Test

1. Open a normal webpage.
2. Click the extension icon and choose **Capture Screen**.
3. Confirm the preview matches the visible webpage viewport.
4. Test **Download JPG** and **Download PDF**.
5. Check Chrome's Downloads folder for files named `screenshot-YYYY-MM-DD-HH-MM.jpg` and `.pdf`.
6. Open the PDF and confirm that the complete screenshot is present without cropping.

The extension uses only `activeTab` and `downloads`. The screenshot is converted and packaged entirely in the popup, and no network requests or external services are used.

Chrome does not allow extensions to capture protected pages such as `chrome://` settings pages, the Chrome Web Store, or some browser-internal/PDF viewer surfaces. On those pages the extension shows an error; use it on a regular webpage instead.
