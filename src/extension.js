// SPDX-License-Identifier: GPL-2.0-or-later
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {loadPresets, computeSize, computeOrigin} from './presets.js';

export default class PresizeExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._actions = new Map(); // action id -> preset
        this._pending = null; // {win, sizeId, goneId}: window we wait on after unmaximizing
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
        if (!win || !win.allows_resize() || !win.allows_move())
            return;

        this._cancelPending();
        if (!win.is_fullscreen() && !win.is_maximized()) {
            this._place(win, preset);
            return;
        }

        // Leaving fullscreen or maximized state restores the old geometry on the next
        // frame, which would overwrite anything we set right now. Place the window once
        // that restore has happened.
        const sizeId = win.connect('size-changed', () => {
            this._cancelPending();
            this._place(win, preset);
        });
        const goneId = win.connect('unmanaged', () => this._cancelPending());
        this._pending = {win, sizeId, goneId};
        if (win.is_fullscreen())
            win.unmake_fullscreen();
        if (win.is_maximized())
            win.unmaximize();
    }

    _cancelPending() {
        if (!this._pending)
            return;
        this._pending.win.disconnect(this._pending.sizeId);
        this._pending.win.disconnect(this._pending.goneId);
        this._pending = null;
    }

    _place(win, preset) {
        const area = win.get_work_area_for_monitor(win.get_monitor());
        const [width, height] = computeSize(preset, area);
        const [x, y] = computeOrigin(preset, width, height, area, win.get_frame_rect());
        win.move_resize_frame(true, x, y, width, height);
    }
}
