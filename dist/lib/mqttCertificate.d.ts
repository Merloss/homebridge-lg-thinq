export declare const ATS_ROOT_CA_URL = "https://www.amazontrust.com/repository/AmazonRootCA1.pem";
export declare const LG_ROOT_CA_URL = "https://support.sectigo.com/sfc/servlet.shepherd/version/download/0683l00000G9fLm";
export declare const LEGACY_ROOT_CA_URL: string;
export declare const MQTT_ROUTE_URL = "https://common.lgthinq.com/route";
export declare const MQTT_CLIENT_PATH = "service/users/client";
export declare const MQTT_CERTIFICATE_PATH = "service/users/client/certificate";
export declare const MQTT_RETRY_ATTEMPTS = 5;
export declare const MQTT_RETRY_DELAY_MS = 5000;
export type MqttCertificatePaths = {
    caPath: string;
    keyPath: string;
    certPath: string;
};
export type MqttKeyPair = {
    privateKey: string;
    publicKey: string;
};
export type MqttRoute = {
    mqttServer: string;
};
export type MqttCertificate = {
    certificatePem: string;
    subscriptions: string[];
};
export type MqttSetupApi = {
    getRequest(uri: string): Promise<any>;
    postRequest(uri: string, data: any): Promise<any>;
};
export type MqttSetupPersist = {
    cacheForever<T>(key: string, producer: () => Promise<T> | T): Promise<T>;
};
export type MqttSetupLogger = {
    debug(...args: any[]): void;
    error?(...args: any[]): void;
};
export type MqttConnectionSetup = {
    route: MqttRoute;
    mqttServer: string;
    hostname: string;
    keys: MqttKeyPair;
    csr: string;
    rootCA: string;
};
export type MqttPreparedConnection = {
    connectData: MqttCertificatePaths & {
        clientId: string;
        host: string;
    };
    subscriptions: string[];
};
export declare function rootCaUrlForMqttHost(hostname: string): string;
export declare function certificateRequestBody(csr: string): string;
export declare function generateMqttKeyPair(): MqttKeyPair;
export declare function createMqttCsr(keys: MqttKeyPair): string;
export declare function requestMqttCertificate(api: MqttSetupApi, csr: string): Promise<MqttCertificate>;
export declare function loadMqttConnectionSetup(options: {
    api: MqttSetupApi;
    persist: MqttSetupPersist;
    logger: MqttSetupLogger;
    createKeys?: () => MqttKeyPair;
    createCsr?: (keys: MqttKeyPair) => string;
}): Promise<MqttConnectionSetup>;
export declare function mqttCertificatePaths(mqttDir: string): MqttCertificatePaths;
export declare function writeIfChanged(path: string, content: string): Promise<void>;
export declare function writeMqttCertificateFiles(options: {
    mqttDir: string;
    rootCA: string;
    privateKey: string;
    certificatePem: string;
}): Promise<MqttCertificatePaths>;
export declare function prepareMqttConnection(options: {
    api: MqttSetupApi;
    setup: MqttConnectionSetup;
    mqttDir: string;
    clientId: string;
}): Promise<MqttPreparedConnection>;
export declare function delayMs(ms: number): Promise<void>;
export declare function retryMqttRegistration(options: {
    register: () => Promise<void>;
    logger: Required<Pick<MqttSetupLogger, 'debug' | 'error'>>;
    delay?: (ms: number) => Promise<void>;
    attempts?: number;
    retryDelayMs?: number;
}): Promise<boolean>;
