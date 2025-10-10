# PowerShell script to set up Git repository
# Run this from the obsidian-mcp-server directory

Write-Host "🚀 Obsidian MCP Server - Git Repository Setup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Install Husky
Write-Host "📦 Step 1: Installing Husky for pre-commit hooks..." -ForegroundColor Yellow
npm install --save-dev husky
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install Husky" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Husky installed successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Initialize Husky
Write-Host "🔧 Step 2: Initializing Husky..." -ForegroundColor Yellow
npx husky init
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to initialize Husky" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Husky initialized successfully" -ForegroundColor Green
Write-Host ""

# Step 3: Initialize Git
Write-Host "📂 Step 3: Initializing Git repository..." -ForegroundColor Yellow
git init
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to initialize Git" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Git repository initialized" -ForegroundColor Green
Write-Host ""

# Step 4: Check status
Write-Host "📋 Step 4: Checking Git status..." -ForegroundColor Yellow
git status
Write-Host ""

# Step 5: Stage all files
Write-Host "➕ Step 5: Staging all files..." -ForegroundColor Yellow
git add .
Write-Host "✅ All files staged" -ForegroundColor Green
Write-Host ""

# Step 6: Create develop branch and initial commit
Write-Host "🌿 Step 6: Creating 'develop' branch and initial commit..." -ForegroundColor Yellow
git checkout -b develop

$commitMessage = @"
feat: initial commit with full implementation

- Complete CRUD operations for Obsidian vaults
- 13 MCP tools with comprehensive functionality
- Multi-tier rate limiting system
- Real-time file watching
- Cross-platform support (Windows/macOS/Linux/WSL)
- Comprehensive test suite (80%+ coverage)
- CI/CD workflows with GitHub Actions
- Production-ready error handling and logging
"@

git commit -m $commitMessage
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create initial commit" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Initial commit created on 'develop' branch" -ForegroundColor Green
Write-Host ""

# Step 7: Add remote
Write-Host "🔗 Step 7: Adding GitHub remote..." -ForegroundColor Yellow
git remote add origin https://github.com/Beaulewis1977/obsidian-mcp.git
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Remote already exists or failed to add" -ForegroundColor Yellow
}
git remote -v
Write-Host "✅ Remote configured" -ForegroundColor Green
Write-Host ""

# Step 8: Push develop branch
Write-Host "🚀 Step 8: Pushing 'develop' branch to remote..." -ForegroundColor Yellow
git push -u origin develop
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to push 'develop' branch" -ForegroundColor Red
    Write-Host "   You may need to authenticate with GitHub" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ 'develop' branch pushed successfully" -ForegroundColor Green
Write-Host ""

# Step 9: Create and push main branch
Write-Host "🌿 Step 9: Creating and pushing 'main' branch..." -ForegroundColor Yellow
git checkout -b main
git push -u origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to push 'main' branch" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 'main' branch created and pushed" -ForegroundColor Green
Write-Host ""

# Step 10: Switch back to develop
Write-Host "🔄 Step 10: Switching back to 'develop' branch..." -ForegroundColor Yellow
git checkout develop
Write-Host "✅ Switched to 'develop' branch" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "✅ Repository setup complete!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Go to https://github.com/Beaulewis1977/obsidian-mcp/settings/branches" -ForegroundColor White
Write-Host "   2. Set 'develop' as the default branch" -ForegroundColor White
Write-Host "   3. Add branch protection rules for 'main' branch" -ForegroundColor White
Write-Host "   4. Install CodeRabbit: https://github.com/apps/coderabbitai" -ForegroundColor White
Write-Host "   5. See SETUP_GUIDE.md for detailed instructions" -ForegroundColor White
Write-Host ""
Write-Host "🎉 Happy coding!" -ForegroundColor Cyan

