import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);

const CATEGORIES = ["chicken", "veggie", "pork", "seafood", "noodle", "bread"];

let ready;
function ensureTable() {
  if (!ready) {
    ready = sql`
      CREATE TABLE IF NOT EXISTS recipes (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        category   TEXT NOT NULL,
        note       TEXT,
        links      JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )`;
  }
  return ready;
}

function linkLabel(url) {
  if (/instagram\.com/.test(url)) return "Instagram";
  if (/youtu\.?be/.test(url)) return "YouTube";
  if (/blog\.naver\.com/.test(url)) return "Blog";
  if (/(^|\.)x\.com|twitter\.com/.test(url)) return "X";
  return "Link";
}

export default async function handler(req, res) {
  try {
    await ensureTable();

    if (req.method === "GET") {
      const rows = await sql`
        SELECT id, name, category, note, links
        FROM recipes ORDER BY id DESC`;
      return res.status(200).json(rows);
    }

    if (req.method === "POST") {
      const { name, category, note, url } = req.body || {};

      if (
        !name || typeof name !== "string" || name.length > 200 ||
        !url || typeof url !== "string" || url.length > 1000 ||
        !/^https?:\/\//.test(url) ||
        !CATEGORIES.includes(category) ||
        (note && (typeof note !== "string" || note.length > 500))
      ) {
        return res.status(400).json({ error: "invalid input" });
      }

      const links = JSON.stringify([{ label: linkLabel(url), url }]);
      const rows = await sql`
        INSERT INTO recipes (name, category, note, links)
        VALUES (${name.trim()}, ${category}, ${note ? note.trim() : null}, ${links}::jsonb)
        RETURNING id, name, category, note, links`;
      return res.status(201).json(rows[0]);
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server error" });
  }
}
