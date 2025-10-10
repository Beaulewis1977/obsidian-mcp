import { createRequire } from 'module';

const require = createRequire(import.meta.url);
if (typeof globalThis.require !== 'function') {
  globalThis.require = require;
}

try {
  await import('./dist/index.js');
} catch (error) {
  console.error('Failed to load server entry point from ./dist/index.js:', error);
  process.exit(1);
}
