# Requirements Document: Phase 4 - Advanced Tools & Features

## Introduction

This document outlines requirements for **Phase 4** features that add advanced functionality to the Obsidian MCP Server. These tools go beyond basic CRUD operations to provide deeper integration with Obsidian's advanced features.

**Prerequisites:** Phase 1-3 complete (production readiness achieved)

**Estimated Effort:** 80-120 hours (3-4 weeks)

---

## Requirements

### Requirement 11: Graph Operations & Link Analysis

**User Story:** As a knowledge worker, I want to analyze the relationship graph of my notes so that I can discover connections and understand the structure of my knowledge base.

#### Acceptance Criteria

1. WHEN get_graph_data is called THEN complete graph structure SHALL be returned with nodes and edges
2. WHEN get_note_neighbors is called THEN all directly connected notes SHALL be returned
3. WHEN get_note_path is called with two note paths THEN shortest path between notes SHALL be calculated
4. WHEN analyze_note_centrality is called THEN centrality metrics SHALL be calculated (degree, betweenness, closeness)
5. WHEN find_clusters is called THEN note clusters/communities SHALL be identified
6. WHEN find_orphans is called THEN notes with no links SHALL be returned
7. WHEN find_hubs is called THEN highly connected notes SHALL be identified
8. WHEN graph operations are performed on large vaults (1000+ notes) THEN results SHALL be returned within 10 seconds

---

### Requirement 12: Canvas File Operations

**User Story:** As an Obsidian Canvas user, I want to read and manipulate canvas files so that AI can help me organize visual knowledge boards.

#### Acceptance Criteria

1. WHEN read_canvas is called THEN canvas structure SHALL be returned with nodes, edges, and positions
2. WHEN create_canvas is called THEN new canvas file SHALL be created with specified nodes and edges
3. WHEN add_canvas_node is called THEN new node SHALL be added to existing canvas
4. WHEN update_canvas_node is called THEN node properties SHALL be updated (position, size, color, content)
5. WHEN delete_canvas_node is called THEN node SHALL be removed from canvas
6. WHEN add_canvas_edge is called THEN connection between nodes SHALL be created
7. WHEN canvas operations fail THEN structured error with recovery suggestions SHALL be returned
8. WHEN canvas file is invalid JSON THEN parsing error with details SHALL be returned

---

### Requirement 13: Template System

**User Story:** As a user with standardized note formats, I want to apply templates to new notes so that I can maintain consistency across my vault.

#### Acceptance Criteria

1. WHEN list_templates is called THEN all templates in configured folder SHALL be returned
2. WHEN read_template is called THEN template content with variables SHALL be returned
3. WHEN apply_template is called THEN template SHALL be applied with variable substitution
4. WHEN create_from_template is called THEN new note SHALL be created from template
5. WHEN template contains {{date}} variable THEN current date SHALL be substituted
6. WHEN template contains {{time}} variable THEN current time SHALL be substituted
7. WHEN template contains {{title}} variable THEN note title SHALL be substituted
8. WHEN template contains custom variables THEN user-provided values SHALL be substituted
9. WHEN template file not found THEN error with available templates SHALL be returned
10. WHEN template syntax is invalid THEN parsing error with details SHALL be returned

---

### Requirement 14: Dataview Query Support

**User Story:** As a Dataview plugin user, I want to execute Dataview queries programmatically so that AI can analyze my vault using Dataview's powerful query language.

#### Acceptance Criteria

1. WHEN execute_dataview_query is called with DQL query THEN query results SHALL be returned
2. WHEN execute_dataview_query is called with JavaScript query THEN query results SHALL be returned
3. WHEN Dataview plugin is not installed THEN clear error message SHALL be returned
4. WHEN Dataview query is invalid THEN syntax error with details SHALL be returned
5. WHEN Dataview query times out THEN timeout error with suggestion SHALL be returned
6. WHEN Dataview query returns large result set THEN results SHALL be paginated
7. WHEN get_dataview_fields is called THEN all available fields in vault SHALL be returned
8. WHEN query execution fails THEN error SHALL include query text and line number

---

### Requirement 15: Advanced Search Features

**User Story:** As a power user, I want advanced search capabilities so that I can find notes using complex criteria beyond simple text search.

#### Acceptance Criteria

1. WHEN search_by_regex is called THEN notes matching regex pattern SHALL be returned
2. WHEN search_by_tag_combination is called THEN notes with all specified tags SHALL be returned
3. WHEN search_by_date_range is called THEN notes created/modified in range SHALL be returned
4. WHEN search_by_frontmatter is called THEN notes with matching frontmatter SHALL be returned
5. WHEN search_by_file_size is called THEN notes within size range SHALL be returned
6. WHEN search_by_word_count is called THEN notes within word count range SHALL be returned
7. WHEN fuzzy_search is called THEN notes with similar content SHALL be returned with similarity score
8. WHEN advanced search is performed THEN results SHALL include relevance scores

---

### Requirement 16: Bulk Operations

**User Story:** As a user managing large vaults, I want to perform bulk operations so that I can efficiently update multiple notes at once.

#### Acceptance Criteria

1. WHEN bulk_update_frontmatter is called THEN specified frontmatter SHALL be updated across multiple notes
2. WHEN bulk_add_tags is called THEN tags SHALL be added to multiple notes
3. WHEN bulk_remove_tags is called THEN tags SHALL be removed from multiple notes
4. WHEN bulk_rename is called THEN multiple notes SHALL be renamed with pattern
5. WHEN bulk_move is called THEN multiple notes SHALL be moved to target folder
6. WHEN bulk_delete is called with confirmation THEN multiple notes SHALL be deleted
7. WHEN bulk operation affects >100 notes THEN confirmation SHALL be required
8. WHEN bulk operation fails partially THEN detailed report SHALL show successes and failures
9. WHEN bulk operation is performed THEN progress updates SHALL be provided
10. WHEN bulk operation is cancelled THEN partial changes SHALL be reported

---

### Requirement 17: Note History & Versions

**User Story:** As a user concerned about data loss, I want to access note history so that I can recover previous versions of my notes.

#### Acceptance Criteria

1. WHEN get_note_history is called THEN list of previous versions SHALL be returned with timestamps
2. WHEN read_note_version is called THEN specific historical version SHALL be returned
3. WHEN restore_note_version is called THEN note SHALL be restored to previous version
4. WHEN compare_note_versions is called THEN diff between versions SHALL be returned
5. WHEN note history is unavailable THEN clear message SHALL explain limitation
6. WHEN Obsidian file recovery plugin is not enabled THEN suggestion SHALL be provided
7. WHEN version restore fails THEN current version SHALL remain unchanged
8. WHEN history operations are performed THEN they SHALL not modify current note

---

### Requirement 18: Attachment Management

**User Story:** As a user with media files, I want to manage attachments so that AI can help organize images, PDFs, and other files in my vault.

#### Acceptance Criteria

1. WHEN list_attachments is called THEN all attachment files SHALL be returned with metadata
2. WHEN get_attachment_info is called THEN file size, type, and references SHALL be returned
3. WHEN find_unused_attachments is called THEN attachments not referenced in any note SHALL be returned
4. WHEN find_broken_links is called THEN notes with missing attachment references SHALL be returned
5. WHEN move_attachment is called THEN attachment SHALL be moved and all references SHALL be updated
6. WHEN delete_attachment is called with confirmation THEN attachment SHALL be deleted
7. WHEN attachment operations fail THEN error SHALL include affected notes
8. WHEN large attachments are processed THEN memory usage SHALL remain reasonable

---

### Requirement 19: Workspace & Layout Management

**User Story:** As a user with multiple workspace layouts, I want to manage Obsidian workspaces programmatically so that AI can help me switch contexts.

#### Acceptance Criteria

1. WHEN list_workspaces is called THEN all saved workspaces SHALL be returned
2. WHEN get_current_workspace is called THEN active workspace configuration SHALL be returned
3. WHEN switch_workspace is called THEN Obsidian SHALL switch to specified workspace
4. WHEN save_workspace is called THEN current layout SHALL be saved with specified name
5. WHEN delete_workspace is called THEN workspace SHALL be removed
6. WHEN workspace operations require Obsidian running THEN clear error SHALL be returned if not running
7. WHEN workspace switching fails THEN error SHALL include current workspace state
8. WHEN workspace operations are performed THEN they SHALL not lose unsaved changes

---

### Requirement 20: Plugin Integration Framework

**User Story:** As a developer, I want a framework for integrating with other Obsidian plugins so that the MCP server can leverage the broader plugin ecosystem.

#### Acceptance Criteria

1. WHEN list_installed_plugins is called THEN all installed plugins SHALL be returned with status
2. WHEN get_plugin_info is called THEN plugin metadata and capabilities SHALL be returned
3. WHEN execute_plugin_command is called THEN plugin command SHALL be executed via Obsidian API
4. WHEN plugin is not installed THEN clear error with installation instructions SHALL be returned
5. WHEN plugin command fails THEN error SHALL include plugin name and command
6. WHEN plugin integration is added THEN it SHALL follow consistent pattern
7. WHEN plugin requires user interaction THEN limitation SHALL be documented
8. WHEN plugin API changes THEN graceful degradation SHALL occur

---

## Tool Specifications

### Graph Operations

#### get_graph_data
```typescript
Input: {
  vault?: string;
  include_metadata?: boolean;
}

Output: {
  nodes: Array<{
    path: string;
    title: string;
    outgoing_links: number;
    incoming_links: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: 'wikilink' | 'embed';
  }>;
  stats: {
    total_nodes: number;
    total_edges: number;
    avg_degree: number;
  };
}
```

#### get_note_neighbors
```typescript
Input: {
  path: string;
  vault?: string;
  depth?: number; // default: 1
  direction?: 'outgoing' | 'incoming' | 'both'; // default: 'both'
}

Output: {
  neighbors: Array<{
    path: string;
    title: string;
    distance: number;
    link_type: 'outgoing' | 'incoming';
  }>;
}
```

#### analyze_note_centrality
```typescript
Input: {
  path: string;
  vault?: string;
}

Output: {
  degree_centrality: number;
  betweenness_centrality: number;
  closeness_centrality: number;
  pagerank: number;
  interpretation: string;
}
```

### Canvas Operations

#### read_canvas
```typescript
Input: {
  path: string; // .canvas file
  vault?: string;
}

Output: {
  nodes: Array<{
    id: string;
    type: 'text' | 'file' | 'link' | 'group';
    x: number;
    y: number;
    width: number;
    height: number;
    content?: string;
    file?: string;
    color?: string;
  }>;
  edges: Array<{
    id: string;
    fromNode: string;
    toNode: string;
    fromSide?: string;
    toSide?: string;
  }>;
}
```

#### create_canvas
```typescript
Input: {
  path: string;
  vault?: string;
  nodes: Array<NodeDefinition>;
  edges?: Array<EdgeDefinition>;
}

Output: {
  success: boolean;
  path: string;
}
```

### Template Operations

#### list_templates
```typescript
Input: {
  vault?: string;
  folder?: string; // default: 'templates'
}

Output: {
  templates: Array<{
    name: string;
    path: string;
    variables: string[];
  }>;
}
```

#### apply_template
```typescript
Input: {
  template: string; // template name or path
  target_path: string;
  variables?: Record<string, string>;
  vault?: string;
}

Output: {
  success: boolean;
  path: string;
  substitutions: Record<string, string>;
}
```

### Dataview Operations

#### execute_dataview_query
```typescript
Input: {
  query: string; // DQL or JavaScript
  query_type?: 'dql' | 'javascript'; // default: 'dql'
  vault?: string;
}

Output: {
  results: Array<Record<string, any>>;
  total: number;
  execution_time: number;
}
```

### Bulk Operations

#### bulk_update_frontmatter
```typescript
Input: {
  filter: {
    folder?: string;
    tag?: string;
    pattern?: string;
  };
  updates: Record<string, any>;
  merge?: boolean; // default: true
  vault?: string;
  dry_run?: boolean; // default: false
}

Output: {
  affected_notes: string[];
  success_count: number;
  failure_count: number;
  failures?: Array<{
    path: string;
    error: string;
  }>;
}
```

---

## Priority Classification

### High Priority (Implement First)
- **Requirement 11:** Graph Operations - High user value, leverages Obsidian's core strength
- **Requirement 13:** Template System - Common use case, relatively simple
- **Requirement 15:** Advanced Search - Extends existing search functionality

### Medium Priority
- **Requirement 12:** Canvas Operations - Growing feature, but smaller user base
- **Requirement 16:** Bulk Operations - Power user feature, high efficiency gain
- **Requirement 18:** Attachment Management - Utility feature, helps vault maintenance

### Low Priority (Nice to Have)
- **Requirement 14:** Dataview Query - Requires plugin, complex integration
- **Requirement 17:** Note History - Limited by Obsidian's capabilities
- **Requirement 19:** Workspace Management - Niche use case
- **Requirement 20:** Plugin Framework - Infrastructure for future extensions

---

## Implementation Considerations

### Testing Insightse

**Path Handling:**
- Extension handling can be inconsistent (`.md` required for some or others)
- Normalize paths early in the request pipeline


**Caching Behavior:**
- List operations may not immediately reflect fianges
- Consider implementing cache invalidation on wions
- Document caching behavior and refresh mechanisms

**Dual-Mode Complex
- Filesystem fallback works o testing
- Each tool needs testines
- Document which mode is used and why in responses

rations
- **Complexity:** Medium
- **Dependencies:** Nosystem)
- **Performance:** Need efficient graph algo vaults
- **Libraries:** Consider using graph librarie
- **Testing:** Graph building may cachingnsiderach; coapproly m-onh filesyster wit be sloweaphology) grs (e.g.,ge larms forrithlefin use ne (ca-High Graph Ope###lesystem mod API and fig in bothity tdds complexwell but aity:**ite operatr chlesystemtionald vs opquires re extension ihen `.md`ocument w- D

### Canvas Operations
- **Complexity:** Medium
- **Dependencies:** None (canvas files are JSON)
- **Performance:** JSON parsing, should be fast
- **Validation:** Need to validate canvas structure

### Template System
- **Complexity:** Low-Medium
- **Dependencies:** None
- **Performance:** Fast (simple string substitution)
- **Compatibility:** Keep simple, avoid Templater complexity
- **Path Handling:** Ensure consistent `.md` extension handling for template application

### Dataview Integration
- **Complexity:** High
- **Dependencies:** Dataview plugin required
- **Performance:** Depends on query complexity
- **Risk:** Plugin API may change

### Bulk Operations
- **Complexity:** Medium
- **Dependencies:** None
- **Performance:** Need progress reporting for large operations
- **Safety:** Require confirmation, support dry-run
- **Caching:** Bulk operations may require cache invalidation to ensure list operations reflect changes
- **Testing:** Test both API and filesystem modes for each bulk operation

---

## Success Criteria

Phase 4 will be considered complete when:

1. ✅ At least 5 high-priority tools implemented
2. ✅ All tools have comprehensive tests
3. ✅ Documentation updated with new tools
4. ✅ Performance targets met (graph operations <10s for 1000 notes)
5. ✅ MCP clients can use new tools successfully
6. ✅ Error handling consistent with existing tools

---

## Estimated Effort

| Tool Category | Effort | Priority |
|---------------|--------|----------|
| Graph Operations (5 tools) | 24-32h | High |
| Template System (3 tools) | 12-16h | High |
| Advanced Search (4 tools) | 16-20h | High |
| Canvas Operations (5 tools) | 16-20h | Medium |
| Bulk Operations (6 tools) | 20-28h | Medium |
| Attachment Management (4 tools) | 12-16h | Medium |
| Dataview Integration (2 tools) | 16-24h | Low |
| Note History (4 tools) | 12-16h | Low |
| Workspace Management (5 tools) | 12-16h | Low |
| Plugin Framework (4 tools) | 20-28h | Low |

**Total Estimated Effort:** 160-216 hours (4-6 weeks)

**Recommended MVP (High Priority Only):** 52-68 hours (2-3 weeks)

---

## Real-World Testing Insights

### Platform Testing Status

| Platform | Status | Notes |
|----------|--------|-------|
| Windows (Kiro) | ✅ Tested | All core tools working |
| Windows (Cursor) | ✅ Tested | All core tools working |
| WSL (Claude Code) | 📋 Pending | Next testing target |

### Key Findings from Testing

**1. Path Handling Inconsistencies**
- Creating notes works without `.md` extension
- Reading/moving notes requires `.md` extension
- **Recommendation:** Implement path normalization layer that handles extension automatically

**2. Caching Behavior**
- `list_notes` may not immediately reflect `move_note` operations
- Suggests caching or indexing that isn't invalidated on write
- **Recommendation:** Implement cache invalidation strategy or document refresh requirements

**3. Dual-Mode Operation**
- Filesystem fallback works reliably when API unavailable
- Warning messages clearly indicate which mode was used
- **Recommendation:** Continue this pattern for Phase 4 tools

**4. Tool Response Quality**
- Move operation includes helpful warning about wikilinks not updating
- Error messages are clear and actionable
- **Recommendation:** Maintain this UX quality for Phase 4 tools

### Testing Recommendations for Phase 4

**For Each New Tool:**
1. Test with and without `.md` extension in paths
2. Test in both API mode and filesystem fallback mode
3. Verify caching behavior doesn't cause stale data
4. Test with vaults of varying sizes (100, 500, 1000 notes)
5. Validate error messages are clear and actionable
6. Test on Windows, WSL Linux FS, and WSL Windows FS

**Performance Testing:**
- Establish baseline performance with current tools
- Ensure Phase 4 tools meet or exceed baseline
- Test graph operations with 1000+ note vaults
- Monitor memory usage during bulk operations

**Integration Testing:**
- Test tool combinations (e.g., create from template → add to graph)
- Verify tools work together without conflicts
- Test concurrent operations

---

### Document Metadata

| Field | Value |
|-------|-------|
| Document Version | 1.1 |
| Date | January 2025 |
| Status | Updated with Testing Insights |
| Next Step | Review and prioritize which tools to implement |
| Testing Status | Windows platforms validated, WSL pending |
