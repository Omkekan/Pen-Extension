# Pen Ink Handwriting

> A GNOME Shell extension that lets you write with a pen or stylus in a panel at the bottom of the screen and types the recognized text into whatever app has focus.

Works with 2-in-1 laptops, tablets, and graphics tablets on GNOME (Wayland or X11). Tap a text field with your pen, write, pause, and your handwriting is converted to text and inserted.

## Features

- **Auto-open on pen tap:** the panel appears when you tap a text field with the pen (can be turned off).
- **Works in any app:** text is inserted through GNOME's input-method path (the same one the on-screen keyboard uses), with a clipboard-paste fallback for apps that don't support it.
- **Two recognition engines:** Google's handwriting service (accurate, online) or Tesseract (offline, better for neat print).
- **Multiple languages:** set a language code such as `en`, `hi`, `mr`, `fr`, `de`.
- **Quick editing buttons:** Space, Backspace, Enter, Clear, Close.
- **Configurable:** shortcut, conversion delay, auto-spacing, engine, language.

## Requirements

- **GNOME Shell 45 or newer** (Fedora Workstation, Ubuntu 24.04+, Debian 13, Arch/Manjaro with GNOME, openSUSE with GNOME, and similar).
- `python3`
- `glib-compile-schemas` (used by the installer)
- A pen/stylus input device (a mouse can open the panel with the hotkey, but the auto-open feature relies on pen detection)
- Internet access for the default `google` engine

It does **not** work on KDE Plasma, XFCE, Cinnamon, MATE, or other non-GNOME desktops, or on GNOME older than 45.

### Packages by distribution

| Distro | `glib-compile-schemas` | Offline engine (optional) |
|---|---|---|
| Fedora | `sudo dnf install glib2-devel` | `sudo dnf install tesseract python3-pillow` |
| Ubuntu / Debian | `sudo apt install libglib2.0-bin` | `sudo apt install tesseract-ocr python3-pil` |
| Arch / Manjaro | `sudo pacman -S glib2` | `sudo pacman -S tesseract tesseract-data-eng python-pillow` |
| openSUSE | `sudo zypper install glib2-tools` | `sudo zypper install tesseract-ocr python3-Pillow` |

## Installation

```bash
git clone https://github.com/Omkekan/Pen-Extension.git
cd penink-extension
chmod +x install.sh
./install.sh
```

Then **log out and log back in** (required on Wayland so GNOME Shell detects the new extension) and enable it:

```bash
gnome-extensions enable penink@fedora.local
```

## Usage

1. Tap a text field with your pen. The panel opens at the bottom of the screen.
   - Or press **Super+Shift+H**, or click the pen icon in the top bar.
2. Write in the panel.
3. After a short pause (default 1.2 seconds) the ink is converted and inserted into the focused field.
4. Use the panel buttons for Space, Backspace, Enter, Clear, and Close.

## Settings

Open preferences with:

```bash
gnome-extensions prefs penink@fedora.local
```

| Setting | Default | Description |
|---|---|---|
| Open automatically on pen tap | On | Show the panel when a text field is tapped with the pen |
| Add a space between chunks | On | Insert a space before each new piece of handwriting |
| Convert after pause (ms) | 1200 | How long to wait after you lift the pen before converting |
| Toggle shortcut | `<Super><Shift>h` | Shortcut to show or hide the panel |
| Engine | `google` | `google` (online) or `tesseract` (offline) |
| Language code | `en` | Handwriting language (`en`, `hi`, `mr`, `fr`, `de`, ...) |
| Debug logging | Off | Log pen and text-focus detection to the journal |

## Recognition engines and privacy

| Engine | Quality | Offline | Privacy |
|---|---|---|---|
| `google` (default) | Good | No | Your pen strokes are sent to Google's handwriting service |
| `tesseract` | Weak for cursive, OK for neat print | Yes | Everything stays on your machine |

> **Privacy note:** with the default `google` engine, the strokes you write are sent over the internet to `inputtools.google.com` for recognition. Anything you write while using it, including passwords or sensitive text, leaves your computer. Switch to `tesseract` in preferences if that matters to you. This project uses an unofficial endpoint, so it may change or stop working without notice.

Language codes for Tesseract map to installed language data. The helper has built-in mappings for `en`, `hi`, `mr`, `fr`, `de`, `es`, `it`, `pt`, and `ru`. You may need to install the matching Tesseract language package.

## Troubleshooting

**The panel doesn't open when I tap with the pen**
Enable *Debug logging* in preferences, then run:

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

Tap a text field with the pen. The log shows whether the pen was detected and whether the app reported a text field. The hotkey and top-bar icon always work.

**Extension errors**

```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep -i penink
```

**Nothing is typed in some apps**
Apps without Wayland text-input support receive the text via clipboard plus Ctrl+V (Ctrl+Shift+V in terminals). Your previous clipboard contents are restored afterwards.

**Test the recognition helper on its own**

```bash
cd ~/.local/share/gnome-shell/extensions/penink@fedora.local
echo '{"strokes":[[[0,0,0],[50,50,10]]],"width":400,"height":200}' | python3 recognize.py
```

**"Extension not found" after installing**
On Wayland you must log out and back in once. On X11 you can restart GNOME Shell with `Alt+F2`, then `r`, then Enter.

## Uninstall

```bash
gnome-extensions disable penink@fedora.local
rm -rf ~/.local/share/gnome-shell/extensions/penink@fedora.local
```

## Project structure

```
penink-extension/
├── install.sh                       # installer script
└── penink@fedora.local/
    ├── extension.js                 # panel, ink capture, pen detection, text insertion
    ├── recognize.py                 # stroke recognition helper (Google / Tesseract)
    ├── prefs.js                     # preferences window
    ├── stylesheet.css               # panel styling
    ├── metadata.json                # extension metadata
    └── schemas/                     # GSettings schema
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security issue, see [SECURITY.md](SECURITY.md).

## License

Released under the [MIT License](LICENSE).
