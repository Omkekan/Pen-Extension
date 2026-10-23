# Security Policy

## Supported versions

Only the latest release receives fixes.

| Version | Supported |
|---|---|
| Latest | Yes |
| Older | No |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately using GitHub's "Report a vulnerability" button on the repository's **Security** tab (Security, then Advisories, then Report a vulnerability). If that isn't available, contact the maintainer at the email listed on their GitHub profile.

Include:

- A description of the issue and its impact
- Steps to reproduce
- Your distro, GNOME Shell version, and session type (Wayland or X11)

You can expect an initial response within about 7 days. Once a fix is available, the issue will be disclosed in the release notes.

## Known privacy considerations

These are by design and not vulnerabilities, but you should be aware of them:

- **Online recognition:** with the default `google` engine, pen strokes are sent over HTTPS to `inputtools.google.com`. Do not use it to write sensitive information such as passwords. Use the offline `tesseract` engine instead.
- **Clipboard fallback:** in apps without Wayland text-input support, recognized text is briefly placed on the clipboard and pasted. The previous clipboard contents are restored afterwards, but clipboard managers may record the temporary text.
- **Virtual keyboard:** the extension creates a virtual keyboard device to send key presses (Space, Backspace, Enter, and paste shortcuts).
