# LG ThinQ API — Reverse Engineering Notes

Protocol notes for LG's **unofficial**, app-facing ThinQ API, reconstructed from
this plugin's implementation. Everything here is what the Android LG ThinQ app
(v3.6.x, service code `SVC202`) does on the wire; it is not a documented or
supported interface and LG changes it without notice.

If you are starting a new integration, check LG's official
**ThinQ Connect API** (`thinq.developer.lgthinq.com`) first — it uses a Personal
Access Token issued from the ThinQ app and is a supported contract. The API
below is what you need when the official one does not cover your appliance, or
when you must keep working with existing ThinQ1 hardware.

---

## 1. Two generations behind one account

| | ThinQ1 (legacy) | ThinQ2 |
|---|---|---|
| Transport | JSON-RPC-ish POST, everything wrapped in `lgedmRoot` | REST + JSON |
| Base URL | `thinq1Uri` from gateway | `thinq2Uri` from gateway |
| Auth header | `x-thinq-token` + `x-thinq-jsessionId` | `x-emp-token` + `x-user-no` |
| State updates | Poll a "monitor" work id, decode a **binary blob** | MQTT push over AWS IoT |
| Success marker | `lgedmRoot.returnCd === '0000'` | `resultCode === '0000'` |

One account can hold both. The device list returns `platformType` per device
(`thinq1` / `thinq2`); everything downstream branches on it.

---

## 2. App identity constants

These are the Android app's baked-in credentials. They are what makes LG accept
the requests at all.

```
GATEWAY_URL       https://route.lgthinq.com:46030/v1/service/application/gateway-uri
SVC_CODE          SVC202                                   # LG SmartHome service
CLIENT_ID         LGAO221A02                               # app key
OAUTH_SECRET_KEY  c053c2a6ddeb7ad97cb0eed0dcb31cf8         # HMAC secret for oauth signatures
OAUTH_CLIENT_KEY  LGAO722A02                               # emp-oauth app key
API_KEY           VGhpblEyLjAgU0VSVklDRQ==                 # base64("ThinQ2.0 SERVICE")
APPLICATION_KEY   6V1V8H2BN5P9ZQGOI5DAQ92YZBDO3EK9         # spx login
```

`SVC710` also appears in the login `svc_list` — it is the EMP OAuth service and
must be requested alongside `SVC202` or the token exchange fails.

---

## 3. Gateway discovery

Nothing is hardcoded per region. First call resolves every other base URL:

```http
GET https://route.lgthinq.com:46030/v1/service/application/gateway-uri
x-api-key: VGhpblEyLjAgU0VSVklDRQ==
x-country-code: TR
x-language-code: tr-TR
x-service-phase: OP
x-thinq-app-type: NUTS
x-thinq-app-level: PRD
```

Response `result`:

```json
{
  "empTermsUri":  "https://kr.m.lgaccount.com",
  "empSpxUri":    "https://kr.spx.lgaccount.com",
  "thinq1Uri":    "https://kic.lgthinq.com:46030/api",
  "thinq2Uri":    "https://kic-service.lgthinq.com:46030",
  "countryCode":  "TR",
  "languageCode": "tr-TR"
}
```

`countryCode` / `languageCode` are echoed back from your headers, so a wrong
country here silently routes you to the wrong regional cluster.

---

## 4. Authentication

### 4.1 The signature primitive

Every OAuth-ish call is signed with **HMAC-SHA1, base64-encoded**:

```js
signature(message, secret) =
  HMAC_SHA1(key = utf8(secret), msg = message).digest('base64')
```

The signed message is always `"<path-with-query>\n<RFC2822 UTC timestamp>"`.
The same timestamp must go in the `x-lge-oauth-date` / `lgemp-x-date` header.
Timestamp format is RFC 2822 (`Tue, 28 Jul 2026 12:00:00 +0000`), not ISO 8601.

### 4.2 Password login (5 round trips)

Password auth is fragile — it breaks whenever LG adds a captcha, a new terms
page, or a social-login requirement. **Prefer refresh-token auth (§4.3).**

**Step 1 — hash the password**

```
user_auth2 = SHA512(password).hexdigest()
```

**Step 2 — preLogin** (gets the per-attempt salt)

```http
POST {empSpxUri}/preLogin
Content-Type: application/x-www-form-urlencoded

user_auth2=<sha512 hex>&log_param=login request / user_id : <email> / third_party : null / svc_list : SVC202,SVC710 / 3rd_service :
```

Returns `{ signature, tStamp, encrypted_pw }`.

**Step 3 — account session**

```http
POST {empTermsUri}/emp/v2.0/account/session/<url-encoded email>
X-Signature: <preLogin.signature>
X-Timestamp: <preLogin.tStamp>
X-Application-Key: 6V1V8H2BN5P9ZQGOI5DAQ92YZBDO3EK9
X-Client-App-Key: LGAO221A02
X-Lge-Svccode: SVC709
X-Device-Type: M01
X-Device-Platform: ADR
X-Device-Country: TR
X-Device-Language: tr-TR

user_auth2=<preLogin.encrypted_pw>&password_hash_prameter_flag=Y&svc_list=SVC202,SVC710
```

Returns `account` with `userIDType`, `userID`, `country`, `loginSessionID`.
`password_hash_prameter_flag` is misspelled in the protocol itself — keep it.

Error `MS.001.03` means the account is registered through a third-party
identity provider (Google/Apple/Amazon/Facebook); password login can never work
for it, and refresh-token auth is the only option.

**Step 4 — EMP OAuth authorize**

The HMAC secret for this step is fetched dynamically rather than hardcoded:

```http
GET {empSpxUri}/searchKey?key_name=OAUTH_SECRETKEY&sever_type=OP
   -> { "returnData": "<secret>" }        # note: "sever_type", also misspelled
```

Then:

```http
GET https://emp-oauth.lgecloud.com/emp/oauth2/authorize/empsession
      ?account_type=<userIDType>&client_id=LGAO221A02&country_code=<country>
      &redirect_uri=lgaccount.lgsmartthinq:/&response_type=code&state=12345
      &username=<userID>
lgemp-x-app-key: LGAO722A02
lgemp-x-date: <RFC2822 UTC>
lgemp-x-session-key: <account.loginSessionID>
lgemp-x-signature: HMAC_SHA1("<path><query>\n<date>", <searchKey secret>)
X-Device-Type: M01
X-Device-Platform: ADR
```

`status !== 1` means failure. On success, `redirect_uri` carries both the
authorization `code` **and** an `oauth2_backend_url` query param — the latter is
the regional token endpoint and must be used instead of a guessed one.

**Step 5 — token exchange**

```http
POST <oauth2_backend_url>oauth/1.0/oauth2/token
x-lge-app-os: ADR
x-lge-appkey: LGAO221A02
x-lge-oauth-date: <RFC2822 UTC>
x-lge-oauth-signature: HMAC_SHA1("/oauth/1.0/oauth2/token?<query>\n<date>", OAUTH_SECRET_KEY)
Content-Type: application/x-www-form-urlencoded

code=<code>&grant_type=authorization_code&redirect_uri=lgaccount.lgsmartthinq:/
```

Returns `access_token`, `refresh_token`, `expires_in`, `oauth2_backend_url`.

> **The refresh token is the durable credential.** Capture it once and store it;
> it survives password changes and skips steps 1–5 entirely.

### 4.3 Token refresh (the path you actually want)

Optionally re-resolve the regional OAuth host first (failure here is non-fatal):

```http
POST https://kic.lgthinq.com:46030/api/common/gatewayUriList
x-thinq-application-key: wideq
x-thinq-security-key: nuts_securitykey

{ "lgedmRoot": { "countryCode": "TR", "langCode": "tr-TR" } }
   -> lgedmRoot.oauthUri
```

Then:

```http
POST <lgeapi_url>oauth/1.0/oauth2/token
x-lge-app-os: ADR
x-lge-appkey: LGAO221A02
x-lge-oauth-date: <RFC2822 UTC>
x-lge-oauth-signature: HMAC_SHA1("/oauth/1.0/oauth2/token?grant_type=refresh_token&refresh_token=<token>\n<date>", OAUTH_SECRET_KEY)

grant_type=refresh_token&refresh_token=<token>
```

The signed path must include the **query string in the same order** as the body.

Default regional host when nothing else is known:
`https://<country-code-lowercase>.lgeapi.com/`.

### 4.4 The two extra identities

Both are required before the ThinQ2 API will answer.

**User number** (`x-user-no`):

```http
GET <lgeapi_url>users/profile
Authorization: Bearer <access_token>
X-Lge-Svccode: SVC202
X-Application-Key: 6V1V8H2BN5P9ZQGOI5DAQ92YZBDO3EK9
lgemp-x-app-key: LGAO221A02
x-lge-oauth-date: <RFC2822 UTC>
x-lge-oauth-signature: HMAC_SHA1("/users/profile\n<date>", OAUTH_SECRET_KEY)
   -> account.userNo          # resp.status === 2 means auth failure
```

**JSESSION id** (ThinQ1 only — harmless to skip if you have no ThinQ1 devices):

```http
POST {thinq1Uri}/member/login
x-thinq-application-key: wideq
x-thinq-security-key: nuts_securitykey
x-thinq-token: <access_token>

{ "lgedmRoot": { "countryCode":"TR", "langCode":"tr-TR", "loginType":"EMP", "token":"<access_token>" } }
   -> lgedmRoot.jsessionId
```

`wideq` / `nuts_securitykey` are literal constants, named after the original
`wideq` reverse-engineering project.

### 4.5 Terms-of-service wall (`resultCode: 0110`)

When LG publishes new terms, **every** API call fails with `0110` until they are
accepted. The app-side accept flow:

1. `GET {empSpxUri}common/showTerms?...&svc_list=SVC202` with header
   `X-Login-Session: <access_token>` — returns HTML; scrape `signature` and
   `tStamp` out of the inline JS.
2. `GET {empTermsUri}emp/v2.0/account/user/terms?opt_term_cond=001&term_data=SVC202...`
   → the term ids already accepted.
3. `GET {empTermsUri}emp/v2.0/info/terms?...&term_data=SVC202`
   → all currently required term ids.
4. `POST {empTermsUri}emp/v2.0/account/user/terms` with
   `terms=<termsType>:<termsID>:<defaultLang>,...` for the difference.

In practice this scraping breaks often. Opening the LG app and tapping accept
is the reliable fix.

---

## 5. ThinQ2 REST API

Common headers on every call:

```
x-api-key: VGhpblEyLjAgU0VSVklDRQ==
x-client-id: <sha256 hex, stable per install>
x-emp-token: <access_token>
x-user-no: <userNo>
x-thinq-app-ver: 3.6.1200
x-thinq-app-type: NUTS
x-thinq-app-level: PRD
x-thinq-app-os: ANDROID
x-thinq-app-logintype: LGE
x-service-code: SVC202
x-service-phase: OP
x-country-code: TR
x-language-code: tr-TR
x-origin: app-native
x-model-name: samsung/SM-G930L
x-os-version: AOS/7.1.2
x-app-version: LG ThinQ/3.6.12110
x-message-id: <22 random chars>
user-agent: okhttp/3.14.9
```

`x-message-id` must be unique per request. `x-client-id` should be **stable
across restarts** — LG registers it as a push client, and regenerating it every
launch accumulates client registrations and contributes to throttling.

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `service/homes` | `result.item[]` — list of homes (`homeId`) |
| `GET` | `service/homes/{homeId}` | `result.devices[]` — devices in that home |
| `GET` | `service/devices/{deviceId}` | `result` — single device + snapshot |
| `POST` | `service/devices/{deviceId}/control-sync` | send a command |
| `POST` | `service/users/client` | register this client for push |
| `POST` | `service/users/client/certificate` | exchange a CSR for an MQTT cert |
| `GET` | `https://common.lgthinq.com/route` | `result.mqttServer` |

There is **no "list all devices" endpoint** — you must enumerate homes and fan
out per home. That is 1 + N requests per full refresh, which is exactly why a
short poll interval gets an account rate limited.

### Device object

```json
{
  "deviceId": "8ba2a3f1-....",
  "alias": "Salon Klima",
  "deviceType": 401,
  "platformType": "thinq2",
  "modelJsonUri": "https://objectcontent.lgthinq.com/....json",
  "online": true,
  "manufacture": { "macAddress": "...", "salesModel": "...", "serialNo": "..." },
  "snapshot": { "online": true, "airState.operation": 1, "airState.tempState.current": 24 }
}
```

`snapshot` keys are dotted paths (`airState.opMode`, `washerDryer.state`, …) and
are the same keys MQTT reports.

### Device type codes

```
101 REFRIGERATOR        201 WASHER           301 OVEN         401 AC
102 KIMCHI_REFRIGERATOR 202 DRYER            302 MICROWAVE    402 AIR_PURIFIER
103 WATER_PURIFIER      203 STYLER           303 COOKTOP      403 DEHUMIDIFIER
                        204 DISHWASHER       304 HOOD         410 AERO_TOWER
221 WASHER_NEW          222 WASH_TOWER       223 WASH_TOWER_2
501 ROBOT_KING (vacuum) 701 TV               801 BOILER       901 SPEAKER
3001 MISSG  3002 SENSOR  3003 IOT_LIGHTING  3004 IOT_MOTION_SENSOR
3005 IOT_SMART_PLUG  3006 IOT_DUST_SENSOR  4001 EMS_AIR_STATION
4003 AIR_SENSOR  4004 PURICARE_AIR_DETECTOR  9000 HOMEROBOT
```

### Sending a command

```http
POST service/devices/{deviceId}/control-sync
{
  "ctrlKey": "basicCtrl",
  "command": "Set",
  "dataKey": "airState.opMode",
  "dataValue": 0
}
```

- `command` is `Set` or `Operation`.
- `ctrlKey` varies per appliance: `basicCtrl`, `reservationCtrl`, `energyCtrl`…
- Some appliances take `dataSetList` / `dataGetList` objects instead of a single
  `dataKey`/`dataValue` pair.
- Success is `resultCode === "0000"`. Anything else is a failure even on HTTP 200.

Values must be sent with the **type the device model declares** — an `Enum`
expects the numeric index as a number, and sending `"1"` where `1` is expected is
silently rejected by some appliances.

---

## 6. ThinQ1 API

Everything is `POST`, request and response bodies wrapped in `lgedmRoot`:

```http
POST {thinq1Uri}/rti/rtiControl
Accept: application/json
x-thinq-application-key: wideq
x-thinq-security-key: nuts_securitykey
x-thinq-token: <access_token>
x-thinq-jsessionId: <jsessionId>

{ "lgedmRoot": { "cmd": "Control", "cmdOpt": "Set", "deviceId": "...", "value": "..." } }
```

### Monitor lifecycle

ThinQ1 has no push. You rent a "work id", then poll it:

1. **Start** — `POST rti/rtiMon` with
   `{ cmd: "Mon", cmdOpt: "Start", deviceId, workId: <uuid v4 you generate> }`
   → response `workId` is the one to actually use.
2. **Poll** — `POST rti/rtiResult` with
   `{ workList: [{ deviceId, workId }] }`
   → `workList.returnData` is **base64**; decode to a binary buffer.
3. **Stop** — `POST rti/rtiMon` with `cmdOpt: "Stop"` and the work id.

A work id expires. When `workList.returnCode !== '0000'`, stop, re-register, and
poll once more; if that fails too, back off rather than looping.

### Decoding the binary blob

`returnData` is a packed byte array, not JSON. The layout comes from the device
model's `Monitoring.protocol`, which lists `{ superSet, value }` pairs, and
`Value[key].option` gives `{ startByte, length }`. Read `length` bytes at
`startByte` (little-endian) and map through the value definition.

---

## 7. Device model JSON

`device.modelJsonUri` points at a public, unauthenticated JSON file describing
the appliance's full capability surface. **Cache it forever** — it is large,
static per model, and re-downloading it on every start is pure waste.

```json
{
  "Info":  { "productType": "AC", "model": "RAC_056905_WW", "version": "3.0",
             "modelType": "...", "networkType": "..." },
  "Value": {
    "airState.opMode":  { "type": "Enum", "option": { "0": "@AC_MAIN_OPERATION_MODE_COOL_W" } },
    "airState.windStrength": { "type": "Enum", "option": { "2": "@AC_MAIN_WIND_STRENGTH_LOW_W" } },
    "airState.tempState.target": { "type": "Range", "option": { "min": 18, "max": 30, "step": 1 } }
  },
  "Monitoring": { "type": "THINQ2", "protocol": { "state": "State", "process": "Process" } },
  "MonitoringValue": { "state": { "dataType": "enum", "valueMapping": { "...": { "index": "1", "label": "..." } } } }
}
```

Value types: `Enum`, `Range`, `Bit`, `Reference`, `StringComment`.

Notes that matter in practice:

- Labels are `@RESOURCE_KEY` strings resolved through a separate language pack.
  Match on the key, never on a localised label.
- `Monitoring.type === "THINQ2"` means `Value` is keyed by the short protocol
  name while snapshots use the dotted name — you have to map through
  `Monitoring.protocol` to find the definition.
- `WASH_TOWER_2` with `Info.version >= 3` nests the real model under
  `Info.defaultTargetDeviceRoot`; read that sub-object instead of the root.
- A model with no `Monitoring`, `MonitoringValue` **and** no `Value` is a
  non-smart appliance that will never report state.

---

## 8. MQTT push (ThinQ2)

State changes arrive over **AWS IoT Core** with mutual TLS. Provisioning:

1. `GET https://common.lgthinq.com/route` → `result.mqttServer`
   (e.g. `mqtts://aXXXX-ats.iot.eu-west-1.amazonaws.com:8883`).
2. Generate an RSA-2048 key pair locally. **Persist it** — this is your identity.
3. Build a CSR with subject `CN=AWS IoT Certificate, O=Amazon`, sign with SHA-256.
4. `POST service/users/client` with `{}` to register the client id.
5. `POST service/users/client/certificate` with
   `{ "csr": "<PEM body, headers and newlines stripped>" }`
   → `result.certificatePem` and `result.subscriptions[]`.
6. Fetch the right root CA for the broker host:

   | Broker hostname pattern | Root CA |
   |---|---|
   | `*-ats.iot.*.amazonaws.com` | Amazon Root CA 1 |
   | `*.iot.ruic.lgthinq.com` | LG/Sectigo root |
   | anything else | legacy VeriSign Class 3 G5 |

7. Connect with `clientId = x-client-id` and subscribe to every topic in
   `result.subscriptions`.

Message shape:

```json
{
  "deviceId": "8ba2a3f1-...",
  "data": { "state": { "reported": { "airState.operation": 1 } } }
}
```

`data.state.reported` is a **partial** snapshot — merge it into your cached
state, do not replace.

On `offline`, tear the connection down fully and reconnect after a delay
(60s here). The certificate is re-requested on each reconnect; the key pair is not.

---

## 9. Error codes

`resultCode` (ThinQ2) and `lgedmRoot.returnCd` (ThinQ1) share a namespace:

| Code | Meaning | Handling |
|---|---|---|
| `0000` | Success | — |
| `0102` | Access token expired | Refresh once, replay the request |
| `0106` | Device not connected | Transient; device is offline |
| `0110` | New terms need acceptance | §4.5, or open the LG app |
| `0111` | Device not connected | Same as `0106` |
| `9999` | Service unavailable | Backend down; back off |

HTTP-level:

| Status | Meaning |
|---|---|
| `400` / `401` | Bad signature, expired token, or wrong country |
| `429` | **Rate limited** — see below |
| `5xx` | LG backend trouble; retry with backoff |

---

## 10. Rate limiting

LG does not publish limits, and `429` is the single most common cause of a
"broken" integration. What the traffic shape actually looks like:

- A full ThinQ2 refresh costs **1 + N requests** (homes, then each home).
- Polling every 5s on a 2-home account is ~36 req/min sustained, forever.
- Once throttled, LG stays throttled for minutes; retrying at the same cadence
  extends it rather than recovering.

Practical rules:

1. **Do not poll ThinQ2 devices for state.** MQTT already pushes it. Keep polling
   only as a slow reconciliation pass (10 min is plenty).
2. Never go below ~10s even when polling is the only option.
3. Honour `Retry-After` on 429. When it is absent, use exponential backoff with
   jitter — without jitter every device retries on the same tick and re-trips
   the limit.
4. Serialise requests (concurrency 1). Bursting N homes in parallel is what
   trips the limit in the first place.
5. Cache aggressively: `service/homes` changes almost never, and `modelJsonUri`
   content is immutable per model.
6. Keep `x-client-id` stable across restarts.

---

## 11. Minimal working sequence

```
GET  gateway-uri                                  -> thinq1Uri, thinq2Uri, emp URLs
POST oauth2/token (grant_type=refresh_token)      -> access_token
GET  users/profile                                -> userNo
POST {thinq1}/member/login                        -> jsessionId        (ThinQ1 only)
GET  service/homes                                -> homeId[]
GET  service/homes/{homeId}                       -> devices[]
GET  {modelJsonUri}                               -> capability model  (cache forever)
GET  https://common.lgthinq.com/route             -> mqttServer
POST service/users/client{,/certificate}          -> MQTT certificate
     subscribe                                    -> live state
POST service/devices/{id}/control-sync            -> control
```

---

## 12. Legal note

This describes a private API accessed with the account holder's own credentials,
for interoperability with hardware they own. It is not an LG product, it is not
endorsed by LG, and the constants above are extracted from a freely distributed
client. Using it to access accounts or devices that are not yours is neither
supported nor defensible.
