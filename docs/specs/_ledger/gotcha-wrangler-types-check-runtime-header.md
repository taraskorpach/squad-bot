---
kind: gotcha
paths: [package.json, package-lock.json, wrangler.jsonc, worker-configuration.d.ts, .github/workflows/**]
created: 2026-11-16T22:11:25+02:00
seen-in: [mvp]
---

# A wrangler upgrade fails `wrangler types --check` until the types are regenerated

`wrangler types --check` compares two things in `worker-configuration.d.ts`: a hash of the env types and the runtime header, which names the workerd version, the compatibility date and the flags. Changing `wrangler.jsonc`, or upgrading wrangler (which bundles a newer workerd), fails CI until `npm run cf-typegen` regenerates the file. Commit the regenerated file in the same change.

Evidence: wrangler 4.163.0 `wrangler-dist/cli.js:214298-214376` (`checkTypesUpToDate`: env hash plus runtime header, exit 1 with "Types at <path> are out of date"). It never compares the body of the runtime types.
