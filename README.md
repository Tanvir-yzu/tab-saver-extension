# 🗂️ Tab Saver Pro

A lightweight Chrome extension that lets you save and restore groups of tabs with a single click.

## Features

- **Save tab groups** – Capture all open tabs in the current window into a named group.
- **Restore tabs** – Reopen an entire saved group at once, skipping tabs that are already open.
- **Add current tab** – Append the active tab to any existing group.
- **Rename groups** – Give each group a meaningful name.
- **Remove individual tabs** – Delete a single URL from a group without affecting the rest.
- **Delete groups** – Remove a saved group when it's no longer needed.

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the root folder of this repository.
5. The **Tab Saver Pro** icon will appear in your toolbar.

## Usage

1. Click the **Tab Saver Pro** icon to open the popup.
2. Press **💾 Save Current Tabs** to save all tabs in the current window as a new group.
3. Use the **Open** button next to a group to reopen its tabs.
4. Use **Add Current** to add the active tab to an existing group.
5. Use **Rename** to give a group a custom name.
6. Use **✕** next to any URL to remove it from the group.
7. Use **Delete** to remove an entire group.

## Project Structure

```
tab-saver-extension/
├── icons/           # Extension icons (16×16, 48×48, 128×128)
├── manifest.json    # Chrome extension manifest (v3)
├── popup.html       # Extension popup UI
├── popup.css        # Popup styles
└── popup.js         # Popup logic
```

## License

This project is licensed under the [MIT License](LICENSE).

## Author

Made by **Tanvir (TN)**
