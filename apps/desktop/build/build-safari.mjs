import { execFileSync } from 'node:child_process';
import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as plist from 'plist';

export async function buildSafari(
  root,
  group = process.env.OXVAULT_APP_GROUP ?? 'UNCONFIGURED.app.oxvault.vault',
) {
  if (process.platform !== 'darwin') return;
  const contents = resolve(root, 'dist/native/OxVaultSafari.appex/Contents');
  await mkdir(resolve(contents, 'MacOS'), { recursive: true });
  await cp(resolve(root, '../extension/.output/safari-mv3'), resolve(contents, 'Resources'), {
    recursive: true,
  });
  execFileSync(
    'xcrun',
    [
      'clang',
      '-fobjc-arc',
      '-fblocks',
      '-fapplication-extension',
      '-mmacosx-version-min=14.0',
      '-Wall',
      '-Wextra',
      '-Werror',
      '-framework',
      'Foundation',
      '-framework',
      'SafariServices',
      '-framework',
      'Security',
      resolve(root, 'native/safari/Handler.m'),
      resolve(root, 'native/VerifyServer.c'),
      '-o',
      resolve(contents, 'MacOS/OxVaultSafari'),
    ],
    { stdio: 'inherit' },
  );
  const { version } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  await writeFile(
    resolve(contents, 'Info.plist'),
    plist.build({
      CFBundleIdentifier: 'app.oxvault.vault.safari',
      CFBundleName: 'OxVault',
      CFBundleDisplayName: 'OxVault',
      CFBundleInfoDictionaryVersion: '6.0',
      CFBundleSupportedPlatforms: ['MacOSX'],
      CFBundleExecutable: 'OxVaultSafari',
      CFBundlePackageType: 'XPC!',
      CFBundleVersion: version,
      CFBundleShortVersionString: version,
      LSMinimumSystemVersion: '14.0',
      StrongroomAppGroup: group,
      NSExtension: {
        NSExtensionPointIdentifier: 'com.apple.Safari.web-extension',
        NSExtensionPrincipalClass: 'OxVaultSafariHandler',
      },
    }),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await buildSafari(resolve(import.meta.dirname, '..'));
