const express = require("express");
const multer = require("multer");
const { Pool } = require("pg");
const { parseTXT } = require("./parser");

const app = express();

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

app.use(express.json());

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
    console.error("Erro PostgreSQL:", error);

    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao conectar ao PostgreSQL",
      erro: error.message
    });
  }
});

app.post("/importar", upload.single("arquivo"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Nenhum arquivo TXT foi enviado."
    });
  }

  try {
    const conteudo = req.file.buffer.toString("utf8");

    const pedidos = parseTXT(conteudo);

    let pacientesInseridos = 0;
    let pedidosInseridos = 0;
    let examesInseridos = 0;
    let itensInseridos = 0;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const pedidoData of pedidos) {
        const pacienteResult = await client.query(
          `
          INSERT INTO pacientes (
            nome,
            codigo_externo
          )
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
          RETURNING id
          `,
          [
            pedidoData.paciente.nome,
            pedidoData.paciente.codigoExterno
          ]
        );

        let pacienteId;

        if (pacienteResult.rows.length > 0) {
          pacienteId = pacienteResult.rows[0].id;
          pacientesInseridos++;
        } else {
          const existente = await client.query(
            `
            SELECT id
            FROM pacientes
            WHERE codigo_externo = $1
            LIMIT 1
            `,
            [pedidoData.paciente.codigoExterno]
          );

          pacienteId = existente.rows[0].id;
        }

        const pedidoResult = await client.query(
          `
          INSERT INTO pedidos (
            paciente_id,
            numero_pedido,
            data_entrada
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (numero_pedido) DO NOTHING
          RETURNING id
          `,
          [
            pacienteId,
            pedidoData.numeroPedido,
            pedidoData.paciente.dataEntrada
          ]
        );

        let pedidoId;

        if (pedidoResult.rows.length > 0) {
          pedidoId = pedidoResult.rows[0].id;
          pedidosInseridos++;
        } else {
          const existente = await client.query(
            `
            SELECT id
            FROM pedidos
            WHERE numero_pedido = $1
            LIMIT 1
            `,
            [pedidoData.numeroPedido]
          );

          pedidoId = existente.rows[0].id;
        }

        for (const exame of pedidoData.exames) {
          const exameResult = await client.query(
            `
            INSERT INTO exames (
              pedido_id,
              nome,
              material,
              metodo,
              resultado_texto,
              referencia_texto,
              observacoes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
            `,
            [
              pedidoId,
              exame.nome,
              exame.material,
              exame.metodo,
              exame.resultadoTexto,
              exame.referenciaTexto,
              exame.observacoes
            ]
          );

          const exameId = exameResult.rows[0].id;

          examesInseridos++;

          for (const item of exame.itens) {
            await client.query(
              `
              INSERT INTO exame_itens (
                exame_id,
                nome,
                resultado,
                referencia,
                ordem
              )
              VALUES ($1, $2, $3, $4, $5)
              `,
              [
                exameId,
                item.nome,
                item.resultado,
                item.referencia,
                item.ordem
              ]
            );

            itensInseridos++;
          }
        }
      }

      await client.query("COMMIT");

      res.json({
        sucesso: true,
        mensagem: "Arquivo importado com sucesso!",
        resumo: {
          pedidosEncontrados: pedidos.length,
          pacientesInseridos,
          pedidosInseridos,
          examesInseridos,
          itensInseridos
        }
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Erro na importação:", error);

    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao importar o arquivo.",
      erro: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
});
