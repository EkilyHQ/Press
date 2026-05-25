#!/usr/bin/env node
import {
  getPressSystemPackagePaths,
  getPressSystemReleasePlanPaths
} from '../assets/js/press-system-surface.mjs';

const command = process.argv[2] || '';

function printLines(lines) {
  lines.forEach((line) => console.log(line));
}

if (command === 'package-paths') {
  printLines(getPressSystemPackagePaths());
} else if (command === 'release-plan-paths') {
  printLines(getPressSystemReleasePlanPaths());
} else if (command === 'pages-release-plan-paths') {
  printLines(getPressSystemReleasePlanPaths({ includePagesMaterializer: true }));
} else {
  console.error('usage: node scripts/print-press-system-surface.mjs <package-paths|release-plan-paths|pages-release-plan-paths>');
  process.exit(2);
}
