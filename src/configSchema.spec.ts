import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Read rather than import: the file sits outside rootDir, and this is checking
// the shipped artefact anyway.
const schema = JSON.parse(readFileSync(join(process.cwd(), 'config.schema.json'), 'utf8'));

describe('config.schema.json', () => {
  test('gives every device option a field in the form', () => {
    // The settings screen renders from `layout`, so an option that only exists
    // under `properties` cannot be set from the UI at all - it silently keeps
    // its default no matter what the plugin does with it. That is how
    // ac_led_control went unreachable.
    const properties = Object.keys(schema.schema.devices.items.properties);
    const layout = JSON.stringify(schema.layout);

    expect(properties.filter(key => !layout.includes(`devices[].${key}`))).toEqual([]);
  });

  test('keeps the platform alias the plugin registers under', () => {
    // Changing this orphans every accessory in an existing config.
    expect(schema.pluginAlias).toBe('LGThinQ');
    expect(schema.pluginType).toBe('platform');
  });
});
