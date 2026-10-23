# Pen Ink Handwriting (GNOME Shell extension)

Write with your pen in a panel at the bottom of the screen; the text is typed into whatever app has focus.

## Install

```bash
unzip penink-extension.zip && cd penink-extension
chmod +x install.sh && ./install.sh
# log out / log in, then:
gnome-extensions enable penink@fedora.local
```

Requires GNOME 45+ (Fedora Workstation) and `glib2-devel` (for `glib-compile-schemas`).

## Use

- **Tap a text field with the pen** and the panel opens (turn off in Preferences).
- Or press **Super+Shift+H**, or use the pen icon in the top bar.
- Write; after a short pause (default 1.2 s) the ink is converted and inserted.
- Panel buttons: Space, Backspace, Enter, Clear, Close.

## Recognition engines

| Engine | Quality | Offline | Privacy |
|---|---|---|---|
| `google` (default) | Good | No | Pen strokes are sent to Google's handwriting service |
| `tesseract` | Weak for handwriting, ok for neat print | Yes | Stays on your machine |

Switch in Preferences (`gnome-extensions prefs penink@fedora.local`). For the offline engine:
`sudo dnf install tesseract python3-pillow`. Use a language code such as `hi` or `mr` for other languages.

## Troubleshooting

- **Panel doesn't open on pen tap:** enable *Debug logging* in Preferences, then run
  `journalctl -f -o cat /usr/bin/gnome-shell` and tap a text field with the pen.
  You'll see whether the pen was detected and whether the app reported a text field.
  The hotkey and top-bar icon always work.
- **Extension errors:** `journalctl -f -o cat /usr/bin/gnome-shell | grep -i penink`
- **Nothing typed in some apps:** apps without Wayland text-input support get the text via
  clipboard + Ctrl+V (Ctrl+Shift+V in terminals); your previous clipboard is restored afterwards.
- **Test the helper alone:**
  `echo '{"strokes":[[[0,0,0],[50,50,10]]],"width":400,"height":200}' | python3 recognize.py`

## Files

- `extension.js` panel, ink capture, pen detection, text insertion
- `recognize.py` stroke recognition (Google / Tesseract)
- `prefs.js`, `schemas/`, `stylesheet.css`, `metadata.json`
