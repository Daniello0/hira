import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

describe('DiskFileStore', () => {
  it('does not ask Nest to inject the library root', () => {
    const source = readFileSync(new URL('./disk-file.store.ts', import.meta.url), 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
      fileName: 'disk-file.store.ts',
    }).outputText;
    expect(output).not.toContain('[Object]');
  });
});
