import { Gateway } from './Gateway.js';
import { Session } from './Session.js';
import { Logger } from 'homebridge';
export declare function authErrorCode(err: unknown): string | null;
export declare function authErrorMessage(err: unknown, fallback: string): string;
/**
 * Handles authentication with the LG ThinQ API.
 * This class manages login, token refresh, and user session handling.
 */
export declare class Auth {
    protected gateway: Gateway;
    logger: Logger;
    /**
     * The base URL for the LG API, determined by the user's country code.
     */
    lgeapi_url: string;
    /**
     * Creates a new `Auth` instance.
     *
     * @param gateway - The `Gateway` instance containing API endpoint information.
     * @param logger - The logger instance for logging debug and error messages.
     */
    constructor(gateway: Gateway, logger?: Logger);
    /**
     * Logs in to the LG ThinQ API using the provided username and password.
     *
     * @param username - The user's username.
     * @param password - The user's password.
     * @returns A promise that resolves with a `Session` instance.
     */
    login(username: string, password: string): Promise<Session>;
    /**
     * Performs the second step of the login process using an encrypted password.
     *
     * @param username - The user's username.
     * @param encrypted_password - The encrypted password.
     * @param extra_headers - Optional additional headers for the request.
     * @returns A promise that resolves with a `Session` instance.
     */
    loginStep2(username: string, encrypted_password: string, extra_headers?: any): Promise<Session>;
    /**
     * Retrieves the default headers for EMP requests.
     */
    get defaultEmpHeaders(): {
        Accept: string;
        'X-Application-Key': string;
        'X-Client-App-Key': string;
        'X-Lge-Svccode': string;
        'X-Device-Type': string;
        'X-Device-Platform': string;
        'X-Device-Language-Type': string;
        'X-Device-Publish-Flag': string;
        'X-Device-Country': string;
        'X-Device-Language': string;
        'Content-Type': string;
        'Access-Control-Allow-Origin': string;
        'Accept-Encoding': string;
        'Accept-Language': string;
    };
    /**
     * Handles new terms and conditions that require user agreement.
     *
     * @param accessToken - The access token for the session.
     */
    handleNewTerm(accessToken: string): Promise<void>;
    /**
     * Retrieves the JSession ID for ThinQ v1 API compatibility.
     *
     * @param accessToken - The access token for the session.
     * @returns A promise that resolves with the JSession ID.
     */
    getJSessionId(accessToken: string): Promise<any>;
    /**
     * Refreshes the access token using the refresh token.
     *
     * @param session - The current `Session` instance.
     * @returns A promise that resolves with the updated `Session` instance.
     */
    refreshNewToken(session: Session): Promise<Session>;
    /**
     * Retrieves the user's unique number from the LG API.
     *
     * @param accessToken - The access token for the session.
     * @returns A promise that resolves with the user's unique number.
     */
    getUserNumber(accessToken: string): Promise<string>;
    /**
     * Constructs the login URL for the LG ThinQ API.
     *
     * @returns The login URL.
     */
    getLoginUrl(): Promise<string>;
    /**
     * Generates a signature for API requests.
     *
     * @param message - The message to sign.
     * @param secret - The secret key used for signing.
     * @returns The generated signature.
     */
    protected signature(message: string, secret: string): string;
}
