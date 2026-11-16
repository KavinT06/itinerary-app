// Structured logging: one JSON object per line on stdout, which Vercel collects.
// Callers pass metadata only. Never pass request contents, names, headers or keys.

import 'server-only';

/** @param {{write?: (line: string) => void, now?: () => number}} [options] */
export function createLogger({ write = (line) => console.log(line), now = Date.now } = {}) {
    const emit = (level) => (event, fields = {}) => {
        write(JSON.stringify({ level, event, time: new Date(now()).toISOString(), ...fields }));
    };
    return { info: emit('info'), warn: emit('warn'), error: emit('error') };
}
