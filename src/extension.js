// SPDX-License-Identifier: GPL-2.0-or-later
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {loadPresets, computeSize, computeOrigin, isSafeShortcut} from './presets.js';

export default class PresizeExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._actions = new Map(); // action id -> preset
        this._pending = null; // {win, sizeId, goneId, timeoutId}: window we wait on after unmaximizing
        this._activatedId = global.display.connect('accelerator-activated',
            (_display, action) => this._onActivated(action));
        this._changedId = this._settings.connect('changed::presets', () => this._grabAll());
        this._grabAll();
    }

    disable() {
        this._cancelPending();
        this._ungrabAll();
        this._actions = null;
        global.display.disconnect(this._activatedId);
        this._settings.disconnect(this._changedId);
        this._settings = null;
    }

    _grabAll() {
        this._ungrabAll();
        for (const preset of loadPresets(this._settings)) {
            if (!preset.shortcut)
                continue;
            if (!isSafeShortcut(preset.shortcut)) {
                console.warn(`presize: ignoring "${preset.shortcut}" for "${preset.name}", it has no Ctrl, Alt or Super`);
                continue;
            }
            const action = global.display.grab_accelerator(preset.shortcut, Meta.KeyBindingFlags.IGNORE_AUTOREPEAT);
            if (action === Meta.KeyBindingAction.NONE) {
                console.warn(`presize: could not grab "${preset.shortcut}" for "${preset.name}"`);
                continue;
            }
            Main.wm.allowKeybinding(Meta.external_binding_name_for_action(action), Shell.ActionMode.NORMAL);
            this._actions.set(action, preset);
        }
    }

    _ungrabAll() {
        for (const action of this._actions.keys())
            global.display.ungrab_accelerator(action);
        this._actions.clear();
    }

    _onActivated(action) {
        const preset = this._actions.get(action);
        if (preset)
            this._apply(preset);
    }

    _apply(preset) {
        const win = global.display.get_focus_window();
        // allows_resize() is false for maximized and fullscreen windows, so it is
        // checked in _place(), after the window has been restored.
        if (!win || win.get_window_type() !== Meta.WindowType.NORMAL)
            return;

        this._cancelPending();
        // A window tiled to a screen edge with Super+Arrow is maximized vertically only,
        // so is_maximized() is false for it; get_maximize_flags() covers both cases.
        // Meta.MaximizeFlags has no NONE member, hence the comparison with 0.
        const flags = win.get_maximize_flags();
        const fullscreen = win.is_fullscreen();
        if (!fullscreen && flags === 0) {
            this._place(win, preset);
            return;
        }

        // Leaving fullscreen, maximized or tiled state restores the old geometry on the
        // next frame, which would overwrite anything we set right now. Place the window
        // once that restore has happened. unmaximize() also clears tiling. The timeout
        // is a safety net in case no size change is reported.
        const sizeId = win.connect('size-changed', () => {
            this._cancelPending();
            this._place(win, preset);
        });
        const goneId = win.connect('unmanaged', () => this._cancelPending());
        const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            this._pending.timeoutId = 0;
            this._cancelPending();
            this._place(win, preset);
            return GLib.SOURCE_REMOVE;
        });
        this._pending = {win, sizeId, goneId, timeoutId};
        if (fullscreen)
            win.unmake_fullscreen();
        if (flags !== 0)
            win.unmaximize();
    }

    _cancelPending() {
        if (!this._pending)
            return;
        const {win, sizeId, goneId, timeoutId} = this._pending;
        this._pending = null;
        win.disconnect(sizeId);
        win.disconnect(goneId);
        if (timeoutId)
            GLib.Source.remove(timeoutId);
    }

    _place(win, preset) {
        if (!win.allows_resize() || !win.allows_move())
            return;
        const area = win.get_work_area_for_monitor(win.get_monitor());
        const [width, height] = computeSize(preset, area);
        const [x, y] = computeOrigin(preset, width, height, area, win.get_frame_rect());
        win.move_resize_frame(true, x, y, width, height);
    }
}
