#!/usr/bin/env node
import { Command } from 'commander';
import { API } from './lib/API.js';
import { Auth } from './lib/Auth.js';
import { devicesFromList } from './lib/Device.js';
import { URL } from 'url';
import * as FS from 'fs';
import * as readline from 'readline';
const makeLogger = () => console;
/** Quiet logger for inspection commands, so report output is not buried in debug noise. */
const quietLogger = () => ({
    debug: () => { },
    info: () => { },
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
    log: () => { },
    success: () => { },
    prefix: '',
});
const REDACTED_KEYS = ['macAddress', 'serialNo', 'ssid', 'deviceId', 'userNo', 'homeId'];
/** Masks account-identifying fields so a dump can be shared in a bug report. */
function redactValue(value, enabled) {
    if (!enabled || value === null || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(item => redactValue(item, enabled));
    }
    const out = {};
    for (const [key, item] of Object.entries(value)) {
        out[key] = REDACTED_KEYS.includes(key) && typeof item === 'string'
            ? item.slice(0, 4) + '…<redacted>'
            : redactValue(item, enabled);
    }
    return out;
}
async function connect(token, country, language) {
    if (!token) {
        console.error('A refresh token is required. Pass -t <token>, or run "thinq login" / "thinq auth" first.');
        process.exit(1);
    }
    const api = new API(country, language, quietLogger());
    api.setRefreshToken(token);
    try {
        await api.ready();
    }
    catch (err) {
        // A stack trace helps nobody here; the causes are all actionable.
        console.error('Could not connect to LG ThinQ: ' + (err?.message ?? err));
        console.error('Check that the refresh token is valid and that --country/--language match your account.');
        process.exit(1);
    }
    return api;
}
/** Runs a command body, turning any escape into a readable message. */
function run(action) {
    return async (...args) => {
        try {
            await action(...args);
        }
        catch (err) {
            console.error('Command failed: ' + (err?.message ?? err));
            process.exit(1);
        }
    };
}
const input = (question) => new Promise((resolve) => {
    const rl = readline.createInterface(process.stdin, process.stdout);
    rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
    });
});
const program = new Command();
const options = {
    country: 'US',
    language: 'en-US',
};
program
    .option('-c, --country <type>', 'Country code for account', options.country)
    .on('option:country', (value) => options.country = value)
    .option('-l, --language <type>', 'Language code for account', options.language)
    .on('option:language', (value) => options.language = value)
    .option('-t, --token <refresh_token>', 'Refresh token (see the login/auth commands)')
    .on('option:token', (value) => options.token = value);
program
    .command('login')
    .description('Obtain refresh_token from LG account')
    .argument('<username>', 'LG username')
    .argument('<password>', 'LG password')
    .action(async (username, password) => {
    console.info('Start login: username =', username, ', country =', options.country, ', language =', options.language);
    const logger = makeLogger();
    try {
        const api = new API(options.country, options.language, logger);
        const gateway = await api.gateway();
        const auth = new Auth(gateway, logger);
        const session = await auth.login(username, password);
        console.info('Your refresh_token:', session.refreshToken);
    }
    catch (err) {
        console.error(err);
    }
    process.exit(0);
});
program
    .command('auth')
    .description('Obtain refresh_token from account logged by Google Account, Apple ID')
    .action(async () => {
    const logger = makeLogger();
    const api = new API(options.country, options.language, logger);
    const gateway = await api.gateway();
    const auth = new Auth(gateway, logger);
    const loginUrl = new URL(await auth.getLoginUrl());
    const origin = loginUrl.origin;
    loginUrl.host = 'us.m.lgaccount.com';
    loginUrl.searchParams.set('division', 'ha'); // enable Apple ID
    loginUrl.searchParams.set('redirect_uri', origin + '/login/iabClose');
    loginUrl.searchParams.set('callback_url', origin + '/login/iabClose');
    console.info('Log in here:', loginUrl.href);
    const callbackUrl = await input('Then paste the URL where the browser is redirected: ');
    const url = new URL(callbackUrl);
    const refresh_token = url.searchParams.get('refresh_token');
    if (refresh_token) {
        console.info('Your refresh_token:', refresh_token);
        process.exit(0);
        return;
    }
    const username = url.searchParams.get('user_id'), thirdparty_token = url.searchParams.get('user_thirdparty_token'), id_type = url.searchParams.get('user_id_type') || '';
    const thirdparty = {
        APPL: 'apple',
        FBK: 'facebook',
        GGL: 'google',
        AMZ: 'amazon',
    };
    if (!username || !thirdparty_token || typeof thirdparty[id_type] === 'undefined') {
        console.error('redirected url not valid, please try again or use LG account method');
        process.exit(0);
        return;
    }
    try {
        const session = await auth.loginStep2(username, thirdparty_token, {
            third_party: thirdparty[id_type],
        });
        console.info('Your refresh_token:', session.refreshToken);
    }
    catch (err) {
        console.error(err);
    }
    process.exit(0);
});
program
    .command('devices')
    .description('List the devices on the account, with the id needed for config.json')
    .action(run(async () => {
    const api = await connect(options.token, options.country, options.language);
    const devices = devicesFromList(await api.getListDevices());
    if (!devices.length) {
        console.info('No devices found on this account.');
        process.exit(0);
    }
    for (const device of devices) {
        console.info('');
        console.info(device.name);
        console.info('  id        ', device.id);
        console.info('  type      ', device.type, '(' + device.data.deviceType + ')');
        console.info('  platform  ', device.platform);
        console.info('  online    ', device.data.online ?? device.data.snapshot?.online);
        console.info('  model     ', device.data.manufacture?.salesModel || device.data.modelName || 'unknown');
    }
    console.info('');
    console.info(devices.length + ' device(s). Use "thinq dump <id>" for the full capability report.');
    process.exit(0);
}));
program
    .command('dump')
    .description('Dump one device\'s snapshot and capability model, for tailoring config or adding support')
    .argument('<deviceId>', 'Device id from "thinq devices"')
    .option('-o, --out <file>', 'Write the full JSON report to a file')
    .option('--no-redact', 'Keep MAC address, serial number and ids in the output')
    .action(run(async (deviceId, cmdOptions) => {
    const api = await connect(options.token, options.country, options.language);
    const devices = devicesFromList(await api.getListDevices());
    const device = devices.find(item => item.id === deviceId);
    if (!device) {
        console.error('No device with id ' + deviceId + '. Run "thinq devices" to list them.');
        process.exit(1);
    }
    const modelJson = await api.httpClient.get(device.data.modelJsonUri).then(res => res.data).catch(err => {
        console.error('Could not download the capability model:', err.message);
        return null;
    });
    const snapshot = device.data.snapshot ?? {};
    const redact = cmdOptions.redact !== false;
    console.info('');
    console.info('Device      ', device.name);
    console.info('Type        ', device.type, '(' + device.data.deviceType + ')');
    console.info('Platform    ', device.platform);
    console.info('Model       ', device.data.manufacture?.salesModel || device.data.modelName || 'unknown');
    console.info('Model type  ', modelJson?.Info?.modelType ?? 'unknown');
    console.info('Model ver   ', modelJson?.Info?.version ?? 'unknown');
    console.info('');
    console.info('Reported snapshot keys (' + Object.keys(snapshot).length + '):');
    for (const key of Object.keys(snapshot).sort()) {
        console.info('  ' + key.padEnd(42), JSON.stringify(snapshot[key]));
    }
    if (modelJson?.Value) {
        console.info('');
        console.info('Controllable values (' + Object.keys(modelJson.Value).length + '):');
        for (const key of Object.keys(modelJson.Value).sort()) {
            const definition = modelJson.Value[key];
            const detail = definition?.type === 'Range'
                ? `Range ${definition.option?.min}..${definition.option?.max} step ${definition.option?.step}`
                : definition?.type === 'Enum'
                    ? 'Enum ' + JSON.stringify(definition.option)
                    : definition?.type ?? 'unknown';
            console.info('  ' + key.padEnd(42), detail);
        }
    }
    if (cmdOptions.out) {
        const report = redactValue({
            info: modelJson?.Info ?? null,
            device: device.data,
            model: modelJson,
        }, redact);
        await FS.promises.writeFile(cmdOptions.out, JSON.stringify(report, null, 2), 'utf8');
        console.info('');
        console.info('Full report written to ' + cmdOptions.out + (redact ? ' (identifiers redacted).' : ' (NOT redacted).'));
    }
    process.exit(0);
}));
program.parse(process.argv);
//# sourceMappingURL=cli.js.map