UUID      := presize@tenebra
DOMAIN    := presize
BUILD     := build
DEST      := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
MSGFMT    ?= msgfmt
XGETTEXT  ?= xgettext
SCHEMAS   ?= glib-compile-schemas
LANGS     := $(patsubst po/%.po,%,$(wildcard po/*.po))

.PHONY: all build install uninstall pack pot check clean

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

# Run on the host after a GNOME update: is the running shell supported, is the
# extension loaded, did it log any errors since boot?
check:
	@shell=$$(gnome-shell --version | grep -oE '[0-9]+' | head -1); \
	echo "GNOME Shell: $$shell"; \
	if grep -q "\"$$shell\"" src/metadata.json; then \
	  echo "metadata.json: version $$shell is listed"; \
	else \
	  echo "metadata.json: version $$shell is NOT listed, add it to shell-version and test"; \
	fi; \
	echo "--- extension state ---"; \
	LANG=C gnome-extensions info $(UUID) 2>/dev/null | grep -E 'State|Version' || echo "not installed or shell not restarted yet"; \
	echo "--- errors in this session's journal ---"; \
	journalctl --user -b --no-pager -p warning 2>/dev/null | grep -i -A3 '$(UUID)\|presize' | grep -v 'downloading update' | tail -20 || true; \
	echo "(end)"

clean:
	rm -rf $(BUILD) $(UUID).shell-extension.zip
