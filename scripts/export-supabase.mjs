// Script for å eksportere data fra Supabase til JSONL-filer
// Kjør med: node scripts/export-supabase.mjs

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Les miljøvariabler
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Prøv service role key først, fall tilbake til anon key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE nøkkel");
  console.log("Kjør med: source .env.local && node scripts/export-supabase.mjs");
  process.exit(1);
}

console.log("Bruker:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "SERVICE_ROLE_KEY" : "ANON_KEY");

const supabase = createClient(supabaseUrl, supabaseKey);

// Tabeller som skal eksporteres
const tables = [
  "phases",
  "weeks",
  "planned_workouts",
  "activities",
  "strava_tokens",
  "weekly_summaries",
  "lifestyle_log",
  "ai_analyses",
  "goals",
];

async function exportTable(tableName) {
  console.log(`Eksporterer ${tableName}...`);

  const { data, error } = await supabase
    .from(tableName)
    .select("*");

  if (error) {
    console.error(`Feil ved eksport av ${tableName}:`, error.message);
    return 0;
  }

  if (!data || data.length === 0) {
    console.log(`  -> ${tableName}: 0 rader (tom tabell)`);
    return 0;
  }

  // Skriv til JSONL-fil (én JSON per linje)
  const jsonl = data.map((row) => JSON.stringify(row)).join("\n");
  writeFileSync(join(__dirname, `data/${tableName}.jsonl`), jsonl);

  console.log(`  -> ${tableName}: ${data.length} rader eksportert`);
  return data.length;
}

async function main() {
  console.log("=== Eksporterer data fra Supabase ===\n");

  // Opprett data-mappe
  mkdirSync(join(__dirname, "data"), { recursive: true });

  let total = 0;
  for (const table of tables) {
    const count = await exportTable(table);
    total += count;
  }

  console.log(`\n=== Ferdig! Totalt ${total} rader eksportert ===`);
  console.log("Filer ligger i scripts/data/");
}

main().catch(console.error);
