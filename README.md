# FillFast ⚡

A Chrome extension for one-click form saving and filling. Fill out a form once, save it, and replay it on any future visit instantly.

![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![No build tools](https://img.shields.io/badge/build-none-lightgrey)

---

## How it works

1. Fill out a form on any website
2. Click the FillFast icon → **Save Form**
3. On any future visit, click the icon → **Fill Form**

All saved data stays in your browser. Nothing is ever sent to a server.

---

## Features

- Works on any website — standard HTML forms, React, Vue, Angular
- Matches fields by `id`, `name`, `aria-label`, `placeholder`, or position
- Fires `input` and `change` events so framework-bound forms update correctly
- Handles text inputs, dropdowns, checkboxes, radio buttons, textareas, and multi-selects
- Password fields are never read or stored
- Delete saved profiles individually from the popup

---

## Install

### From the Chrome Web Store
Search for **FillFast** or use the direct store link *(coming soon)*.

### Load unpacked (developer)
1. Clone or download this repo
2. Open `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select this folder

---

## Privacy

- All data is stored locally using `chrome.storage.local`
- No network requests, no analytics, no accounts
- Passwords, hidden fields, and file inputs are always skipped
- Uninstalling the extension removes all stored data

See [privacy.html](./privacy.html) for the full privacy policy.

---

## Project structure

```
fillfast/
├── manifest.json    Extension config (Manifest V3)
├── content.js       Injected script — scans and fills forms
├── popup.html       Toolbar popup markup
├── popup.css        Popup styles
├── popup.js         Popup logic — storage, messaging, UI
├── privacy.html     Privacy policy (hosted on GitHub Pages)
├── icons/           Extension icons (16, 48, 128 px)
├── store/
│   ├── description.txt  Chrome Web Store listing copy
│   └── demo.html        Sample form for screenshots
└── package.sh       Packages fillfast.zip for store upload
```

---

## Contributing

Bug reports and pull requests welcome. Open an issue to discuss changes before submitting a PR.

---

## License

MIT
