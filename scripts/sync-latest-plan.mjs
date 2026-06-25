import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const plansDir = path.join(repoRoot, 'plans');
const latestPath = path.join(plansDir, 'plan-latest.json');
const historyDir = path.join(plansDir, 'history');
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(value, field, file) {
  if (typeof value !== 'string' || !datePattern.test(value)) {
    throw new Error(`${file}: ${field} must be YYYY-MM-DD`);
  }
}

function validatePlan(plan, file) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error(`${file}: root must be an object`);
  }

  assertDate(plan.id, 'id', file);
  assertDate(plan.startDate, 'startDate', file);

  if (!Array.isArray(plan.weeks)) {
    throw new Error(`${file}: weeks must be an array`);
  }

  if (!plan.shopping || typeof plan.shopping !== 'object' || Array.isArray(plan.shopping)) {
    throw new Error(`${file}: shopping must be an object`);
  }

  if (!Array.isArray(plan.recipes)) {
    throw new Error(`${file}: recipes must be an array`);
  }
}

async function readPlan(fileName) {
  const fullPath = path.join(plansDir, fileName);
  const raw = await readFile(fullPath, 'utf8');
  const plan = JSON.parse(raw);
  validatePlan(plan, fileName);

  return {
    fileName,
    fullPath,
    plan,
    raw: raw.endsWith('\n') ? raw : `${raw}\n`,
    sortKey: plan.startDate || plan.id,
  };
}

async function main() {
  const entries = await readdir(plansDir, { withFileTypes: true });
  const planFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.json'));

  if (planFiles.length === 0) {
    throw new Error('No plan JSON files found in plans/');
  }

  const plans = await Promise.all(planFiles.map(readPlan));
  plans.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.fileName.localeCompare(b.fileName));

  const latest = plans.at(-1);
  const historyPath = path.join(historyDir, `${latest.plan.id}.json`);

  await mkdir(historyDir, { recursive: true });
  await writeFile(latestPath, latest.raw);
  await writeFile(historyPath, latest.raw);

  console.log(`Synced ${latest.fileName} -> plans/plan-latest.json`);
  console.log(`Synced ${latest.fileName} -> plans/history/${latest.plan.id}.json`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
