#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ENV_FILE = ".env.prod.supabase";
const shouldPrintOnly = process.argv.includes("--print");

const env = loadEnv(ENV_FILE);
const projectRef = resolveProjectRef(env);

if (!projectRef) {
  console.error(
    "Nao foi possivel determinar SUPABASE_PROJECT_REF. Defina SUPABASE_PROJECT_REF em .env.prod.supabase ou use SUPABASE_DATABASE_URL com host db.<ref>.supabase.co",
  );
  process.exit(1);
}

const dashboardUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;

if (shouldPrintOnly) {
  console.log(dashboardUrl);
  process.exit(0);
}

openInBrowser(dashboardUrl);
console.log(`Abrindo Supabase SQL Editor: ${dashboardUrl}`);

function loadEnv(fileName) {
  const filePath = path.resolve(process.cwd(), fileName);

  if (!fs.existsSync(filePath)) {
    console.error(`Arquivo nao encontrado: ${fileName}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf8");
  const parsed = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const eq = line.indexOf("=");
    if (eq < 0) {
      continue;
    }

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function resolveProjectRef(envValues) {
  const directRef = (envValues.SUPABASE_PROJECT_REF || "").trim();
  if (directRef) {
    return directRef;
  }

  const connectionString = String(envValues.SUPABASE_DATABASE_URL || "").trim();
  if (!connectionString) {
    return "";
  }

  try {
    const parsed = new URL(connectionString);
    const hostname = parsed.hostname || "";
    const match = hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    return match ? match[1] : "";
  } catch {
    return "";
  }
}

function openInBrowser(url) {
  if (process.platform === "win32") {
    execSync(`cmd /c start \"\" \"${url}\"`);
    return;
  }

  if (process.platform === "darwin") {
    execSync(`open \"${url}\"`);
    return;
  }

  execSync(`xdg-open \"${url}\"`);
}
