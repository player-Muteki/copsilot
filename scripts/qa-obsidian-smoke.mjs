import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const root = process.cwd();
const qaVault = path.join(root, 'copsidian-qa-vault');
const pluginDir = path.join(qaVault, '.obsidian', 'plugins', 'copsidian');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    ...options,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed${output ? `:\n${output}` : ''}`);
  }
  return output;
}

function obsidian(args) {
  return run('obsidian', args);
}

function evalObsidian(code) {
  return obsidian(['eval', `code=${code.replace(/\s+/g, ' ')}`]);
}

function optionalObsidian(args) {
  const result = spawnSync('obsidian', args, {
    cwd: root,
    encoding: 'utf8',
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
  };
}

if (!existsSync(qaVault)) {
  throw new Error(`QA vault not found: ${qaVault}`);
}

mkdirSync(pluginDir, { recursive: true });
for (const file of ['main.js', 'manifest.json', 'styles.css']) {
  const source = path.join(root, file);
  if (!existsSync(source)) {
    throw new Error(`Build artifact not found. Run npm run build first: ${file}`);
  }
  copyFileSync(source, path.join(pluginDir, file));
}

const activeVault = obsidian(['vault', 'info=path']);
if (path.resolve(activeVault) !== path.resolve(qaVault)) {
  throw new Error(`Obsidian active vault must be ${qaVault}, got ${activeVault}`);
}

obsidian(['plugin:reload', 'id=copsidian']);
obsidian(['command', 'id=copsidian:open-copsidian']);

const runtime = evalObsidian(`JSON.stringify({
  enabled: app.plugins.enabledPlugins.has('copsidian'),
  version: app.plugins.manifests.copsidian?.version,
  commands: Object.keys(app.commands.commands).filter((id) => id.startsWith('copsidian:')).sort(),
  leaves: app.workspace.getLeavesOfType('copsidian-view').length
})`);
if (!runtime.includes(`"version":"${pkg.version}"`)) {
  throw new Error(`Copsidian runtime version mismatch:\n${runtime}`);
}
if (!runtime.includes('copsidian:open-copsidian')) {
  throw new Error(`Copsidian command not registered:\n${runtime}`);
}

const leafStress = evalObsidian(`(async()=>{
  const plugin = app.plugins.plugins.copsidian;
  const counts = [];
  for (let i = 0; i < 50; i++) {
    await plugin.activateView();
    const count = app.workspace.getLeavesOfType('copsidian-view').length;
    counts.push(count);
    if (count !== 1) throw new Error('leaf-count-' + i + '-' + count);
  }
  return JSON.stringify({ iterations: 50, min: Math.min(...counts), max: Math.max(...counts), final: counts.at(-1) });
})()`);
if (!leafStress.includes('"max":1')) {
  throw new Error(`Copsidian leaf stress failed:\n${leafStress}`);
}

const autocomplete = evalObsidian(`(async()=>{
  const plugin = app.plugins.plugins.copsidian;
  await plugin.activateView();
  const view = app.workspace.getLeavesOfType('copsidian-view')[0].view;
  for (let i = 0; i < 20; i++) {
    view.showAC('@');
    if (!view.autocomplete?.isOpen()) throw new Error('mention-ac-' + i);
    view.closeAutocomplete();
    view.showAC('/');
    if (!view.autocomplete?.isOpen()) throw new Error('slash-ac-' + i);
    view.closeAutocomplete();
  }
  return JSON.stringify({ iterations: 20, autocompleteOpen: view.autocomplete?.isOpen?.() ?? null });
})()`);
if (!autocomplete.includes('"autocompleteOpen":false')) {
  throw new Error(`Autocomplete smoke failed:\n${autocomplete}`);
}

const mcpRestore = evalObsidian(`(async()=>{
  const plugin = app.plugins.plugins.copsidian;
  await plugin.activateView();
  const calls = [];
  const originalGetClient = plugin.getClient.bind(plugin);
  const client = { getCurrentSessionId: () => 'different-session', loadSession: async (...args) => calls.push(args) };
  plugin.getClient = () => client;
  plugin.settings.mcpServers = [{ id: 'qa', enabled: true, name: 'qa-server', command: 'node', args: ['server.js'] }];
  try {
    await app.workspace.getLeavesOfType('copsidian-view')[0].view.syncRuntimeSession('qa-session');
  } finally {
    plugin.getClient = originalGetClient;
  }
  return JSON.stringify({ calls });
})()`);
if (!mcpRestore.includes('qa-server')) {
  throw new Error(`MCP restore smoke failed:\n${mcpRestore}`);
}

const devErrors = optionalObsidian(['dev:errors']);
const consoleErrors = optionalObsidian(['dev:console', 'level=error']);
if (devErrors.ok && !devErrors.output.includes('No errors captured')) {
  throw new Error(`Obsidian captured errors:\n${devErrors.output}`);
}
const consoleUnavailable = consoleErrors.output.includes('Debugger not attached') || consoleErrors.output.includes('Command not found');
if (consoleErrors.ok && !consoleUnavailable && !consoleErrors.output.includes('No console messages captured')) {
  throw new Error(`Obsidian console errors:\n${consoleErrors.output}`);
}

console.log(`Obsidian smoke QA passed for ${pkg.version}`);
if (!devErrors.ok || !consoleErrors.ok || consoleUnavailable) {
  console.log('Note: dev error/console commands are unavailable in this Obsidian CLI environment; runtime smoke checks still passed.');
}
