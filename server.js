const express = require("express");
const multer = require("multer");
const { Pool } = require("pg");
const { parseTXT } = require("./parser");

const app = express();

const PORT = process.env.PORT || 3000;

// ========================================
// POSTGRESQL
// ========================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false
});

// ========================================
// UPLOAD
// ========================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const nome = file.originalname.toLowerCase();

    if (!nome.endsWith(".txt")) {
      return cb(new Error("Apenas arquivos TXT são permitidos."));
    }

    cb(null, true);
  }
});

// ========================================
// MIDDLEWARE
// ========================================

app.use(express.json());

// ========================================
// PÁGINA INICIAL
// ========================================

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">

    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">

      <title>Laboratorio Maiolini e Miranda</title>

      <style>
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: Arial, Helvetica, sans-serif;
          background: #f4f6f8;
          color: #222;
        }

        .container {
          max-width: 900px;
          margin: 80px auto;
          padding: 20px;
        }

        .card {
          background: white;
          border-radius: 14px;
          padding: 40px;
          box-shadow: 0 5px 25px rgba(0,0,0,0.08);
        }

        h1 {
          margin-top: 0;
        }

        p {
          color: #666;
        }

        .links {
          display: flex;
          gap: 15px;
          margin-top: 30px;
          flex-wrap: wrap;
        }

        a {
          display: inline-block;
          padding: 14px 22px;
          border-radius: 8px;
          text-decoration: none;
          background: #2563eb;
          color: white;
        }

        a:hover {
          background: #1d4ed8;
        }
      </style>
    </head>

    <body>

      <div class="container">

        <div class="card">

          <h1>
            Laboratorio Maiolini e Miranda
          </h1>

          <p>
            Portal de exames laboratoriais
          </p>

          <div class="links">

            <a href="/importar">
              Importar exames
            </a>

            <a href="/db">
              Testar banco de dados
            </a>

          </div>

        </div>

      </div>

    </body>

    </html>
  `);
});

// ========================================
// TESTE DO POSTGRESQL
// ========================================

app.get("/db", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        NOW() AS horario,
        current_database() AS banco
    `);

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

// ========================================
// TELA DE IMPORTAÇÃO
// ========================================

app.get("/importar", (req, res) => {

  res.send(`
    <!DOCTYPE html>

    <html lang="pt-BR">

    <head>

      <meta charset="UTF-8">

      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
      >

      <title>Importar exames</title>

      <style>

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: Arial, Helvetica, sans-serif;
          background: #f4f6f8;
          color: #222;
        }

        .container {
          max-width: 650px;
          margin: 60px auto;
          padding: 20px;
        }

        .card {
          background: white;
          border-radius: 14px;
          padding: 35px;
          box-shadow: 0 5px 25px rgba(0,0,0,0.08);
        }

        h1 {
          margin-top: 0;
        }

        .subtitulo {
          color: #666;
          margin-bottom: 30px;
        }

        .campo {
          margin-bottom: 25px;
        }

        label {
          display: block;
          font-weight: bold;
          margin-bottom: 10px;
        }

        input[type="file"] {
          width: 100%;
          padding: 12px;
          border: 1px solid #ccc;
          border-radius: 8px;
          background: white;
        }

        button {
          width: 100%;
          padding: 15px;
          border: none;
          border-radius: 8px;
          background: #2563eb;
          color: white;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
        }

        button:hover {
          background: #1d4ed8;
        }

        button:disabled {
          background: #999;
          cursor: wait;
        }

        #resultado {
          margin-top: 25px;
          padding: 20px;
          border-radius: 8px;
          background: #f1f5f9;
          white-space: pre-wrap;
          word-break: break-word;
          display: none;
        }

        .voltar {
          display: inline-block;
          margin-top: 20px;
          color: #2563eb;
          text-decoration: none;
        }

      </style>

    </head>

    <body>

      <div class="container">

        <div class="card">

          <h1>
            Importar exames
          </h1>

          <div class="subtitulo">
            Laboratorio Maiolini e Miranda
          </div>

          <form id="formulario">

            <div class="campo">

              <label for="arquivo">
                Arquivo TXT dos exames
              </label>

              <input
                id="arquivo"
                type="file"
                name="arquivo"
                accept=".txt"
                required
              >

            </div>

            <button
              id="botao"
              type="submit"
            >
              IMPORTAR EXAMES
            </button>

          </form>

          <div id="resultado"></div>

          <a
            class="voltar"
            href="/"
          >
            ← Voltar
          </a>

        </div>

      </div>

      <script>

        const formulario =
          document.getElementById("formulario");

        const botao =
          document.getElementById("botao");

        const resultado =
          document.getElementById("resultado");


        formulario.addEventListener(
          "submit",
          async function(event) {

            event.preventDefault();

            const arquivo =
              document.getElementById("arquivo").files[0];

            if (!arquivo) {

              alert("Selecione um arquivo TXT.");

              return;

            }


            botao.disabled = true;

            botao.textContent =
              "IMPORTANDO...";

            resultado.style.display = "block";

            resultado.textContent =
              "Processando arquivo, aguarde...";


            try {

              const dados =
                new FormData();

              dados.append(
                "arquivo",
                arquivo
              );


              const resposta =
                await fetch(
                  "/importar",
                  {
                    method: "POST",
                    body: dados
                  }
                );


              const json =
                await resposta.json();


              resultado.textContent =
                JSON.stringify(
                  json,
                  null,
                  2
                );


            } catch (erro) {

              resultado.textContent =
                "Erro de comunicação: " +
                erro.message;

            }


            botao.disabled = false;

            botao.textContent =
              "IMPORTAR EXAMES";

          }

        );

      </script>

    </body>

    </html>
  `);

});

// ========================================
// IMPORTAÇÃO DO TXT
// ========================================

app.post(
  "/importar",
  upload.single("arquivo"),
  async (req, res) => {

    if (!req.file) {

      return res.status(400).json({
        sucesso: false,
        mensagem: "Nenhum arquivo TXT foi enviado."
      });

    }


    let client;


    try {

      // ------------------------------------
      // LER ARQUIVO
      // ------------------------------------

      const conteudo =
        req.file.buffer.toString("utf8");


      // ------------------------------------
      // PROCESSAR TXT
      // ------------------------------------

      const pedidos =
        parseTXT(conteudo);


      if (!pedidos || pedidos.length === 0) {

        return res.status(400).json({
          sucesso: false,
          mensagem:
            "Nenhum pedido foi encontrado no arquivo."
        });

      }


      // ------------------------------------
      // CONEXÃO
      // ------------------------------------

      client =
        await pool.connect();


      await client.query("BEGIN");


      let pacientesInseridos = 0;
      let pacientesExistentes = 0;

      let pedidosInseridos = 0;
      let pedidosExistentes = 0;

      let examesInseridos = 0;
      let itensInseridos = 0;


      // ------------------------------------
      // PROCESSAR PEDIDOS
      // ------------------------------------

      for (const pedidoData of pedidos) {

        const paciente =
          pedidoData.paciente;


        // ----------------------------------
        // PACIENTE
        // ----------------------------------

        let pacienteId;


        const pacienteExistente =
          await client.query(
            `
            SELECT id
            FROM pacientes
            WHERE codigo_externo = $1
            LIMIT 1
            `,
            [
              paciente.codigoExterno
            ]
          );


        if (
          pacienteExistente.rows.length > 0
        ) {

          pacienteId =
            pacienteExistente.rows[0].id;

          pacientesExistentes++;

        } else {

          const novoPaciente =
            await client.query(
              `
              INSERT INTO pacientes (
                nome,
                codigo_externo
              )
              VALUES ($1, $2)
              RETURNING id
              `,
              [
                paciente.nome,
                paciente.codigoExterno
              ]
            );


          pacienteId =
            novoPaciente.rows[0].id;

          pacientesInseridos++;

        }


        // ----------------------------------
        // PEDIDO
        // ----------------------------------

        let pedidoId;


        const pedidoExistente =
          await client.query(
            `
            SELECT id
            FROM pedidos
            WHERE numero_pedido = $1
            LIMIT 1
            `,
            [
              pedidoData.numeroPedido
            ]
          );


        if (
          pedidoExistente.rows.length > 0
        ) {

          pedidoId =
            pedidoExistente.rows[0].id;

          pedidosExistentes++;

        } else {

          const novoPedido =
            await client.query(
              `
              INSERT INTO pedidos (
                paciente_id,
                numero_pedido,
                data_entrada,
                data_coleta
              )
              VALUES (
                $1,
                $2,
                $3,
                $4
              )
              RETURNING id
              `,
              [
                pacienteId,
                pedidoData.numeroPedido,
                paciente.dataEntrada,
                pedidoData.exames[0]?.dataColeta || null
              ]
            );


          pedidoId =
            novoPedido.rows[0].id;

          pedidosInseridos++;

        }


        // ----------------------------------
        // SE PEDIDO JÁ EXISTE
        // NÃO DUPLICAR EXAMES
        // ----------------------------------

        if (
          pedidoExistente.rows.length > 0
        ) {

          continue;

        }


        // ----------------------------------
        // EXAMES
        // ----------------------------------

        for (
          const exame
          of pedidoData.exames
        ) {


          const novoExame =
            await client.query(
              `
              INSERT INTO exames (
                pedido_id,
                nome,
                material,
                metodo,
                resultado_texto,
                unidade,
                referencia_texto,
                observacoes
              )
              VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8
              )
              RETURNING id
              `,
              [
                pedidoId,
                exame.nome,
                exame.material,
                exame.metodo,
                exame.resultadoTexto,
                exame.unidade,
                exame.referenciaTexto,
                exame.observacoes
              ]
            );


          const exameId =
            novoExame.rows[0].id;


          examesInseridos++;


          // --------------------------------
          // ITENS DO EXAME
          // --------------------------------

          if (
            Array.isArray(exame.itens)
          ) {

            for (
              const item
              of exame.itens
            ) {

              await client.query(
                `
                INSERT INTO exame_itens (
                  exame_id,
                  nome,
                  resultado,
                  unidade,
                  referencia,
                  ordem
                )
                VALUES (
                  $1,
                  $2,
                  $3,
                  $4,
                  $5,
                  $6
                )
                `,
                [
                  exameId,
                  item.nome,
                  item.resultado,
                  item.unidade || null,
                  item.referencia,
                  item.ordem
                ]
              );


              itensInseridos++;

            }

          }

        }

      }


      // ------------------------------------
      // FINALIZAR TRANSAÇÃO
      // ------------------------------------

      await client.query("COMMIT");


      // ------------------------------------
      // RESPOSTA
      // ------------------------------------

      res.json({

        sucesso: true,

        mensagem:
          "Arquivo importado com sucesso!",

        arquivo:
          req.file.originalname,

        resumo: {

          pedidosEncontrados:
            pedidos.length,

          pacientesInseridos,

          pacientesExistentes,

          pedidosInseridos,

          pedidosExistentes,

          examesInseridos,

          itensInseridos

        }

      });


    } catch (error) {


      // ------------------------------------
      // DESFAZER TUDO SE HOUVER ERRO
      // ------------------------------------

      if (client) {

        try {

          await client.query("ROLLBACK");

        } catch (rollbackError) {

          console.error(
            "Erro no rollback:",
            rollbackError
          );

        }

      }


      console.error(
        "Erro na importação:",
        error
      );


      res.status(500).json({

        sucesso: false,

        mensagem:
          "Erro ao importar o arquivo.",

        erro:
          error.message

      });


    } finally {


      if (client) {

        client.release();

      }

    }

  }
);

// ========================================
// TRATAMENTO DE ERROS DO MULTER
// ========================================

app.use(
  (error, req, res, next) => {

    if (
      error instanceof multer.MulterError
    ) {

      return res.status(400).json({

        sucesso: false,

        mensagem:
          "Erro no upload do arquivo.",

        erro:
          error.message

      });

    }


    if (
      error &&
      error.message ===
        "Apenas arquivos TXT são permitidos."
    ) {

      return res.status(400).json({

        sucesso: false,

        mensagem:
          "Somente arquivos TXT são permitidos."

      });

    }


    next(error);

  }
);

// ========================================
// SERVIDOR
// ========================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Servidor iniciado na porta ${PORT}`
    );

  }
);
