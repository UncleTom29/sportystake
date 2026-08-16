import { defineConfig } from 'tsup';

// Two independent build steps, not one shared entry map: react.ts's wagmi hooks return
// values wagmi's own generics make (TS2742 on several useReadContracts/useWriteContract
// wrappers — a pre-existing type-portability gap, not something this split introduces), and
// a shared `dts: true` step fails atomically across every entry it covers. Splitting index
// off means its .d.ts still builds cleanly regardless of react.ts's own unrelated gap.
export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    target: 'es2022',
    splitting: false,
    clean: true,
    sourcemap: true,
    treeshake: true,
    external: ['react', 'wagmi', '@tanstack/react-query', 'viem'],
  },
  {
    entry: { react: 'src/react.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    target: 'es2022',
    splitting: false,
    clean: false,
    sourcemap: true,
    treeshake: true,
    external: ['react', 'wagmi', '@tanstack/react-query', 'viem'],
  },
]);
