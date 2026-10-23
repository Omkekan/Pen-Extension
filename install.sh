#!/usr/bin/env bash
# Installs the Pen Ink Handwriting extension for the current user.
set -euo pipefail

UUID="penink@fedora.local"
SRC="$(cd "$(dirname "$0")" && pwd)/$UUID"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

if ! command -v gnome-shell >/dev/null 2>&1; then
    echo "gnome-shell not found. This extension needs GNOME (Fedora Workstation)." >&2
    exit 1
fi

SHELL_MAJOR="$(gnome-shell --version | grep -oE '[0-9]+' | head -n1)"
if [ "$SHELL_MAJOR" -lt 45 ]; then
    echo "GNOME Shell $SHELL_MAJOR is too old; this extension needs 45 or newer." >&2
    exit 1
fi

if ! command -v glib-compile-schemas >/dev/null 2>&1; then
    echo "Missing glib-compile-schemas. Install it with:  sudo dnf install glib2-devel" >&2
    exit 1
fi

echo "Installing to $DEST"
mkdir -p "$DEST"
cp -r "$SRC/." "$DEST/"
chmod +x "$DEST/recognize.py"

# Make sure the running GNOME Shell version is listed in metadata.json
python3 - "$DEST/metadata.json" "$SHELL_MAJOR" <<'PY'
import json, sys
path, ver = sys.argv[1], sys.argv[2]
with open(path) as f:
    meta = json.load(f)
if ver not in meta["shell-version"]:
    meta["shell-version"].append(ver)
    with open(path, "w") as f:
        json.dump(meta, f, indent=2)
PY

glib-compile-schemas "$DEST/schemas"

echo
python3 -c "import PIL" 2>/dev/null || echo "Note: python3-pillow missing (only needed for the offline engine): sudo dnf install python3-pillow"
command -v tesseract >/dev/null 2>&1 || echo "Note: tesseract missing (only needed for the offline engine):  sudo dnf install tesseract"

cat <<EOF

Installed.

Next steps:
  1. Log out and log back in (required on Wayland so GNOME Shell sees the new extension).
  2. Run:  gnome-extensions enable $UUID
  3. Tap a text field with your pen, press Super+Shift+H, or click the pen icon in the top bar.

Settings:  gnome-extensions prefs $UUID
EOF
