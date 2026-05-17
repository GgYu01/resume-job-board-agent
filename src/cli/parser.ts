export interface ParsedArgs {
  command: string;
  args: string[];
}

export function parseCliArgs(argv: string[]): ParsedArgs {
  const [command = "help", ...args] = argv;
  return { command, args };
}
