---
kind: gotcha
paths: [scripts/**, src/telegram.ts, src/texts.ts, src/welcome.ts]
created: 2026-11-16T23:50:08+02:00
seen-in: [mvp]
---

# Type-check the files Node runs directly with `nodenext` and `erasableSyntaxOnly`

Node runs `scripts/configure-telegram.ts` and the `src` leaves it imports as `.ts`, with type stripping. Node rejects extensionless relative imports, enums, namespaces and parameter properties. The root tsconfig accepts all of them: `moduleResolution: bundler` allows extensionless imports, and there is no `erasableSyntaxOnly`. So a tsconfig that checks those files needs `module: nodenext` and `erasableSyntaxOnly: true`. CI also needs one real run under Node, because only that shows the imports load: Node imports grammY through its CommonJS build.

Evidence:
- `tsconfig.json:6` sets bundler resolution; TypeScript 6.0.3 supports `erasableSyntaxOnly`.
- Node 26 reports `process.features.typescript === 'strip'`.
- `import { Api } from 'grammy'` resolves to `out/mod.js` through grammY's `node` export condition.
- Found in mvp phase 4 preflight (`docs/specs/mvp/research/phase-4/2026-11-16-setup-script-preflight.md`).
