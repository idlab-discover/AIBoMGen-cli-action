import * as exec from "@actions/exec";

/**
 * Execute a command and return its exit code.
 * @param cmd  - The executable to run
 * @param args - Arguments to pass to the executable
 * @param options - Optional exec options (env, listeners, etc.)
 */
export async function execute(
  cmd: string,
  args: string[],
  options?: exec.ExecOptions,
): Promise<number> {
  return exec.exec(cmd, args, options);
}

/**
 * Maps a Windows-style absolute path to the equivalent WSL path.
 * e.g. "C:\foo\bar" → "/mnt/c/foo/bar"
 */
export function mapToWSLPath(arg: string): string {
  return arg.replace(
    /^([A-Z]):(.*)$/,
    (_v, drive: string, rest: string) => `/mnt/${drive.toLowerCase()}${rest.replace(/\\/g, "/")}`,
  );
}
