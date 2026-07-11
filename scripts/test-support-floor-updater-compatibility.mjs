import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

execFileSync(process.execPath, [path.join(root, 'scripts/test-recovery-updater-compatibility.mjs')], {
  cwd: root,
  env: {
    ...process.env,
    PRESS_UPDATER_COMPAT_TARGET_VERSION: '3.4.138',
    PRESS_UPDATER_COMPAT_EXPECTED_RANGE: '>=3.4.63 <3.4.138',
    PRESS_UPDATER_COMPAT_SOURCE_TAGS: 'v3.4.63',
    PRESS_UPDATER_COMPAT_LABEL: 'support-floor updater compatibility'
  },
  stdio: 'inherit'
});
