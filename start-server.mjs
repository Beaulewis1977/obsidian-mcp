import { createRequire } from 'module';

const require = createRequire(import.meta.url);
if (typeof globalThis.require !== 'function') {
  globalThis.require = require;
}

try {
  await import('./dist/index.js');
} catch (error) {
  console.error('Failed to load server entry point from ./dist/index.js');
  console.error('Common causes:');
  console.error('  • Build not run: execute "npm run build" or "pnpm run build"');
  console.error('  • Wrong working directory: run this script from the project root');
  console.error('  • Missing dependencies: install via "pnpm install" or "npm install"');
  console.error('  • Environment variables missing: ensure CONFIG_PATH and OBSIDIAN_API_KEY are set');
  console.error('Error details:', error);
  process.exit(1);
}
