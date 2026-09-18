UUID      := presize@tobiasz
DOMAIN    := presize
BUILD     := build
DEST      := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
MSGFMT    ?= msgfmt
XGETTEXT  ?= xgettext
SCHEMAS   ?= glib-compile-schemas
LANGS     := $(patsubst po/%.po,%,$(wildcard po/*.po))

.PHONY: all build install uninstall pack pot clean

all: build

build:
	rm -rf $(BUILD)
	mkdir -p $(BUILD)
	cp src/*.js src/metadata.json $(BUILD)/
	cp -r src/schemas $(BUILD)/schemas
	$(SCHEMAS) $(BUILD)/schemas
	for l in $(LANGS); do \
	  mkdir -p $(BUILD)/locale/$$l/LC_MESSAGES; \
	  $(MSGFMT) -o $(BUILD)/locale/$$l/LC_MESSAGES/$(DOMAIN).mo po/$$l.po; \
	done

# Symlinks the build directory into the GNOME extensions folder.
install: build
	rm -rf $(DEST)
	mkdir -p $(dir $(DEST))
	ln -s $(abspath $(BUILD)) $(DEST)

uninstall:
	rm -rf $(DEST)

# Zip ready for upload to extensions.gnome.org.
pack: build
	rm -f $(UUID).shell-extension.zip
	cd $(BUILD) && zip -r ../$(UUID).shell-extension.zip .

pot:
	$(XGETTEXT) --from-code=UTF-8 --language=JavaScript --keyword=_ \
	  --package-name=$(DOMAIN) -o po/$(DOMAIN).pot src/prefs.js src/extension.js

clean:
	rm -rf $(BUILD) $(UUID).shell-extension.zip
