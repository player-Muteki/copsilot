import { existsSync, readFileSync, statSync } from 'fs';

const checkArtifacts = process.argv.includes('--artifacts');

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const changelog = readFileSync('CHANGELOG.md', 'utf8');
const acpClient = readFileSync('src/client/acp.ts', 'utf8');

if (pkg.version !== manifest.version) {
  throw new Error(`package.json version (${pkg.version}) must match manifest.json version (${manifest.version})`);
}

if (!changelog.includes(`## ${pkg.version} -`)) {
  throw new Error(`CHANGELOG.md is missing an entry for ${pkg.version}`);
}

const clientVersion = acpClient.match(/export const CLIENT_VERSION = '([^']+)'/)?.[1];
if (clientVersion !== pkg.version) {
  throw new Error(`ACP CLIENT_VERSION (${clientVersion ?? 'missing'}) must match package.json version (${pkg.version})`);
}

if (checkArtifacts) {
  const requiredArtifacts = ['release/main.js', 'release/manifest.json', 'release/styles.css'];
  for (const file of requiredArtifacts) {
    if (!existsSync(file)) {
      throw new Error(`Release artifact is missing: ${file}`);
    }
    if (statSync(file).size === 0) {
      throw new Error(`Release artifact is empty: ${file}`);
    }
  }

  const releaseManifest = JSON.parse(readFileSync('release/manifest.json', 'utf8'));
  if (releaseManifest.version !== pkg.version) {
    throw new Error(`release/manifest.json version (${releaseManifest.version}) must match package.json version (${pkg.version})`);
  }
}

console.log(`Release metadata${checkArtifacts ? ' and artifacts' : ''} verified for ${pkg.version}`);
