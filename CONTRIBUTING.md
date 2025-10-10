# Contributing to Obsidian MCP Server

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites
- Node.js 18+ 
- npm or pnpm
- Git

### Getting Started

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/Beaulewis1977/obsidian-mcp.git
   cd obsidian-mcp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

## Branch Strategy

We use a **Git Flow** branching strategy:

- **`main`** - Production-ready code (protected)
- **`develop`** - Integration branch for development (default branch)
- **`feature/*`** - Feature branches (created from `develop`)
- **`bugfix/*`** - Bug fix branches (created from `develop`)
- **`hotfix/*`** - Urgent fixes (created from `main`)

### Workflow

1. **Create a feature branch from `develop`:**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes and commit:**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

3. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Create a Pull Request to `develop`:**
   - Base: `develop`
   - Compare: `feature/your-feature-name`
   - CodeRabbit will automatically review your PR

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

**Examples:**
```bash
feat: add rate limiting to API endpoints
fix: resolve path validation issue on Windows
docs: update API reference for new tools
test: add integration tests for file watching
```

## 🤖 AI Agent Development Rules

**⚠️ CRITICAL: Agents must follow strict permission protocols**

See [agents.md](agents.md) for complete AI agent development rules and workflow requirements.

**Key Rules:**
- 🤖 **NEVER commit without explicit permission**
- 🤖 **Always ask before any git operation**
- 🤖 **Follow complete development workflow**
- 🤖 **Test thoroughly before asking to commit**

## Pre-commit Hooks

Pre-commit hooks automatically run:
- ✅ TypeScript type checking (`npm run lint`)
- ✅ Test suite (`npm run test`)
- ✅ Build verification (`npm run build`)

If any check fails, the commit will be blocked. Fix the issues and try again.

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- handlers.integration.test.ts
```

### Writing Tests
- Place test files in `src/**/__tests__/` directories
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Aim for 80%+ code coverage

**Example:**
```typescript
describe('handleReadNote', () => {
  it('should successfully read an existing note', async () => {
    // Arrange
    const mockNote = { /* ... */ };
    mockReadNote.mockResolvedValue(mockNote);
    
    // Act
    const result = await handleReadNote(mockConfig, { path: 'test' });
    
    // Assert
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Test Note');
  });
});
```

## Code Style

- **TypeScript:** Use strict mode
- **Formatting:** Run `npm run lint` to check types
- **Imports:** Use ES modules (`.js` extensions in imports)
- **Naming:**
  - camelCase for variables and functions
  - PascalCase for classes and types
  - UPPER_CASE for constants

## Pull Request Process

1. **Ensure all tests pass:**
   ```bash
   npm test -- --run
   npm run lint
   npm run build
   ```

2. **Update documentation** if needed:
   - Update README.md
   - Update API_REFERENCE.md
   - Add to CHANGELOG.md

3. **Create PR against `develop` branch**

4. **Wait for CodeRabbit review:**
   - CodeRabbit will automatically review your code
   - Address any feedback or concerns

5. **Wait for maintainer review:**
   - A maintainer will review and merge your PR
   - PRs require at least 1 approval

6. **After merge:**
   - Delete your feature branch
   - Pull latest `develop` for next feature

## CI/CD Pipeline

All PRs trigger automated checks:
- ✅ **Lint & Type Check** - TypeScript validation
- ✅ **Test Suite** - All tests must pass
- ✅ **Build** - Project must compile
- ✅ **Cross-platform** - Tests on Windows, macOS, Linux
- ✅ **Node versions** - Tests on Node 18, 20, 22

## Release Process

Releases are automated when tags are pushed:

1. Merge `develop` → `main` via PR
2. Create and push a version tag:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```
3. GitHub Actions will:
   - Run all tests
   - Build the project
   - Create GitHub Release
   - (Optional) Publish to npm

## Questions?

- 💬 Open a [Discussion](https://github.com/Beaulewis1977/obsidian-mcp/discussions)
- 🐛 Report bugs via [Issues](https://github.com/Beaulewis1977/obsidian-mcp/issues)
- 📧 Contact: [Your email]

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

