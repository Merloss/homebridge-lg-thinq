import * as FS from 'fs';
import * as Path from 'path';
import forge from 'node-forge';
import { URL } from 'url';
export const ATS_ROOT_CA_URL = 'https://www.amazontrust.com/repository/AmazonRootCA1.pem';
export const LG_ROOT_CA_URL = 'https://support.sectigo.com/sfc/servlet.shepherd/version/download/0683l00000G9fLm';
export const LEGACY_ROOT_CA_URL = 'https://www.websecurity.digicert.com/content/dam/websitesecurity/digitalassets/desktop/pdfs/roots/' +
    'VeriSign-Class%203-Public-Primary-Certification-Authority-G5.pem';
export const MQTT_ROUTE_URL = 'https://common.lgthinq.com/route';
export const MQTT_CLIENT_PATH = 'service/users/client';
export const MQTT_CERTIFICATE_PATH = 'service/users/client/certificate';
export const MQTT_RETRY_ATTEMPTS = 5;
export const MQTT_RETRY_DELAY_MS = 5000;
export function rootCaUrlForMqttHost(hostname) {
    if (hostname.match(/^([^.]+)-ats.iot.([^.]+).amazonaws.com$/g)) {
        return ATS_ROOT_CA_URL;
    }
    if (hostname.match(/^([^.]+).iot.ruic.lgthinq.com$/g)) {
        return LG_ROOT_CA_URL;
    }
    return LEGACY_ROOT_CA_URL;
}
export function certificateRequestBody(csr) {
    return csr.replace(/-----(BEGIN|END) CERTIFICATE REQUEST-----/g, '').replace(/(\r\n|\r|\n)/g, '');
}
export function generateMqttKeyPair() {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    return {
        privateKey: forge.pki.privateKeyToPem(keys.privateKey),
        publicKey: forge.pki.publicKeyToPem(keys.publicKey),
    };
}
export function createMqttCsr(keys) {
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = forge.pki.publicKeyFromPem(keys.publicKey);
    csr.setSubject([
        {
            shortName: 'CN',
            value: 'AWS IoT Certificate',
        },
        {
            shortName: 'O',
            value: 'Amazon',
        },
    ]);
    csr.sign(forge.pki.privateKeyFromPem(keys.privateKey), forge.md.sha256.create());
    return forge.pki.certificationRequestToPem(csr);
}
export async function requestMqttCertificate(api, csr) {
    await api.postRequest(MQTT_CLIENT_PATH, {});
    return await api.postRequest(MQTT_CERTIFICATE_PATH, {
        csr: certificateRequestBody(csr),
    }).then(data => data.result);
}
export async function loadMqttConnectionSetup(options) {
    const { api, persist, logger, createKeys = generateMqttKeyPair, createCsr = createMqttCsr, } = options;
    const route = await api.getRequest(MQTT_ROUTE_URL).then(data => data.result);
    const keys = await persist.cacheForever('keys', async () => {
        logger.debug('Generating 2048-bit key-pair...');
        return createKeys();
    });
    const csr = await persist.cacheForever('csr', async () => {
        logger.debug('Creating certification request (CSR)...');
        return createCsr(keys);
    });
    const urls = new URL(route.mqttServer);
    const rootCA = await api.getRequest(rootCaUrlForMqttHost(urls.hostname));
    return {
        route,
        mqttServer: route.mqttServer,
        hostname: urls.hostname,
        keys,
        csr,
        rootCA,
    };
}
export function mqttCertificatePaths(mqttDir) {
    return {
        caPath: Path.join(mqttDir, 'ca.pem'),
        keyPath: Path.join(mqttDir, 'key.pem'),
        certPath: Path.join(mqttDir, 'cert.pem'),
    };
}
export async function writeIfChanged(path, content) {
    try {
        const existing = await FS.promises.readFile(path, 'utf8').catch(() => null);
        if (existing !== content) {
            await FS.promises.writeFile(path, content, 'utf8');
        }
    }
    catch (err) {
        await FS.promises.writeFile(path, content, 'utf8');
    }
}
export async function writeMqttCertificateFiles(options) {
    const { mqttDir, rootCA, privateKey, certificatePem } = options;
    await FS.promises.mkdir(mqttDir, { recursive: true });
    const paths = mqttCertificatePaths(mqttDir);
    await writeIfChanged(paths.caPath, rootCA);
    await writeIfChanged(paths.keyPath, privateKey);
    await writeIfChanged(paths.certPath, certificatePem);
    return paths;
}
export async function prepareMqttConnection(options) {
    const { api, setup, mqttDir, clientId } = options;
    const certificate = await requestMqttCertificate(api, setup.csr);
    const paths = await writeMqttCertificateFiles({
        mqttDir,
        rootCA: setup.rootCA,
        privateKey: setup.keys.privateKey,
        certificatePem: certificate.certificatePem,
    });
    return {
        connectData: {
            ...paths,
            clientId,
            host: setup.hostname,
        },
        subscriptions: certificate.subscriptions,
    };
}
export function delayMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export async function retryMqttRegistration(options) {
    const { register, logger, delay = delayMs, attempts = MQTT_RETRY_ATTEMPTS, retryDelayMs = MQTT_RETRY_DELAY_MS, } = options;
    let tried = attempts;
    while (tried > 0) {
        try {
            await register();
            return true;
        }
        catch (err) {
            tried--;
            logger.debug('mqtt err:', err);
            if (tried > 0) {
                logger.debug('Cannot start MQTT, retrying in 5s.');
                await delay(retryDelayMs);
            }
        }
    }
    logger.error('Cannot start MQTT!');
    return false;
}
//# sourceMappingURL=mqttCertificate.js.map