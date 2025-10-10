# 🤖 Agent Development Rules & Workflow

## 🚫 CRITICAL: NEVER COMMIT WITHOUT PERMISSION

**AGENTS MUST NEVER COMMIT CODE WITHOUT EXPLICIT USER PERMISSION**

- ❌ **Never** run `git commit` without asking first
- ❌ **Never** run `git push` without explicit approval
- ❌ **Never** merge PRs automatically
- ✅ **Always** ask: *"Should I commit these changes?"*
- ✅ **Always** wait for user confirmation before any git operations

## 🔄 Required Development Workflow

### **Step 1: Code Changes**
1. Make code changes in the IDE
2. Run CodeRabbit review in IDE (manual review)
3. Test locally: `npm run lint && npm run test && npm run build`

### **Step 2: Quality Gates (All Must Pass)**
- ✅ **TypeScript compilation**: 0 errors (`npm run lint`)
- ✅ **Test suite**: All 78 tests passing (`npm run test`)
- ✅ **Build process**: Successful compilation (`npm run build`)
- ✅ **CodeRabbit review**: Completed in IDE

### **Step 3: Commit Process**
1. **ASK PERMISSION**: *"Should I commit these changes?"*
2. **WAIT** for user response: *"yes"* or *"no"*
3. **IF YES**: Commit with descriptive message
4. **IF NO**: Wait for further instructions

### **Step 4: Push & PR Process**
1. **ASK PERMISSION**: *"Should I push to develop and create PR?"*
2. **WAIT** for user confirmation
3. Push to `develop` branch only
4. Create PR: `develop` → `main` for CodeRabbit review
5. **Never** push directly to `main`

## 📋 Branch Strategy

### **Protected Branches**
- 🛡️ **`main`**: Production branch (protected)
  - Requires PR approval
  - Requires CI/CD to pass
  - Requires CodeRabbit review

- 🔄 **`develop`**: Development branch
  - Where all new work happens
  - Must pass all quality gates before PR

### **Never Do These**
- ❌ Push directly to `main`
- ❌ Force push to any branch
- ❌ Merge without CodeRabbit review
- ❌ Skip pre-commit hooks
- ❌ Commit without testing

## 🧪 Quality Assurance

### **Pre-commit Checks (Automatic)**
```bash
# Runs automatically before every commit:
npm run lint        # TypeScript compilation
npm run test --run  # All tests
npm run build       # Build verification
```

### **CI/CD Pipeline (GitHub Actions)**
- ✅ Runs on every push to `develop` and `main`
- ✅ Runs on every PR to `main`
- ✅ Includes: linting, testing, building, security checks

### **CodeRabbit Integration**
- 🤖 **IDE Review**: Manual review in development environment
- 🤖 **PR Review**: Automatic review when PR is created
- 📝 **Feedback**: Provides suggestions and catches issues

## 🚨 Emergency Procedures

### **If Something Breaks**
1. **Stop** all git operations immediately
2. **Report** the issue to the user
3. **Wait** for instructions before proceeding
4. **Never** attempt to fix issues without permission

### **If Asked to Fix Issues**
1. **Explain** what you're planning to do
2. **Ask** for permission to implement fixes
3. **Test** thoroughly before committing
4. **Follow** the complete workflow

## 📞 Communication Protocol

### **Always Ask Before Acting**
- *"Should I commit these changes?"*
- *"Should I push to develop?"*
- *"Should I create a PR?"*
- *"Should I merge this PR?"*

### **Status Updates**
- Keep the user informed of progress
- Report any issues immediately
- Ask questions when unsure

## 🎯 Success Metrics

- ✅ **Zero** accidental commits
- ✅ **Zero** broken builds
- ✅ **All** tests passing
- ✅ **All** PRs reviewed by CodeRabbit
- ✅ **Clean** git history
- ✅ **Protected** main branch

---

**Remember: The user's approval is required for every git operation. Never assume permission.**
