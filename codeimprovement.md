---
name: code-improvement-specialist
description: Refactor code to improve readability, simplify complex logic, and ensure adherence to best practices without changing external behavior.
---

# Code Improvement Specialist

## Overview
This skill guides the agent through a professional-grade refactoring cycle. Use this when the user asks to "clean up," "refactor," "simplify," or "review" specific files.

## Workflow

### 1. Analysis (Think First)
Before making any changes, analyze the target code for the following "code smells":
- **Complexity**: Methods longer than 20 lines or with high nesting depth.
- **Redundancy**: Duplicate logic that could be extracted into a shared utility.
- **Responsibility**: Classes or functions doing too many unrelated things (violating Single Responsibility).
- **Modernity**: Outdated patterns that can be replaced with modern language features (e.g., using `.map()` instead of a `for` loop).

### 2. Safeguarding
- **Check for Tests**: Identify existing unit tests for the file.
- **Run Baseline**: If possible, run existing tests to ensure they pass before you start.
- **Incremental Changes**: Make one logical improvement at a time rather than a single massive rewrite.

### 3. Execution (The Refactor)
Apply these techniques in order of impact:
- **Simplify Methods**: Break down long methods into smaller, focused ones.
- **Refactoring by Abstraction**: Extract shared logic into interfaces or abstract classes.
- **Extract to Constants**: Move magic numbers or strings into named constants for clarity.
- **Improve Naming**: Rename variables and functions to be more descriptive of their intent.

### 4. Verification
After every change:
- **Verify Logic**: Ensure the external behavior remains identical.
- **Run Linter**: Use `npm run lint` or equivalent to ensure no style regressions.
- **Run Tests**: Ensure all existing tests remain "green".

## Example Improvement
**Before:**
```javascript
function process(items) {
  let r = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].active == true) {
      r.push(items[i].val * 1.1);
    }
  }
  return r;
}
```

**After:**
```javascript
const TAX_RATE = 1.1;

/**
 * Calculates adjusted values for active items.
 */
function getActiveAdjustedValues(items) {
  return items
    .filter(item => item.active)
    .map(item => item.val * TAX_RATE);
}
```

## Guardrails
- **DO NOT** delete comments that explain complex business logic.
- **DO NOT** introduce new libraries or dependencies without explicit permission.
- **ALWAYS** prioritize readability over "clever" one-line solutions.