#!/bin/sh
# Installs the plugin baked into this image into Homebridge's storage directory,
# then hands off to the stock entrypoint.
#
# Two constraints from the homebridge/homebridge image shape this:
#
# 1. Homebridge is started with `-P /var/lib/homebridge/node_modules
#    --strict-plugin-resolution`, so plugins anywhere else - including the global
#    node_modules - are ignored outright.
# 2. /opt/homebridge/start.sh runs `npm install --save homebridge@latest` when
#    homebridge is missing from that directory, which is the case on a fresh
#    volume. npm removes packages that are not in package.json, so a plugin that
#    is merely copied in gets deleted again on first boot.
#
# So it is installed with npm rather than copied: that records it in
# /homebridge/package.json, which is what makes it survive later installs. It
# comes from a tarball baked into the image, so no registry entry and no GitHub
# credential is involved.
set -eu

TARBALL=/opt/lg-thinq/homebridge-lg-thinq.tgz
STAMP_SRC=/opt/lg-thinq/build-stamp
DATA_DIR=/homebridge
PLUGIN_DIR="${DATA_DIR}/node_modules/homebridge-lg-thinq"
# Kept beside the plugin rather than inside it: npm replaces the package
# directory wholesale, so a stamp stored within it is erased by the very install
# it is meant to record, and every container start would reinstall.
STAMP_DEST="${DATA_DIR}/.lg-thinq-build-stamp"

log() {
  echo "[lg-thinq] $*"
}

if [ ! -f "$TARBALL" ]; then
  log "ERROR: no plugin baked into this image at ${TARBALL}"
  exit 1
fi

# The stamp is the checksum of the packed plugin, so a rebuilt image refreshes
# the install while an unchanged one skips it and keeps container starts quick.
if [ -f "$STAMP_DEST" ] && [ -f "${PLUGIN_DIR}/package.json" ] && cmp -s "$STAMP_SRC" "$STAMP_DEST"; then
  log "already current ($(cut -c1-12 "$STAMP_SRC")), skipping install"
else
  log "installing $(cut -c1-12 "$STAMP_SRC") into ${DATA_DIR}"
  mkdir -p "$DATA_DIR"

  if npm --prefix "$DATA_DIR" install --save --no-audit --no-fund "$TARBALL"; then
    cp "$STAMP_SRC" "$STAMP_DEST"
    log "installed"
  else
    # Do not take Homebridge down over this. An already-installed copy from a
    # previous boot keeps working, and the log says plainly what went wrong.
    log "ERROR: install failed - Homebridge will start without the updated plugin"
  fi
fi

exec /init "$@"
