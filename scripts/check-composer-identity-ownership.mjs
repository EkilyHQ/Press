#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateComposerIdentityOwnership } from './composer-identity-ownership-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = validateComposerIdentityOwnership(root);

console.log(
  `Composer identity ownership passed: ${result.ownerCount} owners, ${result.ownerStatements} scenario statements, ${result.ownerAssertions + result.policy.support.assertions} assertions.`
);
