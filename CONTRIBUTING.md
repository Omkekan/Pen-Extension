# Contributing to Pen Ink Handwriting

Thanks for your interest in improving this extension. Bug reports, testing on different distros and hardware, and pull requests are all welcome.

## Reporting bugs

Please open an issue and include:

- Your distro and version (for example, Ubuntu 24.04)
- GNOME Shell version: `gnome-shell --version`
- Session type: `echo $XDG_SESSION_TYPE` (`wayland` or `x11`)
- Your pen or tablet hardware
- Which app you were typing into
- Relevant log output. Turn on *Debug logging* in the extension preferences, then run:
  ```bash
  journalctl -f -o cat /usr/bin/gnome-shell | grep -i penink
  ```
- Steps to reproduce

## Suggesting features

Open an issue describing the problem you want to solve and how you imagine it working. Ideas that are welcome include better offline recognition, support for more languages, and improved pen detection.

## Development setup

1. Fork and clone the repository.
2. Install the extension from your working copy:
   ```bash
   ./install.sh
   ```
3. After changing code, reload GNOME Shell:
   - **Wayland:** log out and back in (or test in a nested session with `dbus-run-session gnome-shell --nested --wayland`)
   - **X11:** press `Alt+F2`, type `r`, press Enter
4. Watch the logs while testing:
   ```bash
   journalctl -f -o cat /usr/bin/gnome-shell | grep -i penink
   ```

If you change `schemas/org.gnome.shell.extensions.penink.gschema.xml`, recompile it:

```bash
glib-compile-schemas ~/.local/share/gnome-shell/extensions/penink@fedora.local/schemas
```

## Testing the recognition helper

`recognize.py` reads JSON from stdin and writes JSON to stdout, so you can test it without GNOME:

```bash
echo '{"strokes":[[[0,0,0],[50,50,10]]],"width":400,"height":200}' | python3 penink@fedora.local/recognize.py
```

## Pull requests

- Keep each pull request focused on one change.
- Describe what you changed and why, and how you tested it (distro, GNOME version, Wayland or X11).
- Follow the existing code style: ES modules and 4-space indentation in JavaScript, standard PEP 8 in Python.
- Do not add dependencies that need to be installed system-wide unless they are optional and clearly documented.
- Update `README.md` and `CHANGELOG.md` if your change affects users.

## Privacy

This extension can send pen strokes to an online service. Any change that sends data anywhere new must be opt-in, clearly documented in the README, and called out in the pull request description.

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
