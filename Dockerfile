# Homebridge with this plugin baked into the image.
#
# The plugin is built from the build context - the files Dokploy (or any other
# CI) has already checked out - rather than fetched from GitHub. That keeps the
# build working with a private repository and puts no credential in the image.
#
# It is not installed into the global node_modules, even though that would be
# the obvious place: the homebridge/homebridge image runs Homebridge with
# `--strict-plugin-resolution`, which makes it ignore everything outside
# /var/lib/homebridge/node_modules. That path is inside the data volume, so the
# entrypoint copies the plugin there on start. See docker/sync-plugin.sh.

# ---------- build and pack the plugin ----------
FROM node:22-alpine AS build

WORKDIR /src
COPY package.json package-lock.json ./
# --ignore-scripts because the package's own `prepare` runs a build, and at this
# layer only the manifests exist - there are no sources to compile yet. Keeping
# dependency installation in its own layer is what makes rebuilds fast.
RUN npm ci --ignore-scripts

COPY . .
# Build explicitly so a compile error surfaces here, then pack without letting
# `prepare` trigger a second, identical build.
RUN mkdir -p /out && npm run build && npm pack --ignore-scripts --pack-destination /out

# ---------- verify the packed plugin actually loads ----------
FROM node:22-alpine AS verify

COPY --from=build /out/*.tgz /tmp/plugin.tgz
# Fail the build, not the deploy, if the package is unusable.
RUN mkdir -p /check && cd /check && npm init -y >/dev/null \
 && npm install --omit=dev --no-audit --no-fund /tmp/plugin.tgz \
 && test -f node_modules/homebridge-lg-thinq/config.schema.json \
 && node -e "require('homebridge-lg-thinq')" \
 && echo "packed plugin loads cleanly" > /verified

# ---------- final image ----------
FROM homebridge/homebridge:latest

# Copied so BuildKit cannot prune the verify stage as unreachable.
COPY --from=verify /verified /opt/lg-thinq/.verified
COPY --from=build /out/*.tgz /opt/lg-thinq/homebridge-lg-thinq.tgz
# Tie the install to this exact build so a rebuilt image refreshes it and an
# unchanged one does not reinstall on every container start.
RUN sha256sum /opt/lg-thinq/homebridge-lg-thinq.tgz | cut -d' ' -f1 > /opt/lg-thinq/build-stamp

COPY docker/sync-plugin.sh /usr/local/bin/sync-plugin.sh
RUN chmod +x /usr/local/bin/sync-plugin.sh

ENTRYPOINT ["/usr/local/bin/sync-plugin.sh"]
