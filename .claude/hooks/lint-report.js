#!/usr/bin/env node
// Runs lint:fix and reports TypeScript errors and ESLint warnings to Claude

const { execSync } = require("child_process");
const path = require("path");

const projectDir = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, "../..");

function parseOutput(output) {
  const lines = output.split("\n");
  const issues = [];

  // TypeScript errors: file.ts(line,col): error TS2367: message
  const tsErrors = lines.filter((l) => /\(\d+,\d+\): error TS\d+:/.test(l));

  // ESLint issues: file.ts 1:19 warning/error message rule-name
  const eslintIssues = lines.filter((l) => /\d+:\d+\s+(warning|error)\s+/.test(l));

  // ESLint summary: ✖ X problems
  const eslintSummary = lines.find((l) => l.includes("problems"));

  return { tsErrors, eslintIssues, eslintSummary };
}

try {
  const output = execSync("npm run lint:fix", {
    cwd: projectDir,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  const { tsErrors, eslintIssues, eslintSummary } = parseOutput(output);

  if (tsErrors.length > 0 || eslintIssues.length > 0) {
    console.error("Lint completed with issues:\n");

    if (tsErrors.length > 0) {
      console.error(`TypeScript errors (${tsErrors.length}):`);
      tsErrors.forEach((e) => console.error("  " + e));
      console.error("");
    }

    if (eslintIssues.length > 0) {
      console.error(`ESLint issues (${eslintIssues.length}):`);
      eslintIssues.slice(0, 20).forEach((e) => console.error("  " + e));
      if (eslintIssues.length > 20) {
        console.error(`  ... and ${eslintIssues.length - 20} more`);
      }
      if (eslintSummary) {
        console.error("\n" + eslintSummary);
      }
    }

    process.exit(2);
  }

  process.exit(0);
} catch (error) {
  // Command failed (non-zero exit from tsc or eslint)
  const output = (error.stdout || "") + (error.stderr || "");

  const { tsErrors, eslintIssues, eslintSummary } = parseOutput(output);

  if (tsErrors.length > 0 || eslintIssues.length > 0 || output.includes("error TS")) {
    console.error("Lint completed with issues:\n");

    if (tsErrors.length > 0) {
      console.error(`TypeScript errors (${tsErrors.length}):`);
      tsErrors.forEach((e) => console.error("  " + e));
      console.error("");
    } else if (output.includes("error TS")) {
      // Fallback: show raw TS errors if regex didn't match
      console.error("TypeScript errors:");
      output
        .split("\n")
        .filter((l) => l.includes("error TS"))
        .forEach((e) => console.error("  " + e));
      console.error("");
    }

    if (eslintIssues.length > 0) {
      console.error(`ESLint issues (${eslintIssues.length}):`);
      eslintIssues.slice(0, 20).forEach((e) => console.error("  " + e));
      if (eslintIssues.length > 20) {
        console.error(`  ... and ${eslintIssues.length - 20} more`);
      }
      if (eslintSummary) {
        console.error("\n" + eslintSummary);
      }
    }

    process.exit(2);
  }

  // Other error
  console.error("Lint failed:", error.message);
  if (output) {
    console.error(output);
  }
  process.exit(1);
}
