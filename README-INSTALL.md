# The `installable` branch

This branch is `master` with the compiled `dist/` directory committed. Nothing
else differs, and no source changes are ever made here.

## Why it exists

Installing from git leaves the build to the `prepare` script: npm clones the
repo, installs the dev dependencies and runs `tsc` before putting the package in
place. It works on a normal workstation, and it can fail on a locked-down
container - restricted shells, disabled lifecycle scripts, a missing compiler, a
read-only temp directory. When it does fail the install still looks fine. npm
reports success, the package directory appears, `package.json` records the
dependency, and only `dist/` is missing. Homebridge then skips the plugin
without a word, because `main` points at a file that was never built.

This branch removes the step rather than trying to make it survive every
environment: with the output already in the tree there is nothing to compile at
install time.

## Installing from it

```sh
npm --prefix /var/lib/homebridge install github:Merloss/homebridge-lg-thinq#installable
```

On a normal Homebridge install use the storage directory in place of
`/var/lib/homebridge`. Restart Homebridge afterwards; it should log
`Loaded plugin: homebridge-lg-thinq@2.0.0`.

## Refreshing it after a change to master

The build output has to be regenerated, never hand-edited:

```sh
git checkout installable
git merge master
npm ci && npm run build
git add -A dist && git commit -m "chore: rebuild dist"
git push
```

`dist` is deliberately absent from `.gitignore` on this branch, so a rebuild
shows up in `git status` like any other change. Do not put it back without
removing the directory from the tree as well - the branch would then be
indistinguishable from `master` and silently stop working.
