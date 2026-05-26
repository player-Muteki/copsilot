import { spawnSync } from 'node:child_process';

const mode = process.env.npm_config_check === 'true' ? '--check' : '--write';
const result = spawnSync('prettier', [mode, 'src'], { stdio: 'inherit', shell: process.platform === 'win32' });

process.exit(result.status ?? 1);
