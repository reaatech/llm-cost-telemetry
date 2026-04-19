# Contributing to llm-cost-telemetry

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

### Prerequisites

- Node.js 22+
- npm or pnpm
- Git

### Setup

```bash
# Fork and clone the repository
git clone https://github.com/reaatech/llm-cost-telemetry.git
cd llm-cost-telemetry

# Install dependencies
npm install

# Set up git hooks
npm run prepare
```

## Development Workflow

### Branch Naming

- `feat/` — New features
- `fix/` — Bug fixes
- `docs/` — Documentation changes
- `refactor/` — Code refactoring
- `test/` — Test additions or changes

### Making Changes

1. Create a new branch from `main`
2. Make your changes
3. Ensure all tests pass: `npm test`
4. Ensure linting passes: `npm run lint`
5. Ensure formatting is correct: `npm run format`
6. Commit your changes with a descriptive message

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Anthropic prompt caching support

- Implement cache-aware cost calculation
- Add cache_read_tokens and cache_creation_tokens fields
- Update pricing for Claude models
```

## Code Standards

### TypeScript

- Use strict mode (enabled in tsconfig.json)
- No `any` types — use proper typing
- Export types for public APIs
- Use interfaces for object shapes

### Testing

- Write tests for all new features
- Maintain 80%+ code coverage
- Use descriptive test names
- Test both success and error paths

```typescript
describe('calculateCost', () => {
  it('should calculate cost for OpenAI GPT-4', () => {
    const { costUsd } = calculateCost({
      provider: 'openai',
      model: 'gpt-4',
      inputTokens: 1000,
      outputTokens: 500
    });

    expect(costUsd).toBeCloseTo(0.06, 4);
  });
});
```

### Code Style

- Single quotes for strings
- Trailing commas in objects and arrays
- 2-space indentation
- 100 character line width
- Semicolons required

Run `npm run format` to auto-format code.

## Pull Request Process

1. Ensure all CI checks pass
2. Update documentation if needed
3. Add tests for new functionality
4. Request review from maintainers
5. Address review feedback

## Types of Contributions

### Bug Fixes

- Describe the bug and how to reproduce it
- Include a test case that fails before the fix
- Explain the fix

### New Features

- Open an issue first to discuss the feature
- Include comprehensive tests
- Update documentation
- Add examples

### Documentation

- Fix typos or clarify confusing sections
- Add missing examples
- Improve API documentation

## Questions?

Open an issue for questions or discussions about contributions.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
