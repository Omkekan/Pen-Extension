#!/usr/bin/env python3
"""Handwriting recognition helper for the Pen Ink GNOME extension.

Reads one JSON object on stdin:
    {"strokes": [[[x, y, t_ms], ...], ...], "width": W, "height": H,
     "backend": "google" | "tesseract", "language": "en"}

Writes one JSON object on stdout:
    {"text": "recognized text"}   or   {"error": "message"}
"""

import json
import os
import subprocess
import sys
import tempfile
import urllib.request

GOOGLE_URL = (
    "https://inputtools.google.com/request"
    "?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8"
)

TESS_LANGS = {"en": "eng", "hi": "hin", "mr": "mar", "fr": "fra", "de": "deu",
              "es": "spa", "it": "ita", "pt": "por", "ru": "rus"}


def recognize_google(strokes, width, height, language):
    ink = []
    for s in strokes:
        if not s:
            continue
        if len(s) == 1:           # a lone dot -> give it two points
            s = [s[0], s[0]]
        ink.append([[p[0] for p in s], [p[1] for p in s], [p[2] for p in s]])
    payload = {
        "requests": [{
            "writing_guide": {"writing_area_width": width,
                              "writing_area_height": height},
            "ink": ink,
            "language": language or "en",
        }]
    }
    req = urllib.request.Request(
        GOOGLE_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=8) as resp:
        data = json.load(resp)
    if not data or data[0] != "SUCCESS":
        raise RuntimeError("Google handwriting service returned: %r" % (data[:1],))
    candidates = data[1][0][1]
    return candidates[0] if candidates else ""


def render_strokes(strokes):
    """Draw strokes as black ink on a white PIL image sized for OCR."""
    from PIL import Image, ImageDraw

    pts = [p for s in strokes for p in s]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, y0 = min(xs), min(ys)
    bw = max(max(xs) - x0, 1)
    bh = max(max(ys) - y0, 1)

    scale = min(max(110.0 / bh, 0.4), 4.0)
    scale = min(scale, 3000.0 / bw)
    pad, lw = 40, 7
    r = lw // 2

    img = Image.new("L", (int(bw * scale) + 2 * pad, int(bh * scale) + 2 * pad), 255)
    draw = ImageDraw.Draw(img)
    for s in strokes:
        q = [((p[0] - x0) * scale + pad, (p[1] - y0) * scale + pad) for p in s]
        if len(q) > 1:
            draw.line(q, fill=0, width=lw, joint="curve")
        for x, y in q:
            draw.ellipse([x - r, y - r, x + r, y + r], fill=0)
    return img


def recognize_tesseract(strokes, language):
    img = render_strokes(strokes)
    lang = TESS_LANGS.get(language, language or "eng")
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "ink.png")
        img.save(path)
        try:
            out = subprocess.run(
                ["tesseract", path, "stdout", "-l", lang, "--psm", "7"],
                capture_output=True, text=True, timeout=20,
            )
        except FileNotFoundError:
            raise RuntimeError("tesseract is not installed (sudo dnf install tesseract)")
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip() or "tesseract failed")
    return " ".join(out.stdout.split())


def main():
    try:
        req = json.load(sys.stdin)
        strokes = [s for s in req.get("strokes", []) if s]
        if not strokes:
            print(json.dumps({"text": ""}))
            return
        backend = req.get("backend", "google")
        language = req.get("language", "en")
        if backend == "tesseract":
            text = recognize_tesseract(strokes, language)
        else:
            text = recognize_google(
                strokes, int(req.get("width", 800)), int(req.get("height", 200)), language)
        print(json.dumps({"text": text.strip()}))
    except Exception as e:  # noqa: BLE001 - report everything back to the extension
        print(json.dumps({"error": "%s: %s" % (type(e).__name__, e)}))


if __name__ == "__main__":
    main()
