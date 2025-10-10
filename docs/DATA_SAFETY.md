# Data Safety Guide

## Overview

The Obsidian MCP Server directly modifies your vault files. Understanding how to protect your data is essential.

## ⚠️ What This Server Does NOT Do

- ❌ Create backups
- ❌ Maintain version history
- ❌ Handle merge conflicts
- ❌ Recover deleted notes
- ❌ Prevent data loss

## ✅ What This Server DOES Do

- ✅ Validates all file paths (prevents system file modification)
- ✅ Requires confirmation for delete operations
- ✅ Provides clear error messages
- ✅ Logs all operations comprehensively
- ✅ Respects file system permissions

## Required: Choose a Backup Solution

Before using this server, you MUST have ONE of these:

### 1. Obsidian Sync (Recommended)

**Best for**: Most users

**Setup**:
1. Enable Obsidian Sync in Obsidian settings
2. Verify sync is working
3. Check version history: Right-click note → "View sync version history"

**Recovery**: Restore from version history (keeps 1 year of versions)

### 2. Git Version Control (Recommended for Developers)

**Best for**: Developers familiar with Git

**Setup**:
```bash
cd /path/to/vault
git init
git add .
git commit -m "Initial commit"

# Optionally add remote
git remote add origin https://github.com/username/vault.git
git push -u origin main
```

**Recovery**: 
```bash
# Undo last change
git revert HEAD

# Restore specific file
git checkout HEAD~1 -- path/to/note.md

# See all changes
git log --oneline
```

### 3. Cloud Sync

**Best for**: Casual users

**Options**: Dropbox, Google Drive, OneDrive, iCloud

**Limitations**: No version history (most services)

**Recovery**: Check trash/deleted files in cloud service

### 4. Manual Backups

**Best for**: Testing only

**Setup**: Copy entire vault folder regularly

**Limitations**: No automatic backups, easy to forget

## Best Practices

### Before Major Operations

1. **Create backup**: Copy vault folder or commit to Git
2. **Test on sample vault**: Try operation on test vault first
3. **Review changes**: Check that operation did what you expected

### Regular Maintenance

- **Daily**: Verify sync/backup is working
- **Weekly**: Test restore procedure
- **Monthly**: Review vault health (orphaned files, broken links)

## Recovery Procedures

### Accidental Deletion

**Obsidian Sync**:
1. Right-click in folder where note was
2. "View sync version history"
3. Find deleted note, restore

**Git**:
```bash
# Find when file was deleted
git log --all --full-history -- path/to/note.md

# Restore from before deletion
git checkout <commit>^ -- path/to/note.md
```

**Cloud Sync**:
1. Check trash/deleted files
2. Restore within retention period (usually 30 days)

**Manual Backup**:
1. Find backup from before deletion
2. Copy file back to vault

### Corrupted Note

**Obsidian Sync**: Restore previous version

**Git**:
```bash
# See file history
git log -p -- path/to/note.md

# Restore to specific version
git checkout <commit> -- path/to/note.md
```

### Entire Vault Corrupted

1. **Don't panic** - your backup has this
2. Delete corrupted vault
3. Restore from backup:
   - Obsidian Sync: Re-download vault
   - Git: `git clone <repository>`
   - Cloud: Re-download from cloud
   - Manual: Copy backup folder

## Testing Your Backup

**Test recovery procedure monthly**:

1. Create test note
2. Delete it with MCP server
3. Recover from backup
4. Verify content is correct

## Emergency Contacts

If you lose data and have no backup:

- ❌ MCP server cannot help (no backups stored)
- ⚠️ Check OS trash/recycle bin
- ⚠️ Try file recovery software (limited success)
- ⚠️ Contact Obsidian support (if using Sync)

## Conclusion

**Data safety is YOUR responsibility.** This server is a tool that modifies files. It cannot protect you from mistakes or hardware failures. Choose a backup solution and test it regularly.

---

**Remember: The best backup is the one you have before you need it.**
