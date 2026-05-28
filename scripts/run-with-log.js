#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const separatorIndex = process.argv.indexOf('--');
const command = separatorIndex === -1 ? [] : process.argv.slice(separatorIndex + 1);

if (command.length === 0) {
  console.error('Usage: node scripts/run-with-log.js -- <command> [args...]');
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, '..');
const runtimeDir = path.join(repoRoot, 'runtime');
const logPath = path.join(runtimeDir, 'last-run.log');

fs.mkdirSync(runtimeDir, { recursive: true });
fs.writeFileSync(
  logPath,
  [
    `# Pundit last-run log`,
    `started_at=${new Date().toISOString()}`,
    `cwd=${repoRoot}`,
    `command=${command.join(' ')}`,
    '',
  ].join('\n')
);

const logStream = fs.createWriteStream(logPath, { flags: 'a' });

function write(chunk, target) {
  target.write(chunk);
  logStream.write(chunk);
}

const childEnv = {
  ...process.env,
};

if (!process.env.NO_COLOR && !process.env.FORCE_COLOR) {
  childEnv.FORCE_COLOR = '1';
}

const child = spawn(command[0], command.slice(1), {
  cwd: repoRoot,
  env: childEnv,
  stdio: ['inherit', 'pipe', 'pipe'],
});

child.stdout.on('data', (chunk) => write(chunk, process.stdout));
child.stderr.on('data', (chunk) => write(chunk, process.stderr));

child.on('error', (error) => {
  const message = `\nrun-with-log error: ${error.message}\n`;
  write(message, process.stderr);
  logStream.end(() => process.exit(1));
});

child.on('close', (code, signal) => {
  const status = signal ? `signal=${signal}` : `exit_code=${code}`;
  logStream.end(`\nfinished_at=${new Date().toISOString()}\n${status}\n`, () => {
    process.exit(code ?? 1);
  });
});
