import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const BACKENDS = ['google', 'tesseract'];

export default class PenInkPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Pen Ink',
            icon_name: 'document-edit-symbolic',
        });
        window.add(page);

        // ---- Behaviour ----
        const behaviour = new Adw.PreferencesGroup({title: 'Behaviour'});
        page.add(behaviour);

        const autoOpen = new Adw.SwitchRow({
            title: 'Open automatically on pen tap',
            subtitle: 'Show the panel when you tap a text field with the pen',
        });
        settings.bind('auto-open', autoOpen, 'active', Gio.SettingsBindFlags.DEFAULT);
        behaviour.add(autoOpen);

        const autoSpace = new Adw.SwitchRow({
            title: 'Add a space between chunks',
            subtitle: 'Insert a space before each new piece of handwriting',
        });
        settings.bind('auto-space', autoSpace, 'active', Gio.SettingsBindFlags.DEFAULT);
        behaviour.add(autoSpace);

        const delay = new Adw.SpinRow({
            title: 'Convert after pause (ms)',
            subtitle: 'How long to wait after you lift the pen before converting',
            adjustment: new Gtk.Adjustment({
                lower: 300,
                upper: 5000,
                step_increment: 100,
                page_increment: 500,
                value: settings.get_int('idle-delay'),
            }),
        });
        settings.bind('idle-delay', delay, 'value', Gio.SettingsBindFlags.DEFAULT);
        behaviour.add(delay);

        const shortcut = new Adw.EntryRow({title: 'Toggle shortcut (e.g. <Super><Shift>h)'});
        shortcut.text = settings.get_strv('toggle-shortcut')[0] ?? '';
        shortcut.connect('changed', () => {
            const t = shortcut.text.trim();
            settings.set_strv('toggle-shortcut', t ? [t] : []);
        });
        behaviour.add(shortcut);

        // ---- Recognition ----
        const recog = new Adw.PreferencesGroup({
            title: 'Recognition',
            description: 'Google sends your pen strokes (not screenshots) to Google\u2019s handwriting service. ' +
                'Tesseract runs fully offline but is much worse at handwriting.',
        });
        page.add(recog);

        const combo = new Adw.ComboRow({
            title: 'Engine',
            model: Gtk.StringList.new(['Google Handwriting (online)', 'Tesseract (offline)']),
        });
        combo.selected = Math.max(0, BACKENDS.indexOf(settings.get_string('backend')));
        combo.connect('notify::selected', () => {
            settings.set_string('backend', BACKENDS[combo.selected]);
        });
        recog.add(combo);

        const lang = new Adw.EntryRow({title: 'Language code (en, hi, mr, fr, de \u2026)'});
        settings.bind('language', lang, 'text', Gio.SettingsBindFlags.DEFAULT);
        recog.add(lang);

        // ---- Troubleshooting ----
        const trouble = new Adw.PreferencesGroup({title: 'Troubleshooting'});
        page.add(trouble);

        const debug = new Adw.SwitchRow({
            title: 'Debug logging',
            subtitle: 'Log pen/text-field detection to the journal (journalctl -f -o cat /usr/bin/gnome-shell)',
        });
        settings.bind('debug', debug, 'active', Gio.SettingsBindFlags.DEFAULT);
        trouble.add(debug);
    }
}
