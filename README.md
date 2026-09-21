# Presize

<a href="https://extensions.gnome.org/extension/10983/presize/"><img src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg" alt="Get it on GNOME Extensions" height="60"></a>

[![Downloads](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fextensions.gnome.org%2Fextension-info%2F%3Fuuid%3Dpresize%40tenebra&query=%24.downloads&label=downloads&color=4a86cf)](https://extensions.gnome.org/extension/10983/presize/)
[![CI](https://img.shields.io/github/actions/workflow/status/tenebra-pl/presize/ci.yml?branch=main&label=CI)](https://github.com/tenebra-pl/presize/actions/workflows/ci.yml)
[![License: GPL-2.0-or-later](https://img.shields.io/badge/license-GPL--2.0--or--later-blue)](LICENSE)

A GNOME Shell extension that resizes the active window to a preset size and puts it
where you want, with one keyboard shortcut. No tiling, no grids, no layouts.
Just "make this window 1600 × 1000 and center it".

Designed so that anyone can set it up: every preset is a name, a size, a place on the
screen and a shortcut, all edited in a normal GNOME preferences window.

Presize does not replace GNOME's own window management. Maximizing, tiling to half
the screen with Super+Arrow and the rest keep working exactly as before. Presize
only adds the layouts GNOME does not offer, such as a fixed 1600 × 1000 window in
the middle of the screen or a window at 90 % of the work area.

<p align="center">
  <img src="docs/settings.png" alt="Presize settings window with four presets" width="560">
</p>

## Features

- Any number of presets, each with its own shortcut.
- Size in pixels or as a percentage of the screen.
- Place the window in the center, at an edge, in a corner, or leave it where it is.
- Works on Wayland and X11, on any monitor the window is on.
- Un-maximizes and leaves fullscreen before resizing.
- Warns when a shortcut is already taken by GNOME or another preset, and never touches GNOME's own shortcuts.

Default presets: Ctrl+F1 to Ctrl+F4 for four sizes, all centered.

## Install

The easiest way is the GNOME Extensions website, which also delivers updates
through the Extensions app:

**[extensions.gnome.org/extension/10983/presize](https://extensions.gnome.org/extension/10983/presize/)**

You can also install any [GitHub release](https://github.com/tenebra-pl/presize/releases)
by hand:

```bash
curl -LO https://github.com/tenebra-pl/presize/releases/latest/download/presize@tenebra.shell-extension.zip
gnome-extensions install --force presize@tenebra.shell-extension.zip
```

Then log out and back in (Wayland) or restart the shell with Alt+F2, `r` (X11), and
enable it:

```bash
gnome-extensions enable presize@tenebra
```

Open the settings from the Extensions app or with `gnome-extensions prefs presize@tenebra`.
Manual installs do not update themselves; repeat the two commands for a new release.

To install from source, clone the repository and run `make install`.

## Development

- `src/` is the extension, `po/` holds translations.
- `make build` compiles the schema and translations into `build/`.
- `make install` symlinks `build/` into the extensions folder.
- `make pack` produces the installable zip attached to GitHub releases.
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
build time from the tag.

```bash
git tag -a v1.0.0 -m "Presize 1.0.0"
git push origin v1.0.0
```

The Release workflow then builds `presize@tenebra.shell-extension.zip`, creates a
GitHub release with generated notes and attaches the zip. Download that zip and
submit it at <https://extensions.gnome.org/upload/>; the site matches it to the
existing extension by uuid, and every version is reviewed by a person before it
goes live. Users of the website get the update through the Extensions app.

The CI workflow runs on every push: JavaScript syntax, translation completeness
against the source strings, a full build and the Shexli packaging check.

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
3. Tag a new version so the Release workflow publishes a fresh zip, then upload it
   to extensions.gnome.org.

Presize touches only stable public APIs (keyboard grabs, the focused window,
work areas, libadwaita), so most releases will need nothing more than the new
number.

## Translations

The interface follows the language of your GNOME session automatically. Presize
ships in English, Polish, German, Spanish, French, Italian, Brazilian Portuguese,
European Portuguese, Russian, Ukrainian, Simplified Chinese, Turkish, Czech, Dutch and Japanese. Any
string without a translation falls back to English.

Most of these translations were drafted by the author with machine help and have
not been reviewed by native speakers. Corrections are very welcome: edit the
matching file in `po/` and open a pull request, or open an issue quoting the
wrong string. To add a language, copy `po/pl.po` to `po/<code>.po`, translate the
`msgstr` lines, and run `make build` to check it compiles.

To preview the settings window in another language without changing your session,
run this on the host (the window is served by a shared GNOME process that has to be
restarted with the new language):

```bash
systemctl --user set-environment LANGUAGE=de && pkill -f "gjs -m /usr/share/gnome-shell/org.gnome.Shell.Extensions"; gnome-extensions prefs presize@tenebra; systemctl --user unset-environment LANGUAGE
```

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
