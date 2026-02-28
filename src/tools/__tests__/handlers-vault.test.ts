import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks (hoisted before any imports) ──────────────────────────────────────

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    rename: vi.fn().mockResolvedValue(undefined),
    access: vi.fn(),
    rm: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../platform/obsidian-config.js', () => ({
  readObsidianConfig: vi.fn(),
  writeObsidianConfig: vi.fn().mockResolvedValue(undefined),
  getObsidianConfigPath: vi.fn().mockReturnValue('/fake/obsidian.json'),
}));

vi.mock('../../config/index.js', () => ({
  getActiveConfigPath: vi.fn(),
  loadConfig: vi.fn(),
}));

vi.mock('../../filesystem/vault-reader.js', () => ({
  listNotes: vi.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import fs from 'fs/promises';
import { handleAddVault, handleRemoveVault, handleListVaults } from '../handlers-vault.js';
import { readObsidianConfig, writeObsidianConfig } from '../../platform/obsidian-config.js';
import { getActiveConfigPath, loadConfig } from '../../config/index.js';
import { listNotes } from '../../filesystem/vault-reader.js';

// ── Typed mock references ────────────────────────────────────────────────────

const mockFs = vi.mocked(fs);
const mockReadObsidianConfig = vi.mocked(readObsidianConfig);
const mockWriteObsidianConfig = vi.mocked(writeObsidianConfig);
const mockGetActiveConfigPath = vi.mocked(getActiveConfigPath);
const mockLoadConfig = vi.mocked(loadConfig);
const mockListNotes = vi.mocked(listNotes);

// ── Shared test config ───────────────────────────────────────────────────────

function makeMockConfig() {
  return {
    version: '1.0',
    vaults: [
      { name: 'main', path: '/vaults/main', default: true },
      { name: 'secondary', path: '/vaults/secondary', default: false },
    ],
    rate_limiting: { enabled: false },
  } as any;
}

// ── handleAddVault ────────────────────────────────────────────────────────────

describe('handleAddVault', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates folder and registers vault in both configs', async () => {
    const mockConfig = makeMockConfig();
    const configContent = JSON.stringify({ version: '1.0', vaults: [{ name: 'main', path: '/vaults/main', default: true }] });

    mockReadObsidianConfig.mockResolvedValue({ vaults: {} });
    mockGetActiveConfigPath.mockResolvedValue('/config/config.json');
    mockFs.access.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    mockFs.readFile.mockResolvedValue(configContent as any);
    mockLoadConfig.mockResolvedValue({ ...mockConfig, vaults: [...mockConfig.vaults, { name: 'new-vault', path: '/vaults/new' }] } as any);

    const result = await handleAddVault(mockConfig, {
      name: 'new-vault',
      path: '/vaults/new',
      create_folder: true,
      default: false,
    });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.success).toBe(true);
    expect(payload.folder_created).toBe(true);
    expect(payload.obsidian_registered).toBe(true);
    expect(payload.mcp_registered).toBe(true);
    expect(payload.vault_name).toBe('new-vault');

    // Verify key side-effects
    expect(mockFs.mkdir).toHaveBeenCalledWith('/vaults/new', { recursive: true });
    expect(mockWriteObsidianConfig).toHaveBeenCalled();
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      '/config/config.json',
      expect.stringContaining('new-vault'),
      'utf-8'
    );
  });

  it('rejects duplicate vault name', async () => {
    const mockConfig = makeMockConfig();

    const result = await handleAddVault(mockConfig, {
      name: 'main', // already in mockConfig
      path: '/vaults/new',
    });

    expect(result.isError).toBe(true);
    const text = result.content[0].text as string;
    expect(text).toContain('already exists');
    expect(text).toContain('VALIDATION_ERROR');
  });

  it('handles folder already existing gracefully', async () => {
    const mockConfig = makeMockConfig();
    const configContent = JSON.stringify({ version: '1.0', vaults: [] });

    mockReadObsidianConfig.mockResolvedValue({ vaults: {} });
    mockGetActiveConfigPath.mockResolvedValue('/config/config.json');
    // access resolves = folder exists
    mockFs.access.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(configContent as any);
    mockLoadConfig.mockResolvedValue(mockConfig as any);

    const result = await handleAddVault(mockConfig, {
      name: 'new-vault',
      path: '/vaults/new',
      create_folder: true,
      default: false,
    });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.success).toBe(true);
    // Folder was not created since it already existed
    expect(payload.folder_created).toBe(false);
    // mkdir should NOT have been called at all since access succeeded (folder existed)
    expect(mockFs.mkdir).not.toHaveBeenCalled();
  });
});

// ── handleRemoveVault ─────────────────────────────────────────────────────────

describe('handleRemoveVault', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes vault from both configs', async () => {
    const mockConfig = makeMockConfig();
    const configContent = JSON.stringify({
      version: '1.0',
      vaults: [
        { name: 'main', path: '/vaults/main', default: true },
        { name: 'secondary', path: '/vaults/secondary', default: false },
      ],
    });

    mockReadObsidianConfig.mockResolvedValue({
      vaults: {
        abc123: { path: '/vaults/secondary', ts: 1234567890 },
      },
    });
    mockGetActiveConfigPath.mockResolvedValue('/config/config.json');
    mockFs.readFile.mockResolvedValue(configContent as any);
    mockLoadConfig.mockResolvedValue({
      ...mockConfig,
      vaults: [{ name: 'main', path: '/vaults/main', default: true }],
    } as any);

    const result = await handleRemoveVault(mockConfig, {
      name: 'secondary',
      delete_folder: false,
      confirm: true,
    });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.success).toBe(true);
    expect(payload.vault_name).toBe('secondary');
    expect(payload.obsidian_unregistered).toBe(true);
    expect(payload.mcp_unregistered).toBe(true);
    expect(payload.folder_deleted).toBe(false);

    // Verify obsidian config was updated
    expect(mockWriteObsidianConfig).toHaveBeenCalled();
    // Verify MCP config was updated
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      '/config/config.json',
      expect.not.stringContaining('"secondary"'),
      'utf-8'
    );
  });

  it('blocks removal without confirm', async () => {
    const mockConfig = makeMockConfig();

    const result = await handleRemoveVault(mockConfig, {
      name: 'secondary',
      delete_folder: false,
      confirm: false,
    });

    expect(result.isError).toBe(true);
    const text = result.content[0].text as string;
    expect(text).toContain('Confirmation required');
    expect(text).toContain('VALIDATION_ERROR');
  });

  it('blocks removal of last vault', async () => {
    const singleVaultConfig = {
      version: '1.0',
      vaults: [{ name: 'only-vault', path: '/vaults/only', default: true }],
      rate_limiting: { enabled: false },
    } as any;

    const result = await handleRemoveVault(singleVaultConfig, {
      name: 'only-vault',
      delete_folder: false,
      confirm: true,
    });

    expect(result.isError).toBe(true);
    const text = result.content[0].text as string;
    expect(text).toContain('last vault');
    expect(text).toContain('VALIDATION_ERROR');
  });

  it('blocks removal of default vault', async () => {
    const mockConfig = makeMockConfig();

    const result = await handleRemoveVault(mockConfig, {
      name: 'main', // default: true
      delete_folder: false,
      confirm: true,
    });

    expect(result.isError).toBe(true);
    const text = result.content[0].text as string;
    expect(text).toContain('default vault');
    expect(text).toContain('VALIDATION_ERROR');
  });
});

// ── handleListVaults ──────────────────────────────────────────────────────────

describe('handleListVaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists vaults with disk status and note count', async () => {
    const mockConfig = makeMockConfig();

    mockReadObsidianConfig.mockResolvedValue({
      vaults: {
        abc: { path: '/vaults/main', ts: 1111111111 },
        def: { path: '/vaults/secondary', ts: 2222222222 },
      },
    });
    // Both vaults exist on disk
    mockFs.access.mockResolvedValue(undefined);
    // Both vaults have 5 notes
    const fakeNotes = Array.from({ length: 5 }, (_, i) => ({
      name: `note${i}.md`,
      path: `note${i}.md`,
    }));
    mockListNotes.mockResolvedValue(fakeNotes as any);

    const result = await handleListVaults(mockConfig, {});

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.total).toBe(2);
    expect(Array.isArray(payload.vaults)).toBe(true);
    expect(payload.vaults).toHaveLength(2);

    const main = payload.vaults.find((v: any) => v.name === 'main');
    expect(main).toBeDefined();
    expect(main.exists_on_disk).toBe(true);
    expect(main.registered_in_obsidian).toBe(true);
    expect(main.note_count).toBe(5);
    expect(main.default).toBe(true);

    const secondary = payload.vaults.find((v: any) => v.name === 'secondary');
    expect(secondary).toBeDefined();
    expect(secondary.exists_on_disk).toBe(true);
    expect(secondary.registered_in_obsidian).toBe(true);
    expect(secondary.note_count).toBe(5);
    expect(secondary.default).toBe(false);
  });

  it('handles vault not on disk gracefully', async () => {
    const mockConfig = makeMockConfig();

    mockReadObsidianConfig.mockResolvedValue({ vaults: {} });
    // Both vaults missing from disk
    mockFs.access.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    mockListNotes.mockRejectedValue(new Error('ENOENT'));

    const result = await handleListVaults(mockConfig, {});

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    expect(payload.total).toBe(2);

    for (const vault of payload.vaults) {
      expect(vault.exists_on_disk).toBe(false);
      expect(vault.note_count).toBe(0);
    }
  });

  it('handles obsidian config not found', async () => {
    const mockConfig = makeMockConfig();

    // readObsidianConfig returning empty vaults is what happens when file missing
    mockReadObsidianConfig.mockResolvedValue({ vaults: {} });
    mockFs.access.mockResolvedValue(undefined);
    mockListNotes.mockResolvedValue([] as any);

    const result = await handleListVaults(mockConfig, {});

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text as string);
    for (const vault of payload.vaults) {
      expect(vault.registered_in_obsidian).toBe(false);
    }
  });
});
