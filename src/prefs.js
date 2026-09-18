import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
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
        row.add_row(keepRow);

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
            this._captureShortcut(window, accel => {
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
            halign: Gtk.Align.END,
            margin_top: 6, margin_bottom: 6,
            css_classes: ['destructive-action'],
        });
        removeButton.connect('clicked', () => {
            this._presets.splice(index, 1);
            this._save();
            this._rebuild(window);
        });
        const removeRow = new Adw.ActionRow();
        removeRow.add_suffix(removeButton);
        row.add_row(removeRow);

        refreshHeader();
        return row;
    }

    _spinRow(title, value) {
        return new Adw.SpinRow({
            title,
            adjustment: new Gtk.Adjustment({lower: 1, upper: 20000, step_increment: 10, page_increment: 100, value}),
            numeric: true,
        });
    }

    _captureShortcut(window, onDone) {
        const dialog = new Adw.Window({
            transient_for: window,
            modal: true,
            title: _('New shortcut'),
            default_width: 380,
            default_height: 160,
        });
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 24, margin_bottom: 24, margin_start: 24, margin_end: 24,
            valign: Gtk.Align.CENTER,
        });
        box.append(new Gtk.Label({label: _('Press the keys you want to use'), css_classes: ['title-2']}));
        box.append(new Gtk.Label({label: _('Backspace removes the shortcut, Escape cancels'), css_classes: ['dim-label']}));
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
            onDone(Gtk.accelerator_name(Gdk.keyval_to_lower(keyval), mask));
            dialog.close();
            return Gdk.EVENT_STOP;
        });
        dialog.add_controller(controller);
        dialog.present();
    }
}
