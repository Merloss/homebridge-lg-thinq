# Fixes applied on top of upstream `master` (c50f246)

Baseline: `nVuln/homebridge-lg-thinq` @ `c50f246` (2026-05-05), version `2.0.0`
(published to npm only as `2.0.0-beta.8` under the `test` tag; the `latest` tag
is still `1.8.11` from March 2025).

The baseline builds clean and its 259 tests pass. Every issue below is a
**runtime** defect, which is why the test suite never caught them.

---

## 1. Request queue could wedge the whole plugin permanently

*Upstream issue #383 "Plugin becomes unresponsive", #391 "Axios issue in beta 8"*

`src/lib/request.ts` limited outbound calls to one at a time using a module
global plus a **10ms `setInterval` busy-wait per queued request**:

```js
client.interceptors.request.use((config) => new Promise((resolve) => {
  const interval = setInterval(() => {
    if (PENDING_REQUESTS < MAX_REQUESTS_COUNT) { ... }
  }, INTERVAL_MS);
}));
```

Two failure modes:

- The slot was released only from response interceptors. An adapter that
  rejected **without** an attached `config` (socket teardown, a non-Axios throw)
  released nothing. With a limit of 1, one such leak blocked every subsequent
  request forever — the plugin went quiet with no error.
- Nothing bounded the queue. Each poll tick added another never-cleared timer,
  so a stalled request grew an unbounded set of 10ms timers.

**Fix:** a real FIFO semaphore (`src/lib/semaphore.ts`) with a bounded queue and
an acquire timeout, and the acquire/release moved to an **adapter wrapper** so
release happens in a `finally` regardless of how the request failed. The wrapper
is unwrapped before re-wrapping so `axios-retry` cannot nest an acquire inside a
held slot.

## 2. Every retried failure was reported as "not connected"

`axios-retry` re-dispatches through the whole interceptor chain, so an
already-mapped error reached the error mapper a **second** time. Domain errors
carry no `.response`, so the mapper's `if (!err.response)` branch rewrote them:
an exhausted 500, an expired token, a 429 — all surfaced as `NotConnectedError`.
That both hid the real cause and pushed discovery into a reconnect loop that
could not fix the actual problem.

**Fix:** the mapper now passes already-mapped errors through untouched.

## 3. HTTP 429 was never handled

*Upstream PR #395*

`retryCondition` covered only `5xx` and `ECONN*`. Throttling was not retried, not
backed off, and `Retry-After` was ignored. Retry delay was `retryCount * 2000`
with no jitter, so every device retried in lockstep and re-tripped the limit.

**Fix:** a typed `RateLimitError`, 429 added to the retry set, `Retry-After`
honoured (capped at 60s), and exponential backoff with jitter. Discovery backs
off 5 minutes on throttling instead of 30 seconds.

## 4. Default poll interval was 5 seconds

*Upstream PR #395*

`refreshIntervalMs` defaulted to **5s** while `config.schema.json` advertised 60.
Users who edited `config.json` by hand silently got the 5s path. Each refresh
costs `1 + N` requests (homes, then each home), so a 2-home account issued ~36
requests/minute forever — and ThinQ2 devices were **also** receiving the same
state over MQTT.

**Fix:** default 60s, hard floor of 10s, and once MQTT connects the ThinQ2 poll
is demoted to a 10-minute reconciliation pass. `registerMQTTListener` now returns
whether it actually connected (it previously discarded that result, so a total
MQTT failure looked like success).

## 5. One bad device silently killed all the devices after it

*Upstream issue #381 "Device Request: Vacuum and Oven — errors prevent remaining
devices from initializing"*

`discoverDevices()` awaited setup for each device inside a bare `for` loop. Any
throw — an unsupported appliance, a malformed model, a failed setup call — exited
the loop. Every device later in the list was never registered, and
`removeStaleAccessories()` never ran either.

**Fix:** each device is set up in its own `try`/`catch`. Failures are collected
and reported as a summary; the rest of the account is unaffected. Account-level
errors (`NotConnectedError`, `RateLimitError`) still abort the round so it can be
retried as a whole. ThinQ1 polling got the same per-device isolation.

## 6. `request()` returned `{}` on error, and callers dereferenced it

`API.request()` swallows handled failures and returns `{}`. Callers then did:

```js
const resp = await this.getRequest('service/homes/' + homes[i].homeId);
devices.push(...resp.result.devices);          // TypeError on {}
```

That `TypeError` fired inside the poll loop on any transient failure. Worse,
`getListHomes()` cached whatever it got — including a failed lookup — so one
blip could leave the plugin permanently convinced the account had no homes.

**Fix:** both call sites validate the shape, log which home could not be read,
and continue. Failed home lookups are no longer cached. Rate-limit errors now
propagate instead of being flattened into `{}`.

## 7. Plugin gave up permanently if the first connection failed

`didFinishLaunching` called `ThinQ.isReady()` once. If Homebridge started before
the network was up — common on a rebooting Pi — the plugin logged an error and
did nothing until a manual restart.

**Fix:** transient readiness failures are retried with the same backoff policy as
discovery. All retry timers are tracked and cleared on shutdown, and are
`unref()`ed so they cannot block a clean exit.

## 8. MQTT client id was regenerated on every restart

`client_id` was `sha256(userNumber + Date.now())`, so every launch registered a
fresh push client with LG while the RSA key pair was persisted. Registrations
accumulated server-side on busy accounts.

**Fix:** the generated id is persisted (still random on first creation, stable
afterwards).

## 9. `refreshNewToken()` could crash before `ready()` finished

If a token expired on the very first request, the retry path called
`this.auth.refreshNewToken(...)` before `ready()` had constructed `auth`.

**Fix:** `auth` is lazily constructed from the already-fetched gateway.

## 10. MQTT never came back after an outage longer than one retry

*Reported symptom: "the plugin sometimes doesn't reconnect after an internet outage"*

`wireMqttDeviceEvents` handled `offline` by ending the device and scheduling a
**single** retry 60s later:

```js
device.on('offline', () => {
  device.end();
  scheduleReconnect(() => {
    reconnect().catch(err => logger.error('mqtt reconnect failed:', err));
  }, 60000);
});
```

If the network was still down at the 60s mark, `reconnect()` threw — it has to
re-request the MQTT certificate over HTTP — the error was logged, and **nothing
scheduled another attempt**. The device had already been `end()`ed, so no further
`offline` event could arrive either. Push updates stayed dead until Homebridge
was restarted. Any outage longer than ~60s (router reboot, ISP blip) hit this.

A second latent problem: repeated `offline` events each scheduled their own
reconnect, and every reconnect wired a fresh device without retiring the old
one's handlers, so connections could stack.

**Fix:** a self-sustaining retry chain with exponential backoff (60s → 10min cap)
that keeps trying until it succeeds, shared reconnect state across connection
generations, a `pending` guard so duplicate `offline` events cannot stack chains,
and a generation counter so a superseded connection cannot disturb the live one.
The chain is stopped cleanly on Homebridge shutdown via `ThinQ.stopMQTTListener()`.

## 11. Several AC sub-accessories showed up unnamed in the Home app

*Reported symptom: "the controls aren't descriptive"*

Jet Mode, Energy save and Air Purify set `ConfiguredName`, but the temperature
sensor, humidity sensor, display light, quiet mode switch and air quality sensor
did not. Without it the Home app falls back to generic labels — "Sensor",
"Light", "Switch" — which are indistinguishable once one accessory exposes
several of them.

**Fix:** a single `nameSubService()` helper applies `Name` + `ConfiguredName` as
`"<device name> <function>"` to every sub-service.

## 12. CLI could not inspect a device, and crashed on bad input

The bundled `thinq` CLI could only fetch a refresh token. There was no way to see
what an appliance actually reports, which is the first thing needed to configure
it or to add support for it.

**Fix:** added `thinq devices` (list with ids) and `thinq dump <id>` (snapshot
keys, controllable values with ranges/enums, optional JSON report with
identifiers redacted for sharing). Connection and command failures now print an
actionable message instead of an uncaught-exception stack trace.

## 13. Node 24 / 25 / 26 refused to install

*Upstream issues #378, #379, PR #394*

`engines.node` was `^22.13.0 || ^24.0.0`.

**Fix:** `^22.13.0 || ^24.0.0 || ^25.0.0 || ^26.0.0`.

---

## Verification

```
npm run lint     # clean
npm run build    # clean
npm test         # 34 suites, 303 tests
```

44 tests were added covering the semaphore, retry/backoff policy, `Retry-After`
parsing, error-mapping idempotency, per-device discovery isolation, the API
response guards, the MQTT-aware poll cadence, and the MQTT reconnect chain
(retry-after-failure, backoff cap, duplicate suppression, stale generations,
shutdown).

Not covered by tests: the sub-service naming in §11 is verified by type checking
and reading only — asserting it would need a full HAP service harness that the
existing AC tests (which cover pure functions) do not have.

## Not addressed

- **Device support requests** (#376 water heater, #381 vacuum/oven, #377 AWHP
  temperature). These need the `modelJsonUri` capability model from someone who
  owns the appliance — they cannot be written blind. Unsupported devices are now
  skipped cleanly instead of breaking discovery, which is the part that was
  actually a bug.
- **Password login fragility.** Still inherently brittle (captcha, terms,
  third-party identity providers). Refresh-token auth is the reliable path.
