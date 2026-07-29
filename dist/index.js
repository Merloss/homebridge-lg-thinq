import { PLATFORM_NAME } from './settings.js';
import { LGThinQHomebridgePlatform } from './platform.js';
/**
 * This method registers the platform with Homebridge
 */
export default (api) => {
    api.registerPlatform(PLATFORM_NAME, LGThinQHomebridgePlatform);
};
//# sourceMappingURL=index.js.map