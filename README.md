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
- Warns when a shortcut is already taken by GNOME or another preset, and never touches GNOME's own shortcuts.

Default presets: Ctrl+F1 to Ctrl+F4 for four sizes, all centered.

## Install

From extensions.gnome.org once published, or from source:

```bash
make install
```

Then log out and back in (Wayland) or restart the shell (X11), and enable:

```bash
gnome-extensions enable presize@tenebra
```

Open the settings from the Extensions app or with `gnome-extensions prefs presize@tenebra`.

## Development

- `src/` is the extension, `po/` holds translations.
- `make build` compiles the schema and translations into `build/`.
- `make install` symlinks `build/` into the extensions folder.
- `make pack` produces the zip for extensions.gnome.org.
- `make pot` refreshes the translation template after changing strings.

After changing `extension.js` or `presets.js`, log out and back in (Wayland).
After changing only `prefs.js`, kill the process that hosts extension preferences
and reopen the settings; it restarts on demand:

```bash
pkill -f "gjs -m /usr/share/gnome-shell/org.gnome.Shell.Extensions"
```

Requires GNOME Shell 48 or newer.

### Releasing a version

Versions are git tags. The `version-name` field in `metadata.json` is filled in at
build time from the tag; the numeric `version` field is managed by
extensions.gnome.org and is not edited by hand.

```bash
git tag -a v1.0.0 -m "Presize 1.0.0"
git push origin v1.0.0
```

The Release workflow then builds `presize@tenebra.shell-extension.zip`, creates a
GitHub release with generated notes and attaches the zip. The last step is manual,
as extensions.gnome.org has no upload API: download the zip from the release and
submit it at <https://extensions.gnome.org/upload/>. Every submission is reviewed
by a person, usually within a few days.

The CI workflow runs on every push: JavaScript syntax, translation completeness
against the source strings, and a full build.

### New GNOME releases

GNOME Shell only loads extensions whose `metadata.json` lists the running shell
version in `shell-version`. GNOME ships a new major version every March and
September; Fedora and Ubuntu pick it up roughly a month later. After each
upgrade:

1. Run `make check` on the host. It prints the shell version, whether it is
   listed in `metadata.json`, the extension state and any errors from the
   journal.
2. If the version is missing, add it to `shell-version`, `make install`, log out
   and back in, and try every preset and the settings window.
3. Bump `version` in `metadata.json` and upload a new `make pack` zip to
   extensions.gnome.org. Users get the update through the Extensions app.

Presize touches only stable public APIs (keyboard grabs, the focused window,
work areas, libadwaita), so most releases will need nothing more than the new
number.

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
