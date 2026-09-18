// Shared between extension.js and prefs.js: preset (de)serialisation and geometry.

export const POSITIONS = [
    'top-left', 'top', 'top-right',
    'left', 'center', 'right',
    'bottom-left', 'bottom', 'bottom-right',
];

export function newPreset() {
    return {name: '', width: 1280, height: 800, unit: 'px', position: 'center', shortcut: ''};
}

export function loadPresets(settings) {
    const out = [];
    for (const raw of settings.get_strv('presets')) {
        try {
            out.push({...newPreset(), ...JSON.parse(raw)});
        } catch (e) {
            console.warn(`presize: skipping invalid preset ${raw}: ${e.message}`);
        }
    }
    return out;
}

export function savePresets(settings, presets) {
    settings.set_strv('presets', presets.map(p => JSON.stringify(p)));
}

// Size in pixels, clamped to the work area.
export function computeSize(preset, area) {
    let w = preset.width;
    let h = preset.height;
    if (preset.unit === '%') {
        w = Math.round(area.width * w / 100);
        h = Math.round(area.height * h / 100);
    }
    return [Math.min(Math.max(1, w), area.width), Math.min(Math.max(1, h), area.height)];
}

// Top-left corner of the frame for the given preset. "keep" leaves the window where it is.
export function computeOrigin(preset, width, height, area, frame) {
    if (preset.position === 'keep')
        return [frame.x, frame.y];

    const parts = preset.position.split('-');
    let x = area.x + Math.floor((area.width - width) / 2);
    let y = area.y + Math.floor((area.height - height) / 2);
    if (parts.includes('left'))
        x = area.x;
    else if (parts.includes('right'))
        x = area.x + area.width - width;
    if (parts.includes('top'))
        y = area.y;
    else if (parts.includes('bottom'))
        y = area.y + area.height - height;
    return [x, y];
}
