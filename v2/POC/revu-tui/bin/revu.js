#!/usr/bin/env node
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
execSync(`npx tsx ${join(__dirname, "../src/index.tsx")}`, { stdio: "inherit" });
