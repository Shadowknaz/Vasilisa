declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function writeFileSync(path: string, data: string, encoding: 'utf8'): void;
  export function mkdirSync(path: string, options: { recursive: true }): void;
  export function readdirSync(path: string, options: { withFileTypes: true }): Array<{ name: string; isFile(): boolean }>;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function resolve(...parts: string[]): string;
}
declare const process: { argv: string[]; exitCode?: number };
