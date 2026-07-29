import { Session } from './Session.js';
import { Gateway } from './Gateway.js';
import { Auth } from './Auth.js';
import { WorkId } from './ThinQ.js';
import { Method } from 'axios';
import { Logger } from 'homebridge';
/**
 * The `API` class provides methods to interact with the LG ThinQ API, enabling
 * device management, home management, and command execution. It handles
 * authentication, session management, and API requests with appropriate headers.
 *
 * @remarks
 * This class includes methods for sending commands to devices, retrieving device
 * and home information, and managing authentication tokens. It supports both
 * ThinQ1 and ThinQ2 APIs.
 *
 * @example
 * ```typescript
 * const api = new API('US', 'en-US', logger);
 * api.setUsernamePassword('username', 'password');
 * await api.ready();
 * const devices = await api.getListDevices();
 * console.log(devices);
 * ```
 *
 * @param country - The country code (default: 'US').
 * @param language - The language code (default: 'en-US').
 * @param logger - The logger instance for logging debug and error messages.
 */
export declare class API {
    protected country: string;
    protected language: string;
    protected logger: Logger;
    protected _homes: any;
    protected _gateway: Gateway | undefined;
    protected session: Session;
    protected jsessionId: string;
    protected auth: Auth;
    protected userNumber: string;
    protected username: string;
    protected password: string;
    client_id: string;
    /** Optional store used to keep `client_id` stable across restarts. */
    clientIdStore?: {
        cacheForever(key: string, callable: () => Promise<any>): Promise<any>;
    };
    httpClient: import("axios").AxiosInstance;
    constructor(country?: string, language?: string, logger?: Logger);
    /**
     * Sends a GET request to the specified URI.
     *
     * @param uri - The URI to send the GET request to.
     * @returns A promise resolving to the response data.
     * @throws Error if the URI is invalid.
     */
    getRequest(uri: string): Promise<any>;
    /**
     * Sends a POST request to the specified URI with the provided data.
     *
     * @param uri - The URI to send the POST request to.
     * @param data - The data to include in the POST request.
     * @returns A promise resolving to the response data.
     */
    postRequest(uri: string, data: any): Promise<any>;
    resolveUrl(from: string, to: string): string;
    /**
     * Sends an HTTP request to the ThinQ API.
     *
     * @param method - The HTTP method ('get' or 'post').
     * @param uri - The URI to send the request to.
     * @param data - Optional data to include in the request.
     * @param retry - Whether to retry the request in case of token expiration.
     * @returns A promise resolving to the response data.
     */
    protected request(method: Method | undefined, uri: string, data?: any, retry?: boolean): Promise<any>;
    protected get monitorHeaders(): Record<string, string>;
    protected get defaultHeaders(): {
        'x-api-key': string;
        'x-thinq-app-ver': string;
        'x-thinq-app-type': string;
        'x-thinq-app-level': string;
        'x-thinq-app-os': string;
        'x-thinq-app-logintype': string;
        'x-service-code': string;
        'x-country-code': string;
        'x-language-code': string;
        'x-service-phase': string;
        'x-origin': string;
        'x-model-name': string;
        'x-os-version': string;
        'x-app-version': string;
        'x-message-id': string;
        'user-agent': string;
    };
    getSingleDevice(device_id: string): Promise<any>;
    /**
     * Retrieves the list of devices associated with the user's account.
     *
     * @returns A promise resolving to an array of devices.
     */
    getListDevices(): Promise<Record<string, any>[]>;
    /**
     * Retrieves the list of homes associated with the user's account.
     *
     * @returns A promise resolving to an array of homes.
     */
    getListHomes(): Promise<any>;
    /**
     * Sends a command to a specific device.
     *
     * @param device_id - The ID of the device to send the command to.
     * @param values - The command values to send.
     * @param command - The type of command ('Set' or 'Operation').
     * @param ctrlKey - The control key (default: 'basicCtrl').
     * @param ctrlPath - The control path (default: 'control-sync').
     * @returns A promise resolving to the response of the command.
     * @throws Error if `device_id` is not a valid non-empty string.
     */
    sendCommandToDevice(device_id: string, values: Record<string, any>, command: 'Set' | 'Operation', ctrlKey?: string, ctrlPath?: string): Promise<any>;
    /**
     * Sends a monitor command to a specific device.
     *
     * @param deviceId - The ID of the device to monitor.
     * @param cmdOpt - The command option for monitoring.
     * @param workId - The work ID associated with the monitoring command.
     * @returns A promise resolving to the response of the monitor command.
     * @throws Error if `deviceId` or `cmdOpt` is not a valid non-empty string.
     */
    sendMonitorCommand(deviceId: string, cmdOpt: string, workId: WorkId): Promise<any>;
    /**
     * Retrieves the monitor result for a specific device and work ID.
     *
     * @param device_id - The ID of the device.
     * @param work_id - The work ID associated with the monitor result.
     * @returns A promise resolving to the monitor result or null if not available.
     * @throws Error if `device_id` or `work_id` is not a valid non-empty string.
     */
    getMonitorResult(device_id: string, work_id: string): Promise<Buffer<ArrayBuffer> | null>;
    setRefreshToken(refreshToken: string): void;
    setUsernamePassword(username: string, password: string): void;
    gateway(): Promise<Gateway>;
    ready(): Promise<void>;
    refreshNewToken(session?: Session | null): Promise<void>;
    thinq1PostRequest(endpoint: string, data: any): Promise<any>;
}
