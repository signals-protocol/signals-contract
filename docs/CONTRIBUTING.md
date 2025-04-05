# RangeBet Contribution Guide

Thank you for your interest in contributing to the RangeBet project! This document explains how to contribute to the project.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Environment Setup](#development-environment-setup)
3. [Coding Style](#coding-style)
4. [Tests](#tests)
5. [Submitting Pull Requests](#submitting-pull-requests)
6. [Reporting Issues](#reporting-issues)
7. [Documentation](#documentation)

## Getting Started

### Prerequisites

To participate in RangeBet development, you need the following tools:

- [Node.js](https://nodejs.org/) (v16 or higher)
- [Yarn](https://yarnpkg.com/) (v1.22 or higher)
- [Git](https://git-scm.com/)
- [Hardhat](https://hardhat.org/)

### Repository Clone

```bash
git clone https://github.com/yourusername/rangebet.git
cd rangebet
yarn install
```

## Development Environment Setup

### Environment Variables

Create an `.env` file in the project root and set the following variables:

```
PRIVATE_KEY=your_private_key
INFURA_PROJECT_ID=your_infura_project_id
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Build and Test

```bash
# Compile contracts
yarn compile

# Run tests
yarn test

# Check code coverage
yarn coverage
```

## Coding Style

The RangeBet project follows these guidelines to maintain consistent code style:

### Solidity

- Follow the [Solidity Style Guide](https://docs.soliditylang.org/en/v0.8.17/style-guide.html).
- Indentation: 4 spaces
- Maximum line length: 100 characters
- Function and variable names: camelCase
- Constants: UPPER_CASE
- Contract and struct names: PascalCase
- Add NatSpec comments to all functions and state variables.

Example:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Example Contract
/// @notice This contract is used for example purposes
/// @dev Developer notes
contract ExampleContract {
    /// @notice Constant description
    uint256 public constant MAX_VALUE = 1000;

    /// @notice State variable description
    uint256 public totalAmount;

    /// @notice Function description
    /// @param _value Value description
    /// @return Return value description
    function exampleFunction(uint256 _value) external returns (bool) {
        require(_value <= MAX_VALUE, "Value too high");
        totalAmount += _value;
        return true;
    }
}
```

### TypeScript/JavaScript

- Indentation: 2 spaces
- Semicolons: Use them
- Quotes: Single quotes (`'`)
- Variable declarations: Use `const` or `let` (do not use `var`)
- Function and variable names: camelCase
- Class and interface names: PascalCase
- Add JSDoc comments to all functions and classes.

Example:

```typescript
/**
 * User interface
 */
interface User {
  id: string;
  name: string;
}

/**
 * Fetches user information
 * @param userId User ID
 * @returns User object
 */
async function getUser(userId: string): Promise<User> {
  // Implementation
  return {
    id: userId,
    name: "Test User",
  };
}
```

## Tests

### Writing Tests

All new features and bug fixes should include test cases. RangeBet uses [Hardhat](https://hardhat.org/) and [Chai](https://www.chaijs.com/).

Tests should be written in the `test/` directory and follow this naming convention:

- `UnitTest.test.ts`: Unit tests
- `Integration.test.ts`: Integration tests

### Test Coverage

Check test coverage after feature changes:

```bash
yarn coverage
```

Coverage targets:

- Line coverage: minimum 85%
- Function coverage: minimum 90%
- Branch coverage: minimum 80%

## Submitting Pull Requests

### Branch Strategy

- `main`: Stable production code
- `develop`: Development branch
- Feature branches: `feature/feature-name`
- Bug fix branches: `fix/bug-name`

### Pull Request Process

1. Create a new branch from the latest `develop` branch.
2. Implement code changes and write tests.
3. Make sure all tests pass.
4. Commit your changes and write meaningful commit messages.
5. Create a pull request to the `develop` branch.
6. Fill out the pull request template.

### Commit Message Convention

Commit messages should follow this format:

```
<type>: <title>

<body>

<footer>
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting
- `refactor`: Code refactoring
- `test`: Adding/modifying tests
- `chore`: Build process/tool changes

Example:

```
feat: Add reward distribution mechanism after market closure

Adds a new function to RangeBetManager that distributes rewards to
token holders of the winning bin. Rewards are distributed proportionally
based on token holdings.

Closes #123
```

## Reporting Issues

### Bug Reports

If you find a bug, please report it in GitHub Issues. Include the following information:

1. Bug description
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Environment information (Node.js version, Hardhat version, etc.)
6. Error logs if available

### Feature Requests

To suggest a new feature, create a GitHub Issue. Include the following information:

1. Feature description
2. Use cases and purpose
3. Ideas for possible implementation

## Documentation

### Code Comments

All public functions and contracts should have NatSpec/JSDoc comments:

- `@title`: Contract/file title
- `@notice`: Explains what the function/contract does
- `@dev`: Additional information for developers
- `@param`: Parameter description
- `@return`: Return value description

### API Documentation

When changing the API, update the corresponding markdown file in the `/docs/api/` directory.

### Architecture Documentation

When changing the architecture, update the `/docs/ARCHITECTURE.md` file.

## Security Vulnerabilities

If you discover a security vulnerability, do not report it publicly in GitHub Issues. Instead, please contact us directly at: security@example.com

## License

The RangeBet project is provided under the MIT license. By contributing code, you agree to the terms of this license.

## Questions and Support

If you have questions or need help, please create an issue on GitHub or join our Discord channel.

Thank you for contributing to the RangeBet project!
