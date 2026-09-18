import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {POSITIONS, newPreset, loadPresets, savePresets} from './presets.js';

// Built lazily: gettext works only once the extension object exists.
function positionLabels() {
    return {
        'top-left': _('Top left'),
        'top': _('Top'),
        'top-right': _('Top right'),
        'left': _('Left'),
        'center': _('Center'),
        'right': _('Right'),
        'bottom-left': _('Bottom left'),
        'bottom': _('Bottom'),
        'bottom-right': _('Bottom right'),
        'keep': _('Where it is now'),
    };
}

// GNOME settings that hold keyboard shortcuts; checked for conflicts before saving one.
const GNOME_SHORTCUT_SCHEMAS = [
    'org.gnome.desktop.wm.keybindings',
    'org.gnome.mutter.keybindings',
    'org.gnome.mutter.wayland.keybindings',
    'org.gnome.shell.keybindings',
    'org.gnome.settings-daemon.plugins.media-keys',
];

const POSITION_ARROWS = {
    'top-left': '↖', 'top': '↑', 'top-right': '↗',
    'left': '←', 'center': '●', 'right': '→',
    'bottom-left': '↙', 'bottom': '↓', 'bottom-right': '↘',
};

export default class PresizePrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();
        this._labels = positionLabels();
        this._presets = loadPresets(this._settings);
        this._rows = [];

        const page = new Adw.PreferencesPage();
        window.add(page);

        const addButton = new Gtk.Button({
            icon_name: 'list-add-symbolic',
            tooltip_text: _('Add a preset'),
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
        });
        addButton.connect('clicked', () => {
            this._presets.push(newPreset());
            this._save();
            this._rebuild(window);
            this._rows.at(-1).expanded = true;
        });
        this._group = new Adw.PreferencesGroup({
            title: _('Presets'),
            description: _('Press a preset’s shortcut and the active window takes that size and place. Click a preset to change it.'),
            header_suffix: addButton,
        });
        page.add(this._group);
        this._rebuild(window);

        window.connect('close-request', () => {
            this._settings = null;
        });
    }

    _save() {
        savePresets(this._settings, this._presets);
    }

    _rebuild(window) {
        for (const row of this._rows)
            this._group.remove(row);
        this._rows = this._presets.map((preset, index) => this._presetRow(window, preset, index));
        for (const row of this._rows)
            this._group.add(row);
    }

    _presetRow(window, preset, index) {
        const row = new Adw.ExpanderRow();
        this._makeReorderable(window, row, index);
        const shortcutLabel = new Gtk.ShortcutLabel({disabled_text: _('No shortcut'), valign: Gtk.Align.CENTER});
        row.add_suffix(shortcutLabel);

        const refreshHeader = () => {
            row.title = preset.name || _('Unnamed preset');
            const unit = preset.unit === '%' ? _('% of screen') : _('px');
            row.subtitle = `${preset.width} × ${preset.height} ${unit}  ·  ${this._labels[preset.position] ?? preset.position}`;
            shortcutLabel.accelerator = preset.shortcut;
        };

        // Name
        const nameRow = new Adw.EntryRow({title: _('Name'), text: preset.name});
        nameRow.connect('changed', () => {
            preset.name = nameRow.text;
            this._save();
            refreshHeader();
        });
        row.add_row(nameRow);

        // Unit
        const unitRow = new Adw.ComboRow({
            title: _('Measure size in'),
            model: Gtk.StringList.new([_('Pixels'), _('Percent of screen')]),
            selected: preset.unit === '%' ? 1 : 0,
        });
        row.add_row(unitRow);

        // Width / height
        const widthRow = this._spinRow(_('Width'), preset.width);
        const heightRow = this._spinRow(_('Height'), preset.height);
        row.add_row(widthRow);
        row.add_row(heightRow);
        const applyUnit = () => {
            const percent = unitRow.selected === 1;
            const upper = percent ? 100 : 20000;
            for (const spin of [widthRow, heightRow]) {
                spin.adjustment.upper = upper;
                if (spin.value > upper)
                    spin.value = upper;
            }
        };
        applyUnit();
        unitRow.connect('notify::selected', () => {
            preset.unit = unitRow.selected === 1 ? '%' : 'px';
            applyUnit();
            this._save();
            refreshHeader();
        });
        widthRow.connect('notify::value', () => {
            preset.width = widthRow.value;
            this._save();
            refreshHeader();
        });
        heightRow.connect('notify::value', () => {
            preset.height = heightRow.value;
            this._save();
            refreshHeader();
        });

        // Position: 3x3 grid of arrows + "leave it where it is"
        const keepRow = new Adw.SwitchRow({
            title: _('Leave the window where it is'),
            subtitle: _('Only change its size'),
            active: preset.position === 'keep',
        });
        const positionRow = new Adw.ActionRow({title: _('Put the window'), subtitle: this._labels[preset.position]});
        const grid = new Gtk.Grid({row_spacing: 4, column_spacing: 4, valign: Gtk.Align.CENTER, margin_top: 6, margin_bottom: 6});
        const buttons = new Map();
        let first = null;
        POSITIONS.forEach((pos, i) => {
            const button = new Gtk.ToggleButton({
                label: POSITION_ARROWS[pos],
                tooltip_text: this._labels[pos],
                width_request: 36,
                height_request: 32,
                css_classes: ['flat'],
                active: preset.position === pos,
            });
            if (first)
                button.group = first;
            else
                first = button;
            button.connect('toggled', () => {
                if (!button.active)
                    return;
                preset.position = pos;
                keepRow.active = false;
                positionRow.subtitle = this._labels[pos];
                this._save();
                refreshHeader();
            });
            grid.attach(button, i % 3, Math.floor(i / 3), 1, 1);
            buttons.set(pos, button);
        });
        positionRow.add_suffix(grid);
        row.add_row(keepRow);
        row.add_row(positionRow);

        keepRow.connect('notify::active', () => {
            if (keepRow.active) {
                preset.position = 'keep';
                for (const b of buttons.values())
                    b.active = false;
            } else if (preset.position === 'keep') {
                preset.position = 'center';
                buttons.get('center').active = true;
            }
            grid.sensitive = !keepRow.active;
            positionRow.subtitle = this._labels[preset.position];
            this._save();
            refreshHeader();
        });
        grid.sensitive = !keepRow.active;

        // Shortcut
        const shortcutRow = new Adw.ActionRow({
            title: _('Shortcut'),
            subtitle: _('Click here, then press the keys you want'),
            activatable: true,
        });
        const shortcutInner = new Gtk.ShortcutLabel({disabled_text: _('No shortcut'), valign: Gtk.Align.CENTER});
        shortcutInner.accelerator = preset.shortcut;
        shortcutRow.add_suffix(shortcutInner);
        shortcutRow.connect('activated', () => {
            this._captureShortcut(window, preset, accel => {
                preset.shortcut = accel;
                shortcutInner.accelerator = accel;
                this._save();
                refreshHeader();
            });
        });
        row.add_row(shortcutRow);

        // Remove
        const removeButton = new Gtk.Button({
            label: _('Remove this preset'),
            halign: Gtk.Align.CENTER,
            margin_top: 12, margin_bottom: 12,
            css_classes: ['destructive-action'],
        });
        removeButton.connect('clicked', () => {
            this._presets.splice(index, 1);
            this._save();
            this._rebuild(window);
        });
        row.add_row(removeButton);

        refreshHeader();
        return row;
    }

    // Drag the handle on the left to move a preset up or down the list.
    _makeReorderable(window, row, index) {
        const handle = new Gtk.Image({
            icon_name: 'list-drag-handle-symbolic',
            tooltip_text: _('Drag to reorder'),
            valign: Gtk.Align.CENTER,
            css_classes: ['dim-label'],
        });
        row.add_prefix(handle);

        const source = new Gtk.DragSource({actions: Gdk.DragAction.MOVE});
        source.connect('prepare', (_source, x, y) => {
            source.set_icon(new Gtk.WidgetPaintable({widget: row}), x, y);
            const value = new GObject.Value();
            value.init(GObject.TYPE_INT);
            value.set_int(index);
            return Gdk.ContentProvider.new_for_value(value);
        });
        handle.add_controller(source);

        const target = Gtk.DropTarget.new(GObject.TYPE_INT, Gdk.DragAction.MOVE);
        target.connect('drop', (_target, from) => {
            if (from === index)
                return false;
            const [moved] = this._presets.splice(from, 1);
            this._presets.splice(index, 0, moved);
            this._save();
            this._rebuild(window);
            return true;
        });
        row.add_controller(target);
    }

    _spinRow(title, value) {
        return new Adw.SpinRow({
            title,
            adjustment: new Gtk.Adjustment({lower: 1, upper: 20000, step_increment: 10, page_increment: 100, value}),
            numeric: true,
        });
    }

    // Returns a human-readable owner of the shortcut, or null when it is free.
    _findConflict(accel, currentPreset) {
        const [ok, keyval, mods] = Gtk.accelerator_parse(accel);
        if (!ok)
            return null;
        const same = other => {
            const [ok2, k2, m2] = Gtk.accelerator_parse(other);
            return ok2 && k2 === keyval && m2 === mods;
        };

        for (const p of this._presets) {
            if (p !== currentPreset && p.shortcut && same(p.shortcut))
                return _('Already used by the preset “%s”').replace('%s', p.name || _('Unnamed preset'));
        }

        const source = Gio.SettingsSchemaSource.get_default();
        for (const id of GNOME_SHORTCUT_SCHEMAS) {
            const schema = source.lookup(id, true);
            if (!schema)
                continue;
            const settings = new Gio.Settings({schema_id: id});
            for (const name of schema.list_keys()) {
                const key = schema.get_key(name);
                const type = key.get_value_type().dup_string();
                const values = type === 'as' ? settings.get_strv(name) : type === 's' ? [settings.get_string(name)] : [];
                if (values.some(v => v && same(v)))
                    return _('Already used by GNOME for “%s”').replace('%s', key.get_summary() ?? name);
            }
        }

        const mediaKeys = new Gio.Settings({schema_id: 'org.gnome.settings-daemon.plugins.media-keys'});
        for (const path of mediaKeys.get_strv('custom-keybindings')) {
            const custom = new Gio.Settings({schema_id: 'org.gnome.settings-daemon.plugins.media-keys.custom-keybinding', path});
            if (same(custom.get_string('binding')))
                return _('Already used by your own GNOME shortcut “%s”').replace('%s', custom.get_string('name'));
        }
        return null;
    }

    _captureShortcut(window, preset, onDone) {
        const dialog = new Adw.Window({
            transient_for: window,
            modal: true,
            title: _('New shortcut'),
            default_width: 380,
            default_height: 220,
        });
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 24, margin_bottom: 24, margin_start: 24, margin_end: 24,
            valign: Gtk.Align.CENTER,
        });
        box.append(new Gtk.Label({label: _('Press the keys you want to use'), css_classes: ['title-2']}));
        box.append(new Gtk.Label({label: _('Backspace removes the shortcut, Escape cancels'), css_classes: ['dim-label']}));
        box.append(new Gtk.Label({
            label: _('Shortcuts already used by the system cannot be assigned here.'),
            css_classes: ['dim-label', 'caption'],
        }));
        const conflictLabel = new Gtk.Label({wrap: true, justify: Gtk.Justification.CENTER, css_classes: ['error'], visible: false});
        box.append(conflictLabel);
        dialog.set_content(box);

        const controller = new Gtk.EventControllerKey();
        controller.connect('key-pressed', (_c, keyval, _keycode, state) => {
            const mask = state & Gtk.accelerator_get_default_mod_mask();
            if (mask === 0 && keyval === Gdk.KEY_Escape) {
                dialog.close();
                return Gdk.EVENT_STOP;
            }
            if (mask === 0 && keyval === Gdk.KEY_BackSpace) {
                onDone('');
                dialog.close();
                return Gdk.EVENT_STOP;
            }
            if (!Gtk.accelerator_valid(keyval, mask))
                return Gdk.EVENT_STOP; // lone modifier or unmodified plain key: keep waiting
            const accel = Gtk.accelerator_name(Gdk.keyval_to_lower(keyval), mask);
            const conflict = this._findConflict(accel, preset);
            if (conflict) {
                conflictLabel.label = `${conflict}. ${_('Try a different combination.')}`;
                conflictLabel.visible = true;
                return Gdk.EVENT_STOP;
            }
            onDone(accel);
            dialog.close();
            return Gdk.EVENT_STOP;
        });
        dialog.add_controller(controller);
        dialog.present();
    }
}
