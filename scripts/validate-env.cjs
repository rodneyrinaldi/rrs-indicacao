#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

const mode = (process.argv[2] || "").trim();

const MODES = {
  dev: {
    source: ".env.dev",
    required: [
      "DB_USER",
      "DB_PASS",
      "DB_NAME",
      "DATABASE_URL",
      "NEXT_PUBLIC_APP_URL",
      "SUPER_ADMIN_KEY",
    ],
    expected: {
      DB_HOST_FALLBACK: "localhost",
    },
    expectedConnectionMode: "local",
  },
  "prod-local": {
    source: ".env.prod.local",
    required: [
      "DB_USER",
      "DB_PASS",
      "DB_NAME",
      "DATABASE_URL",
      "NEXT_PUBLIC_APP_URL",
      "SUPER_ADMIN_KEY",
    ],
    expectedConnectionMode: "local",
  },
  supabase: {
    source: ".env.prod.supabase",
    required: [
      "SUPABASE_DATABASE_URL",
      "NEXT_PUBLIC_APP_URL",
      "SUPER_ADMIN_KEY",
    ],
    expectedConnectionMode: "supabase",
  },
  "supabase-cloud": {
    source: ".env.prod.supabase",
    required: [
      "SUPABASE_DATABASE_URL",
      "SUPABASE_PROJECT_REF",
      "NEXT_PUBLIC_APP_URL",
      "SUPER_ADMIN_KEY",
    ],
    expectedConnectionMode: "supabase",
  },
  "vercel-supabase": {
    source: "process.env",
    required: [
      "SUPABASE_DATABASE_URL",
      "NEXT_PUBLIC_APP_URL",
      "SUPER_ADMIN_KEY",
    ],
    expectedConnectionMode: "supabase",
  },
};

const VALID_CONNECTION_MODES = ["local", "supabase"];

const PLACEHOLDER_SNIPPETS = [
  "trocar-esta-chave",
  "seu-dominio.com",
  "<password>",
  "<ref>",
  "<project-ref>",
  "exemplo",
  "changeme",
  "example",
];

if (!MODES[mode]) {
  console.error(
    "Modo invalido. Use: dev | prod-local | supabase | supabase-cloud | vercel-supabase",
  );
  process.exit(1);
}

const cfg = MODES[mode];
const env = cfg.source === "process.env" ? process.env : readDotEnv(cfg.source);

const missing = cfg.required.filter((key) => !env[key] || String(env[key]).trim() === "");
const invalid = [];
const warnings = [];

for (const [key, expected] of Object.entries(cfg.expected || {})) {
  if ((env[key] || "").trim() !== expected) {
    invalid.push(`${key} deve ser ${expected}`);
  }
}

const resolvedMode = resolveConnectionMode(env, invalid);
if (cfg.expectedConnectionMode && resolvedMode !== cfg.expectedConnectionMode) {
  invalid.push(
    `Modo de conexao deve ser ${cfg.expectedConnectionMode} (DB_CONNECTION_MODE ou PRIMARY_DB).`,
  );
}

for (const key of cfg.required) {
  const value = String(env[key] || "");
  if (PLACEHOLDER_SNIPPETS.some((snippet) => value.toLowerCase().includes(snippet.toLowerCase()))) {
    warnings.push(`${key} parece placeholder: ${value}`);
  }
}

if (env.DATABASE_URL && !looksLikePostgresUrl(env.DATABASE_URL)) {
  invalid.push("DATABASE_URL nao parece uma URL postgresql valida");
}
if (env.SUPABASE_DATABASE_URL && !looksLikePostgresUrl(env.SUPABASE_DATABASE_URL)) {
  invalid.push("SUPABASE_DATABASE_URL nao parece uma URL postgresql valida");
}
if (env.SUPABASE_PROJECT_REF && !looksLikeSupabaseProjectRef(env.SUPABASE_PROJECT_REF)) {
  invalid.push("SUPABASE_PROJECT_REF parece invalido");
}

if (missing.length > 0 || invalid.length > 0) {
  if (missing.length > 0) {
    console.error(`Faltando no modo ${mode}: ${missing.join(", ")}`);
  }
  if (invalid.length > 0) {
    console.error(`Configuracao invalida no modo ${mode}:`);
    for (const item of invalid) {
      console.error(`- ${item}`);
    }
  }
  process.exit(1);
}

console.log(`Ambiente ${mode} valido (${cfg.source}).`);
if (warnings.length > 0) {
  console.warn("Avisos:");
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

function readDotEnv(fileName) {
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

function looksLikePostgresUrl(value) {
  return /^postgres(ql)?:\/\//i.test(String(value || ""));
}

function looksLikeSupabaseProjectRef(value) {
  return /^[a-z0-9]{10,30}$/i.test(String(value || "").trim());
}

function resolveConnectionMode(envValues, invalidList) {
  const explicitMode = String(envValues.DB_CONNECTION_MODE || "")
    .trim()
    .toLowerCase();
  const legacyMode = String(envValues.PRIMARY_DB || "")
    .trim()
    .toLowerCase();

  if (explicitMode && !VALID_CONNECTION_MODES.includes(explicitMode)) {
    invalidList.push(
      `DB_CONNECTION_MODE invalido: ${explicitMode}. Use ${VALID_CONNECTION_MODES.join(" | ")}.`,
    );
  }

  if (legacyMode && !VALID_CONNECTION_MODES.includes(legacyMode)) {
    invalidList.push(`PRIMARY_DB invalido: ${legacyMode}. Use ${VALID_CONNECTION_MODES.join(" | ")}.`);
  }

  if (explicitMode && legacyMode && explicitMode !== legacyMode) {
    invalidList.push("DB_CONNECTION_MODE e PRIMARY_DB nao podem divergir.");
  }

  return explicitMode || legacyMode || "local";
}
