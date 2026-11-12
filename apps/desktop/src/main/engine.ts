import { access, readFile, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { delimiter, dirname, extname, join, isAbsolute, resolve, sep } from 'node:path';
import {
  BitwardenCli,
  bootstrapRuns,
  removeVerifyCopies,
  type CliOptions,
  type CliPort,
} from './cli';
import { WarmBitwardenCli } from './serve';
import { UserError } from '@oxvault/shared/protocol';

export const ENGINE_SETUP_MESSAGE =
  process.platform === 'darwin'
    ? 'Install the official Bitwarden CLI with “brew install bitwarden-cli”, then restart OxVault.'
    : 'Install the official Bitwarden CLI and add it to PATH, or set OXVAULT_BW_PATH to its full path, then restart OxVault.';

/** Without the preload, keys would sit in the CLI's environment, where other apps can read them. */
function privateChannelMessage(executable: string) {
  const install =
    process.platform === 'darwin'
      ? 'Install the official CLI with “brew install bitwarden-cli”'
      : 'Install the official CLI with “npm install -g @bitwarden/cli”';
  return `The Bitwarden CLI at “${executable}” cannot receive keys privately, so OxVault will not use it. ${install} and check that the npm copy starts before this one, then restart OxVault.`;
}

/**
 * Snap's `bw` is a packaged single executable behind a symlink to snapd. A packaged
 * Node ignores NODE_OPTIONS, so it can never run the bootstrap; it is not a CLI to probe.
 */
function isSnapShim(resolved: string) {
  return (
    process.platform === 'linux' &&
    (resolved.startsWith(`${sep}snap${sep}`) ||
      resolved.startsWith(`${sep}usr${sep}lib${sep}snapd${sep}`))
  );
}

/**
 * Puts a warm vault server in front of the one-shot CLI, so reads and writes
 * skip a CLI start. Set OXVAULT_DISABLE_SERVE=1 to run every command one-shot.
 */
function engineCli(options: CliOptions): CliPort {
  const cold = new BitwardenCli(options);
  // Node cannot pass connected sockets to a child on Windows. Never replace
  // descriptor mode with a listening, unauthenticated bw serve port.
  return process.platform === 'win32' || process.env.OXVAULT_DISABLE_SERVE === '1'
    ? cold
    : new WarmBitwardenCli(cold, options);
}

export async function localEngine(options: {
  dataDir: string;
  bootstrap: string;
}): Promise<{ cli: CliPort; setupError?: string }> {
  const windows = process.platform === 'win32';
  const names = windows ? ['bw.exe', 'bw.cmd'] : ['bw'];
  const directories = windows
    ? [join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'npm')]
    : [
        '/opt/homebrew/bin',
        '/usr/local/bin',
        `/etc/profiles/per-user/${userInfo().username}/bin`,
        join(homedir(), '.nix-profile/bin'),
        join(homedir(), '.local/bin'),
        '/usr/bin',
        '/bin',
      ];
  directories.push(...(process.env.PATH ?? '').split(delimiter));
  const candidates = new Set([
    process.env.OXVAULT_BW_PATH,
    ...directories
      .filter(isAbsolute)
      .flatMap((directory) => names.map((name) => join(directory, name))),
  ]);
  try {
    await access(options.bootstrap, constants.R_OK);
  } catch {
    return unavailable('OxVault is missing one of its files. Reinstall OxVault, then try again.');
  }
  await removeVerifyCopies(options.dataDir);
  let privateChannelMissing: string | undefined;
  for (const executable of candidates) {
    if (!executable || !isAbsolute(executable)) continue;
    try {
      await access(executable, windows ? constants.R_OK : constants.X_OK);
      // A path that cannot be resolved is still worth probing as given.
      if (isSnapShim(await realpath(executable).catch(() => executable))) continue;
      if (!(await stat(executable)).isFile()) continue;
      let cliOptions: CliOptions = { ...options, executable };
      if (windows && extname(executable).toLowerCase() === '.cmd') {
        // npm's shim needs cmd.exe, whose argument expansion is unsuitable for
        // vault commands. Run only the installed official package's JS entry.
        const packageDir = join(dirname(executable), 'node_modules', '@bitwarden', 'cli');
        const info = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8')) as {
          name?: string;
          bin?: { bw?: string };
        };
        if (info.name !== '@bitwarden/cli' || typeof info.bin?.bw !== 'string') continue;
        const script = resolve(packageDir, info.bin.bw);
        if (!script.startsWith(`${packageDir}${sep}`) || !/\.[cm]?js$/i.test(script)) continue;
        await access(script, constants.R_OK);
        if (!(await stat(script)).isFile()) continue;
        cliOptions = { ...options, executable: process.execPath, script };
      } else if (windows && extname(executable).toLowerCase() !== '.exe') continue;
      if (!(await bootstrapRuns(cliOptions))) {
        privateChannelMissing ??= executable;
        continue;
      }
      return { cli: engineCli(cliOptions) };
    } catch {
      /* Try the next standard installation path. */
    }
  }
  return unavailable(
    privateChannelMissing ? privateChannelMessage(privateChannelMissing) : ENGINE_SETUP_MESSAGE,
  );
}

function unavailable(setupError: string): { cli: CliPort; setupError: string } {
  return {
    setupError,
    cli: {
      cancel() {},
      async run() {
        throw new UserError(setupError);
      },
    },
  };
}
