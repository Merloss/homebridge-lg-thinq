/**
 * Represents a session for interacting with the LG ThinQ API.
 * This class is responsible for managing authentication tokens and session expiration.
 * It provides methods to check the validity of the session and update its properties.
 *
 * @example
 * ```typescript
 * const session = new Session('accessToken', 'refreshToken', Date.now() + 3600 * 1000);
 * if (session.isValid()) {
 *   console.log('Session is valid');
 * } else {
 *   console.log('Session has expired');
 * }
 * ```
 */
export declare class Session {
    /**
     * The access token used for authenticating API requests.
     */
    private _accessToken;
    /**
     * The refresh token used to obtain a new access token when the current one expires.
     */
    private readonly _refreshToken;
    /**
     * The expiration timestamp of the current session, in milliseconds since the Unix epoch.
     */
    private expiresIn;
    /**
     * Creates a new `Session` instance.
     *
     * @param accessToken - The access token for the session.
     * @param refreshToken - The refresh token for the session.
     * @param expiresIn - The expiration timestamp of the session.
     */
    constructor(accessToken: string, refreshToken: string, expiresIn: number);
    /**
     * Updates the session properties with new values.
     *
     * @param accessToken - The new access token.
     * @param expiresIn - The new expiration timestamp.
     */
    newToken(accessToken: string, expiresIn: number): void;
    newTokenFromExpiresIn(accessToken: string, expiresInSeconds: number): void;
    static expiryTimestampFromExpiresIn(expiresInSeconds: number): number;
    /**
     * Gets the access token.
     *
     * @returns The access token.
     */
    get accessToken(): string;
    /**
     * Gets the refresh token.
     *
     * @returns The refresh token.
     */
    get refreshToken(): string;
    /**
     * Checks if the session has an access token.
     *
     * @returns `true` if the session has an access token, otherwise `false`.
     */
    hasToken(): boolean;
    /**
     * Checks if the access token is expired.
     *
     * @returns `true` if the access token is expired, otherwise `false`.
     */
    isTokenExpired(): boolean;
    /**
     * Checks if the session has a valid access token.
     *
     * @returns `true` if the session has a valid access token, otherwise `false`.
     */
    hasValidToken(): boolean;
    /**
     * Gets the current epoch time in seconds.
     *
     * @returns The current epoch time in seconds.
     */
    private static getCurrentEpoch;
}
