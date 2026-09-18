# Presize

A GNOME Shell extension that resizes the active window to a preset size and puts it
where you want, with one keyboard shortcut. No tiling, no grids, no layouts.
Just "make this window 1600 × 1000 and center it".

Designed so that anyone can set it up: every preset is a name, a size, a place on the
screen and a shortcut, all edited in a normal GNOME preferences window.

## Features

- Any number of presets, each with its own shortcut.
- Size in pixels or as a percentage of the screen.
- Place the window in the center, at an edge, in a corner, or leave it where it is.
- Works on Wayland and X11, on any monitor the window is on.
- Un-maximizes and leaves fullscreen before resizing.

Default presets: Ctrl+F1 to Ctrl+F4 for four sizes, all centered.

## Install

From extensions.gnome.org once published, or from source:

```bash
make install
```

Then log out and back in (Wayland) or restart the shell (X11), and enable:

```bash
gnome-extensions enable presize@tobiasz
```

Open the settings from the Extensions app or with `gnome-extensions prefs presize@tobiasz`.

## Development

- `src/` is the extension, `po/` holds translations.
- `make build` compiles the schema and translations into `build/`.
- `make install` symlinks `build/` into the extensions folder.
- `make pack` produces the zip for extensions.gnome.org.
- `make pot` refreshes the translation template after changing strings.

Requires GNOME Shell 48 or newer.

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
