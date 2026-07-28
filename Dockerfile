# Homebridge with this plugin baked into the image.
#
# The plugin is built from the build context - the files Dokploy (or any other
# CI) already checked out - rather than fetched from GitHub. That keeps the
# build working with a private repository and without putting any credential
# inside the image.
#
# Baking it in is also what makes it survive: a redeploy recreates the
# container, so anything installed by hand through the Homebridge UI terminal is
# gone the next time you press Deploy.

# ---------- build the plugin ----------
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

# ---------- final image ----------
FROM homebridge/homebridge:latest

COPY --from=build /out/*.tgz /tmp/plugin.tgz

# Installed globally on purpose: /var/lib/homebridge is a volume mount at
# runtime, so anything written there during the build is shadowed by the volume
# and effectively discarded. Global node_modules is part of the image and
# survives, and Homebridge scans it for plugins just the same.
RUN npm install -g /tmp/plugin.tgz \
 && rm -f /tmp/plugin.tgz \
 && npm cache clean --force \
 && rm -rf /root/.npm

# Fail the build rather than the deploy if the plugin did not actually land.
# Global packages are not on Node's default resolution path, so check the file.
RUN test -f "$(npm root -g)/homebridge-lg-thinq/dist/index.js" \
 && echo "homebridge-lg-thinq installed at $(npm root -g)/homebridge-lg-thinq"
