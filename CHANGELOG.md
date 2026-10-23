# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1] - 2026-10-11

### Added
- Handwriting panel at the bottom of the screen for pen and stylus input.
- Auto-open when a text field is tapped with the pen; also available via **Super+Shift+H** and a top-bar icon.
- Text insertion through GNOME's input-method path, with a clipboard + Ctrl+V fallback (Ctrl+Shift+V in terminals).
- Two recognition engines: Google handwriting service (online) and Tesseract (offline).
- Language selection, conversion delay, auto-spacing, and shortcut settings in a preferences window.
- Panel buttons for Space, Backspace, Enter, Clear, and Close.
- Debug logging option for pen and text-focus detection.
- Support for GNOME Shell 45 through 50.
- `install.sh` installer with GNOME version and dependency checks.
