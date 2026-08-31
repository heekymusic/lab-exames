const express = require("express");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.get("/", (req, res) => {
  res.send("Laboratorio Maiolini e Miranda");
});

app.get("/db", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS horario, current_database() AS banco"
    );

    res.json({
      sucesso: true,
      mensagem: "PostgreSQL conectado com sucesso!",
      horario: result.rows[0].horario,
      banco: result.rows[0].banco
    });
  } catch (error) {
    console.error("Erro ao conectar ao PostgreSQL:", error);

    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao conectar ao PostgreSQL"
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
});
