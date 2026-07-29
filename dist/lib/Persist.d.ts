export declare function isPersistCacheMiss(value: unknown): value is null | undefined;
/**
 * A utility class for managing persistent storage using `node-persist`.
 * This class provides methods for storing, retrieving, and caching data with optional expiration.
 *
 * @example
 * ```typescript
 * const persist = new Persist('./storage');
 * await persist.init();
 * await persist.setItem('key', 'value');
 * const value = await persist.getItem('key');
 * console.log(value); // Output: 'value'
 * ```
 */
export default class Persist {
    /**
     * The `node-persist` instance used for managing storage.
     */
    protected persist: any | null;
    protected dir: string;
    /**
     * Creates a new `Persist` instance.
     *
     * @param dir - The directory where the persistent storage files will be stored.
     */
    constructor(dir: string);
    /**
     * Generates a SHA-256 hash of the given input string.
     *
     * @param input - The input string to hash.
     * @returns The SHA-256 hash of the input string.
     */
    protected sha256(input: string): string;
    /**
     * Detect and migrate legacy plain JSON files in the storage directory.
     * Legacy files are assumed to be named by the original key (not sha256(key))
     * and contain raw JSON for the value. Migrated files are written as
     * JSON datum { key, value, ttl } into filename sha256(key).
     */
    protected migrateLegacyFiles(): Promise<void>;
    /**
     * Initializes the persistent storage.
     *
     * @returns A promise that resolves when the storage is initialized.
     */
    init(): Promise<any>;
    /**
     * Retrieves an item from storage by its key.
     *
     * @param key - The key of the item to retrieve.
     * @returns A promise that resolves with the value of the item, or `null` if the item does not exist.
     */
    getItem(key: string): Promise<any>;
    /**
     * Stores an item in storage with the specified key and value.
     *
     * @param key - The key to associate with the item.
     * @param value - The value to store.
     * @returns A promise that resolves when the item is stored.
     */
    setItem(key: string, value: any): Promise<any>;
    /**
     * Caches a value indefinitely. If the value does not exist in storage, it is retrieved using the provided callable function.
     *
     * @param key - The key to associate with the cached value.
     * @param callable - A function that returns a promise resolving to the value to cache.
     * @returns A promise that resolves with the cached value.
     */
    cacheForever(key: string, callable: () => Promise<any>): Promise<any>;
    /**
     * Caches a value with a time-to-live (TTL). If the value does not exist or is expired, it is retrieved using the provided callable function.
     *
     * @param key - The key to associate with the cached value.
     * @param ttl - The time-to-live for the cached value, in milliseconds.
     * @param callable - A function that returns a promise resolving to the value to cache.
     * @returns A promise that resolves with the cached value.
     */
    cache(key: string, ttl: number, callable: () => Promise<any>): Promise<any>;
    /**
     * Stores an item in storage with an expiration time.
     *
     * @param key - The key to associate with the item.
     * @param value - The value to store.
     * @param ttl - The time-to-live for the item, in milliseconds.
     * @returns A promise that resolves when the item is stored.
     */
    setWithExpiry(key: string, value: any, ttl: number): Promise<void>;
    /**
     * Retrieves an item from storage by its key, considering its expiration time.
     *
     * @param key - The key of the item to retrieve.
     * @returns A promise that resolves with the value of the item, or `null` if the item does not exist or is expired.
     */
    getWithExpiry(key: string): Promise<any>;
    /**
     * Removes an item from storage by its key.
     *
     * @param key - The key of the item to remove.
     * @returns A promise that resolves when the item is removed.
     */
    removeItem(key: string): Promise<any>;
}
