import type { SportPlugin } from './_contracts/SportPlugin';

const plugins = new Map<string, SportPlugin>();

export const sportRegistry = {
    register(plugin: SportPlugin) {
        if (plugins.has(plugin.sportKey)) {
            throw new Error(`SportPlugin "${plugin.sportKey}" already registered`);
        }
        if (plugin.reducer) {
            for (const sliceKey of Object.keys(plugin.reducer)) {
                for (const other of plugins.values()) {
                    if (other.reducer && sliceKey in other.reducer) {
                        throw new Error(
                            `Slice key "${sliceKey}" from sport "${plugin.sportKey}" collides with sport "${other.sportKey}"`
                        );
                    }
                }
            }
        }
        plugins.set(plugin.sportKey, plugin);
    },

    get(sportKey: string): SportPlugin | undefined {
        return plugins.get(sportKey);
    },

    list(): SportPlugin[] {
        return Array.from(plugins.values());
    },
};
