# GitHub Repository Setup Guide

Complete guide for setting up the Obsidian MCP Server repository on GitHub with CI/CD, branch protection, and CodeRabbit integration.

## 📋 Prerequisites

- Git installed locally
- GitHub account
- Node.js 18+ installed
- npm installed

---

## 🚀 Step-by-Step Setup

### **Phase 1: Install Husky for Pre-commit Hooks**

```bash
cd D:\dev\obsidian-mcp-2\code_artifacts\obsidian-mcp-server

# Install husky
npm install --save-dev husky

# Initialize husky
npx husky init

# Make pre-commit hook executable (if on Unix/Mac)
chmod +x .husky/pre-commit
```

---

### **Phase 2: Initialize Git Repository**

```bash
# Initialize git
git init

# Check status
git status

# Stage all files
git add .

# Initial commit to develop branch
git checkout -b develop
git commit -m "feat: initial commit with full implementation

- Complete CRUD operations for Obsidian vaults
- 13 MCP tools with comprehensive functionality
- Multi-tier rate limiting system
- Real-time file watching
- Cross-platform support (Windows/macOS/Linux/WSL)
- Comprehensive test suite (80%+ coverage)
- CI/CD workflows with GitHub Actions
- Production-ready error handling and logging"
```

---

### **Phase 3: Connect to GitHub Remote**

```bash
# Add remote repository
git remote add origin https://github.com/Beaulewis1977/obsidian-mcp.git

# Verify remote
git remote -v

# Push develop branch
git push -u origin develop
```

---

### **Phase 4: Create Main Branch**

```bash
# Create main branch from develop
git checkout -b main

# Push main branch
git push -u origin main

# Switch back to develop
git checkout develop
```

---

### **Phase 5: Configure GitHub Repository**

Go to your GitHub repository: https://github.com/Beaulewis1977/obsidian-mcp

#### **5.1 Set Default Branch**

1. Go to **Settings** → **Branches**
2. Change default branch to **`develop`**
3. Click **Update**

#### **5.2 Enable Branch Protection for `main`**

1. Go to **Settings** → **Branches** → **Add branch protection rule**
2. Branch name pattern: `main`
3. Enable:
   - ✅ **Require a pull request before merging**
     - Require approvals: 1
     - Dismiss stale reviews when new commits are pushed
   - ✅ **Require status checks to pass before merging**
     - Add status checks:
       - `Lint & Type Check`
       - `Test Suite`
       - `Build`
   - ✅ **Require conversation resolution before merging**
   - ✅ **Do not allow bypassing the above settings**
4. Click **Create**

#### **5.3 Enable Branch Protection for `develop`** (Optional but recommended)

1. Add branch protection rule
2. Branch name pattern: `develop`
3. Enable:
   - ✅ **Require status checks to pass before merging**
     - Add status checks:
       - `Lint & Type Check`
       - `Test Suite`
       - `Build`
4. Click **Create**

---

### **Phase 6: Configure CodeRabbit**

#### **6.1 Install CodeRabbit GitHub App**

1. Go to: https://github.com/apps/coderabbitai
2. Click **Install**
3. Select your repository: `Beaulewis1977/obsidian-mcp`
4. Click **Install & Authorize**

#### **6.2 Configure CodeRabbit Settings**

1. Go to your repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add secret:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** `your-openai-api-key`
4. Click **Add secret**

#### **6.3 Create `.coderabbit.yaml` Configuration** (Optional)

Create a file in the repository root:

```yaml
# .coderabbit.yaml
reviews:
  profile: "assertive"
  request_changes_workflow: true
  high_level_summary: true
  poem: false
  review_status: true
  
chat:
  auto_reply: true
```

---

### **Phase 7: Set Up Secrets for CI/CD**

Go to **Settings** → **Secrets and variables** → **Actions**

Add the following secrets (if needed):

1. **`CODECOV_TOKEN`** (optional - for code coverage reports)
   - Get from: https://codecov.io/
   
2. **`NPM_TOKEN`** (optional - for npm publishing)
   - Get from: https://www.npmjs.com/settings/[username]/tokens

---

### **Phase 8: Test the Setup**

#### **8.1 Create a Test Branch**

```bash
# Switch to develop
git checkout develop

# Create feature branch
git checkout -b feature/test-ci-cd

# Make a small change (e.g., update README)
echo "\n## CI/CD Status" >> README.md

# Commit and push
git add README.md
git commit -m "test: verify CI/CD pipeline"
git push -u origin feature/test-ci-cd
```

#### **8.2 Create Pull Request**

1. Go to GitHub repository
2. Click **Pull requests** → **New pull request**
3. Base: `develop`, Compare: `feature/test-ci-cd`
4. Click **Create pull request**
5. Verify:
   - ✅ CI checks are running
   - ✅ CodeRabbit reviews the code
   - ✅ All checks pass

---

## 🔄 Daily Workflow

### **Creating a Feature**

```bash
# 1. Start from develop
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/your-feature-name

# 3. Make changes and commit
git add .
git commit -m "feat: add your feature"

# 4. Push to remote
git push -u origin feature/your-feature-name

# 5. Create PR on GitHub to develop
```

### **Pre-commit Checks**

Before each commit, the following automatically run:
- ✅ TypeScript type checking
- ✅ Full test suite
- ✅ Build verification

If any fail, the commit is blocked.

### **Releasing to Production**

```bash
# 1. Create PR: develop → main
# 2. Wait for approval and CI checks
# 3. Merge PR

# 4. Create release tag
git checkout main
git pull origin main
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# 5. GitHub Actions will:
#    - Run all tests
#    - Build the project
#    - Create GitHub Release
#    - (Optional) Publish to npm
```

---

## 📊 CI/CD Workflows

### **Triggered on Every Push/PR:**

1. **Lint & Type Check** (`ci.yml`)
   - Runs TypeScript compiler
   - Checks for type errors

2. **Test Suite** (`ci.yml`)
   - Runs all vitest tests
   - Generates coverage report
   - Uploads to Codecov

3. **Build** (`ci.yml`)
   - Compiles TypeScript
   - Verifies dist output

4. **Cross-platform Matrix** (`ci.yml`)
   - Tests on: Ubuntu, Windows, macOS
   - Node versions: 18, 20, 22

5. **CodeRabbit Review** (`coderabbit.yml`)
   - AI-powered code review
   - Suggests improvements
   - Catches potential bugs

### **Triggered on Tag Push:**

1. **Release** (`release.yml`)
   - Creates GitHub Release
   - Attaches build artifacts
   - (Optional) Publishes to npm

---

## 🛡️ Branch Protection Summary

### **`main` Branch (Protected)**
- ❌ No direct pushes
- ✅ Requires PR approval
- ✅ Requires passing CI checks
- ✅ Requires conversation resolution

### **`develop` Branch (Default)**
- ✅ Requires passing CI checks (recommended)
- ✅ Allow direct pushes (optional)

### **Feature Branches**
- ✅ PR to `develop`
- ✅ CodeRabbit reviews
- ✅ CI checks must pass

---

## 📝 Quick Reference

### **Common Commands**

```bash
# Check status
git status

# Create feature branch
git checkout -b feature/name

# Commit with conventional commits
git commit -m "feat: description"
git commit -m "fix: description"
git commit -m "docs: description"

# Push and create PR
git push -u origin feature/name

# Update from develop
git checkout develop
git pull origin develop

# Merge develop into feature
git checkout feature/name
git merge develop
```

### **Conventional Commit Types**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting
- `refactor:` - Code restructuring
- `test:` - Adding tests
- `chore:` - Maintenance

---

## ✅ Checklist

Before considering setup complete:

- [ ] Git initialized locally
- [ ] Husky installed and configured
- [ ] Remote repository connected
- [ ] `develop` branch pushed
- [ ] `main` branch created and pushed
- [ ] Default branch set to `develop`
- [ ] Branch protection rules configured
- [ ] CodeRabbit installed and configured
- [ ] Secrets added (if needed)
- [ ] Test PR created and CI passed
- [ ] Pre-commit hooks working

---

## 🆘 Troubleshooting

### **Pre-commit hooks not running?**
```bash
npx husky install
chmod +x .husky/pre-commit  # Unix/Mac only
```

### **CI checks failing?**
- Check GitHub Actions logs
- Run locally: `npm test -- --run && npm run lint`

### **Can't push to protected branch?**
- Create a PR instead
- Never push directly to `main`

### **CodeRabbit not reviewing?**
- Check if installed: https://github.com/apps/coderabbitai
- Verify webhook is active in repo settings

---

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [CodeRabbit Documentation](https://docs.coderabbit.ai/)
- [Husky Documentation](https://typicode.github.io/husky/)
- [Git Flow Guide](https://nvie.com/posts/a-successful-git-branching-model/)

