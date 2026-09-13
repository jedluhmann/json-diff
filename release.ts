// release.ts
import { $ } from "bun";
import pkg from "./package.json" assert { type: "json" };

const newVersion = Bun.argv[2];

if (!newVersion) {
  console.error("Please provide a version number (e.g., bun run release 1.2.3)");
  process.exit(1);
}

// 1. Update the version using Bun's native command
await $`bun version ${newVersion}`;

// 2. Fetch the newly updated version for the Git tag
const updatedVersion = `v${newVersion}`;

// 3. Automate Git tasks
await $`git add package.json`;
await $`git commit -m "chore: release ${updatedVersion}"`;
await $`git tag ${updatedVersion}`;

console.log(`Successfully tagged and committed ${updatedVersion}! 🎉`);