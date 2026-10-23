// Pen Ink Handwriting - GNOME Shell extension (GNOME 45+, ES modules)
//
// Flow:  pen strokes -> recognize.py (helper) -> text -> typed into the focused app
//
// Text insertion order of preference:
//   1. Main.inputMethod.commit()  (same path the GNOME on-screen keyboard uses; clean, no clipboard)
//   2. clipboard + Ctrl+V / Ctrl+Shift+V via a virtual keyboard (fallback for apps without text-input support)

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

const TERMINAL_HINTS = [
    'terminal', 'console', 'ptyxis', 'kitty', 'alacritty',
    'konsole', 'tilix', 'xterm', 'wezterm', 'foot',
];

function logErr(what, e) {
    console.error(`[penink] ${what}: ${e?.message ?? e}`);
}

class InkPanel {
    constructor(extension, settings) {
        this._ext = extension;
        this._settings = settings;

        this._strokes = [];     // strokes not yet sent for recognition
        this._inflight = [];    // strokes currently being recognized (drawn dimmed)
        this._current = null;
        this._drawing = false;
        this._t0 = 0;
        this._timerId = 0;
        this._busy = false;
        this._session = 0;
        this._destroyed = false;
        this._committedAny = false;
        this._vdevice = null;
        this.autoOpened = false;

        this.actor = new St.BoxLayout({
            style_class: 'penink-panel',
            vertical: true,
            visible: false,
            reactive: true,
        });

        const bar = new St.BoxLayout({style_class: 'penink-bar'});
        this._status = new St.Label({
            text: '',
            style_class: 'penink-status',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        bar.add_child(this._status);
        bar.add_child(this._makeButton('Space', () => this._pressKeys([Clutter.KEY_space])));
        bar.add_child(this._makeButton('\u232B', () => this._pressKeys([Clutter.KEY_BackSpace])));
        bar.add_child(this._makeButton('\u23CE', () => this._pressKeys([Clutter.KEY_Return])));
        bar.add_child(this._makeButton('Clear', () => this.clear()));
        bar.add_child(this._makeButton('\u2715', () => this.hide()));
        this.actor.add_child(bar);

        this._area = new St.DrawingArea({
            style_class: 'penink-area',
            x_expand: true,
            y_expand: true,
            reactive: true,
        });
        this._area.connect('repaint', this._onRepaint.bind(this));
        this._area.connect('event', this._onEvent.bind(this));
        this._area.connect('leave-event', () => {
            if (this._drawing)
                this._endStroke();
            return Clutter.EVENT_PROPAGATE;
        });
        this.actor.add_child(this._area);

        Main.layoutManager.addTopChrome(this.actor);
    }

    get visible() {
        return this.actor.visible;
    }

    // ---------- UI helpers ----------

    _makeButton(label, callback) {
        // can_focus:false is important: it keeps keyboard focus in the app you are typing into
        const button = new St.Button({
            label,
            style_class: 'penink-button',
            can_focus: false,
            reactive: true,
            track_hover: true,
        });
        button.connect('clicked', callback);
        return button;
    }

    _setStatus(text) {
        this._status.text = text;
    }

    show(auto = false) {
        if (this.actor.visible)
            return;
        const mon = Main.layoutManager.currentMonitor ?? Main.layoutManager.primaryMonitor;
        const w = Math.min(Math.round(mon.width * 0.9), 1400);
        const h = Math.min(Math.round(mon.height * 0.4), 340);
        this.actor.set_size(w, h);
        this.actor.set_position(
            mon.x + Math.round((mon.width - w) / 2),
            mon.y + mon.height - h);
        this.autoOpened = auto;
        this._committedAny = false;
        this._setStatus('Write with your pen\u2026');
        this.actor.show();
    }

    hide() {
        this._session++;               // invalidates any in-flight recognition result
        this._cancelTimer();
        this._strokes = [];
        this._inflight = [];
        this._current = null;
        this._drawing = false;
        this.actor.hide();
        this._area.queue_repaint();
    }

    toggle() {
        if (this.visible)
            this.hide();
        else
            this.show(false);
    }

    clear() {
        this._cancelTimer();
        this._strokes = [];
        this._current = null;
        this._drawing = false;
        this._setStatus('Cleared');
        this._area.queue_repaint();
    }

    destroy() {
        this._destroyed = true;
        this._cancelTimer();
        this._vdevice = null;
        Main.layoutManager.removeChrome(this.actor);
        this.actor.destroy();
    }

    // ---------- Drawing ----------

    _onRepaint(area) {
        const cr = area.get_context();
        const [w, h] = area.get_surface_size();

        // faint writing guide line
        cr.setSourceRGBA(1, 1, 1, 0.12);
        cr.setLineWidth(1);
        cr.moveTo(16, Math.round(h * 0.72));
        cr.lineTo(w - 16, Math.round(h * 0.72));
        cr.stroke();

        cr.setLineCap(1);   // round
        cr.setLineJoin(1);  // round
        cr.setLineWidth(3.5);

        const drawStrokes = (strokes, alpha) => {
            cr.setSourceRGBA(1, 1, 1, alpha);
            for (const stroke of strokes) {
                if (!stroke.length)
                    continue;
                cr.moveTo(stroke[0][0], stroke[0][1]);
                if (stroke.length === 1)
                    cr.lineTo(stroke[0][0], stroke[0][1]);
                for (let i = 1; i < stroke.length; i++)
                    cr.lineTo(stroke[i][0], stroke[i][1]);
                cr.stroke();
            }
        };
        drawStrokes(this._inflight, 0.45);
        drawStrokes(this._strokes, 1.0);

        cr.$dispose();
    }

    _point(event) {
        const [ex, ey] = event.get_coords();
        const [ok, x, y] = this._area.transform_stage_point(ex, ey);
        if (!ok)
            return null;
        const t = Math.round(GLib.get_monotonic_time() / 1000 - this._t0);
        return [Math.round(x), Math.round(y), t];
    }

    _onEvent(_actor, event) {
        const T = Clutter.EventType;
        const type = event.type();

        if (type === T.BUTTON_PRESS || type === T.TOUCH_BEGIN) {
            if (type === T.BUTTON_PRESS && event.get_button() > 1)
                return Clutter.EVENT_PROPAGATE;
            this._beginStroke(event);
            return Clutter.EVENT_STOP;
        }
        if (type === T.MOTION || type === T.TOUCH_UPDATE) {
            if (!this._drawing)
                return Clutter.EVENT_PROPAGATE;
            this._extendStroke(event);
            return Clutter.EVENT_STOP;
        }
        if (type === T.BUTTON_RELEASE || type === T.TOUCH_END || type === T.TOUCH_CANCEL) {
            if (!this._drawing)
                return Clutter.EVENT_PROPAGATE;
            this._extendStroke(event);
            this._endStroke();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _beginStroke(event) {
        if (this._drawing)
            return;  // duplicate (touch + emulated pointer) event
        this._cancelTimer();
        if (this._strokes.length === 0)
            this._t0 = GLib.get_monotonic_time() / 1000;
        const pt = this._point(event);
        if (!pt)
            return;
        this._drawing = true;
        this._current = [pt];
        this._strokes.push(this._current);
        this._area.queue_repaint();
    }

    _extendStroke(event) {
        const pt = this._point(event);
        if (!pt || !this._current)
            return;
        const last = this._current[this._current.length - 1];
        if (last[0] === pt[0] && last[1] === pt[1])
            return;
        this._current.push(pt);
        this._area.queue_repaint();
    }

    _endStroke() {
        this._drawing = false;
        this._current = null;
        this._scheduleRecognize();
    }

    // ---------- Recognition ----------

    _cancelTimer() {
        if (this._timerId) {
            GLib.Source.remove(this._timerId);
            this._timerId = 0;
        }
    }

    _scheduleRecognize() {
        this._cancelTimer();
        const delay = this._settings.get_int('idle-delay');
        this._timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this._timerId = 0;
            this._recognize();
            return GLib.SOURCE_REMOVE;
        });
    }

    _recognize() {
        if (this._drawing || !this._strokes.length)
            return;
        if (this._busy) {
            this._scheduleRecognize();
            return;
        }

        this._busy = true;
        this._inflight = this._strokes;
        this._strokes = [];
        this._area.queue_repaint();
        this._setStatus('Recognizing\u2026');

        const session = this._session;
        const payload = {
            strokes: this._inflight,
            width: Math.round(this._area.width),
            height: Math.round(this._area.height),
            backend: this._settings.get_string('backend'),
            language: this._settings.get_string('language'),
        };

        let proc;
        try {
            proc = Gio.Subprocess.new(
                ['python3', GLib.build_filenamev([this._ext.path, 'recognize.py'])],
                Gio.SubprocessFlags.STDIN_PIPE |
                Gio.SubprocessFlags.STDOUT_PIPE |
                Gio.SubprocessFlags.STDERR_PIPE);
        } catch (e) {
            this._finishRecognition(session, null, `cannot start python3 (${e.message})`);
            return;
        }

        proc.communicate_utf8_async(JSON.stringify(payload), null, (p, res) => {
            if (this._destroyed)
                return;
            let text = null, err = null;
            try {
                const [, stdout, stderr] = p.communicate_utf8_finish(res);
                if (stdout && stdout.trim()) {
                    const out = JSON.parse(stdout);
                    if (out.error)
                        err = out.error;
                    else
                        text = out.text ?? '';
                } else {
                    err = (stderr || 'helper returned nothing').trim();
                }
            } catch (e) {
                err = e.message;
            }
            this._finishRecognition(session, text, err);
        });
    }

    _finishRecognition(session, text, err) {
        this._busy = false;
        this._inflight = [];
        this._area.queue_repaint();

        if (session === this._session && this.visible) {
            if (err) {
                this._setStatus(`Error: ${String(err).slice(0, 110)}`);
            } else if (text) {
                this._commit(text);
                this._setStatus(`Inserted: ${text}`);
            } else {
                this._setStatus('Couldn\u2019t read that \u2014 try again');
            }
        }
        if (this._strokes.length && !this._drawing && !this._timerId)
            this._scheduleRecognize();
    }

    // ---------- Text insertion ----------

    _commit(text) {
        let out = text;
        if (this._committedAny && this._settings.get_boolean('auto-space'))
            out = ` ${text}`;
        this._committedAny = true;

        try {
            const im = Main.inputMethod;
            if (im && im.currentFocus) {
                im.commit(out);
                return;
            }
        } catch (e) {
            logErr('inputMethod.commit failed, falling back to paste', e);
        }
        this._pasteViaClipboard(out);
    }

    _pasteViaClipboard(text) {
        const clipboard = St.Clipboard.get_default();
        const type = St.ClipboardType.CLIPBOARD;

        clipboard.get_text(type, (_c, previous) => {
            if (this._destroyed)
                return;
            clipboard.set_text(type, text);

            const wmClass = (global.display.focus_window?.get_wm_class() ?? '').toLowerCase();
            const isTerminal = TERMINAL_HINTS.some(h => wmClass.includes(h));
            const combo = isTerminal
                ? [Clutter.KEY_Control_L, Clutter.KEY_Shift_L, Clutter.KEY_v]
                : [Clutter.KEY_Control_L, Clutter.KEY_v];

            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 60, () => {
                if (this._destroyed)
                    return GLib.SOURCE_REMOVE;
                this._pressKeys(combo);
                // put the user's original clipboard back
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 400, () => {
                    if (!this._destroyed && previous !== null && previous !== undefined)
                        clipboard.set_text(type, previous);
                    return GLib.SOURCE_REMOVE;
                });
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    _getVirtualDevice() {
        if (!this._vdevice) {
            const seat = Clutter.get_default_backend().get_default_seat();
            this._vdevice = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
        }
        return this._vdevice;
    }

    _pressKeys(keys) {
        try {
            const dev = this._getVirtualDevice();
            for (const k of keys)
                dev.notify_keyval(GLib.get_monotonic_time(), k, Clutter.KeyState.PRESSED);
            for (const k of [...keys].reverse())
                dev.notify_keyval(GLib.get_monotonic_time(), k, Clutter.KeyState.RELEASED);
        } catch (e) {
            logErr('virtual keyboard failed', e);
            this._setStatus('Could not send key');
        }
    }
}

export default class PenInkExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._panel = new InkPanel(this, this._settings);
        this._autoId = 0;

        // Top-bar icon with a small menu
        this._indicator = new PanelMenu.Button(0.0, 'Pen Ink', false);
        this._indicator.add_child(new St.Icon({
            icon_name: 'document-edit-symbolic',
            style_class: 'system-status-icon',
        }));
        this._indicator.menu.addAction('Show / hide handwriting panel', () => this._panel.toggle());
        this._indicator.menu.addAction('Preferences', () => this.openPreferences());
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        // Global shortcut
        Main.wm.addKeybinding(
            'toggle-shortcut',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this._panel.toggle());

        // Pen detection: watch every input event before it reaches apps (we never consume them)
        this._capturedId = global.stage.connect('captured-event',
            (_stage, event) => this._onCaptured(event));
    }

    disable() {
        if (this._capturedId) {
            global.stage.disconnect(this._capturedId);
            this._capturedId = 0;
        }
        if (this._autoId) {
            GLib.Source.remove(this._autoId);
            this._autoId = 0;
        }
        Main.wm.removeKeybinding('toggle-shortcut');

        this._indicator?.destroy();
        this._indicator = null;
        this._panel?.destroy();
        this._panel = null;
        this._settings = null;
    }

    _debug(...args) {
        if (this._settings?.get_boolean('debug'))
            console.log('[penink]', ...args);
    }

    _isPen(event) {
        try {
            const tool = event.get_device_tool?.();
            if (tool) {
                const TT = Clutter.InputDeviceToolType;
                const tt = tool.get_tool_type();
                return tt === TT.PEN || tt === TT.PENCIL || tt === TT.BRUSH || tt === TT.AIRBRUSH;
            }
            const dev = event.get_source_device?.();
            if (dev) {
                const dt = dev.get_device_type();
                const DT = Clutter.InputDeviceType;
                return dt === DT.PEN_DEVICE || dt === DT.TABLET_DEVICE;
            }
        } catch (e) {
            logErr('pen detection', e);
        }
        return false;
    }

    _onCaptured(event) {
        try {
            if (!this._settings || !this._settings.get_boolean('auto-open'))
                return Clutter.EVENT_PROPAGATE;

            const T = Clutter.EventType;
            const type = event.type();
            if (type !== T.BUTTON_RELEASE && type !== T.TOUCH_END)
                return Clutter.EVENT_PROPAGATE;
            if (Main.overview.visible)
                return Clutter.EVENT_PROPAGATE;

            // Ignore taps on our own panel
            const src = event.get_source();
            if (src && this._panel.actor.contains(src))
                return Clutter.EVENT_PROPAGATE;

            const pen = this._isPen(event);
            if (this._settings.get_boolean('debug')) {
                const dev = event.get_source_device?.();
                this._debug('release: pen =', pen,
                    '| device =', dev?.get_device_name?.(),
                    '| type =', dev?.get_device_type?.(),
                    '| textFocus =', !!Main.inputMethod?.currentFocus);
            }
            if (!pen)
                return Clutter.EVENT_PROPAGATE;

            // Give the app a moment to enable text input after the tap
            if (this._autoId)
                GLib.Source.remove(this._autoId);
            this._autoId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
                this._autoId = 0;
                if (!this._panel)
                    return GLib.SOURCE_REMOVE;
                const focused = !!Main.inputMethod?.currentFocus;
                if (focused && !this._panel.visible)
                    this._panel.show(true);
                else if (!focused && this._panel.visible && this._panel.autoOpened)
                    this._panel.hide();
                return GLib.SOURCE_REMOVE;
            });
        } catch (e) {
            logErr('captured-event handler', e);
        }
        return Clutter.EVENT_PROPAGATE;
    }
}
