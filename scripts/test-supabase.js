import pg from "pg"

// postgresql://postgres:QF1siEAJnnVwdwl4@db.cthammossxdzneiqxfnp.supabase.co:5432/postgres?schema=indicacao
const client = new pg.Client({
  host: "db.cthammossxdzneiqxfnp.supabase.co",
  port: 5432,
  user: "postgres",
  password: "QF1siEAJnnVwdwl4",
  database: "postgres",
  schema: "indicacao",
  ssl: { rejectUnauthorized: false },
  family: 4
})
client.connect()
  .then(() => console.log("Conectou!"))
  .catch(err => console.error("Erro:", err.message))


// node ./scripts/test-supabase.js





  

// import pg from "pg"

// const client = new pg.Client({
//   connectionString: "postgresql://postgres:Banano$1988$Supabase@db.cthammossxdzneiqxfnp.supabase.co:5432/postgres",
//   connectionTimeoutMillis: 5000,
//   keepAlive: true,
//   host: "db.cthammossxdzneiqxfnp.supabase.co",
//   port: 5432,
//   ssl: { rejectUnauthorized: false },
//   family: 4 // 👈 força IPv4
// })

// client.connect()
//   .then(() => console.log("Conectou!"))
//   .catch(err => console.error("Erro:", err))
