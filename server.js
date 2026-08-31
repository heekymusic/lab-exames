const express = require("express");
const multer = require("multer");
const { Pool } = require("pg");

const { parseTXT } = require("./parser");
const {
  buscarPacientes,
  buscarPedidosPorPaciente,
  buscarPedido
} = require("./consultas");

const app = express();

const PORT = process.env.PORT || 3000;

// ========================================
// POSTGRES
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
    if (!file.originalname.toLowerCase().endsWith(".txt")) {
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
// PÁGINA PRINCIPAL
// ========================================

app.get("/", (req, res) => {

  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>Laboratorio Maiolini e Miranda</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
  background: #f4f6f8;
  color: #1f2937;
}

.container {
  max-width: 1000px;
  margin: 50px auto;
  padding: 20px;
}

.header {
  background: white;
  padding: 30px;
  border-radius: 14px;
  box-shadow: 0 5px 25px rgba(0,0,0,0.08);
  margin-bottom: 25px;
}

.header h1 {
  margin: 0 0 8px 0;
  font-size: 28px;
}

.header p {
  margin: 0;
  color: #6b7280;
}

.card {
  background: white;
  padding: 30px;
  border-radius: 14px;
  box-shadow: 0 5px 25px rgba(0,0,0,0.08);
}

.busca {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.busca input {
  flex: 1;
  padding: 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 16px;
}

button {
  border: none;
  border-radius: 8px;
  padding: 14px 22px;
  background: #2563eb;
  color: white;
  font-weight: bold;
  cursor: pointer;
}

button:hover {
  background: #1d4ed8;
}

.resultado {
  margin-top: 25px;
}

.paciente {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: 0.15s;
}

.paciente:hover {
  background: #f8fafc;
  border-color: #2563eb;
}

.paciente-nome {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 7px;
}

.paciente-info {
  color: #6b7280;
  font-size: 14px;
}

.vazio {
  padding: 25px;
  text-align: center;
  color: #6b7280;
}

.loading {
  padding: 25px;
  text-align: center;
}

.acoes {
  margin-top: 20px;
}

.secundario {
  background: #6b7280;
}

.secundario:hover {
  background: #4b5563;
}

hr {
  border: 0;
  border-top: 1px solid #e5e7eb;
  margin: 25px 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 10px;
  border-bottom: 1px solid #eee;
  text-align: left;
}

</style>

</head>

<body>

<div class="container">

  <div class="header">

    <h1>
      Laboratorio Maiolini e Miranda
    </h1>

    <p>
      Portal de exames laboratoriais
    </p>

  </div>

  <div class="card">

    <h2>
      Buscar paciente
    </h2>

    <p>
      Digite o nome do paciente ou código.
    </p>

    <div class="busca">

      <input
        id="termo"
        type="text"
        placeholder="Nome ou código do paciente"
        autocomplete="off"
      >

      <button onclick="buscar()">
        BUSCAR
      </button>

    </div>

    <div
      id="resultado"
      class="resultado"
    ></div>

  </div>

</div>

<script>

var campo = document.getElementById("termo");

var resultado = document.getElementById("resultado");

// ========================================
// ENTER
// ========================================

campo.addEventListener("keydown", function(event) {

  if (event.key === "Enter") {
    buscar();
  }

});

// ========================================
// ESCAPAR HTML
// ========================================

function escapar(valor) {

  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}

// ========================================
// DATA
// ========================================

function formatarData(data) {

  if (!data) {
    return "-";
  }

  var partes = String(data)
    .substring(0, 10)
    .split("-");

  if (partes.length !== 3) {
    return data;
  }

  return partes[2] + "/" + partes[1] + "/" + partes[0];

}

// ========================================
// BUSCAR PACIENTES
// ========================================

async function buscar() {

  var termo = campo.value.trim();

  if (!termo) {

    resultado.innerHTML =
      '<div class="vazio">' +
      'Digite o nome ou código do paciente.' +
      '</div>';

    return;
  }

  resultado.innerHTML =
    '<div class="loading">Buscando...</div>';

  try {

    var resposta = await fetch(
      "/api/pacientes?termo=" +
      encodeURIComponent(termo)
    );

    var dados = await resposta.json();

    if (!dados.sucesso) {
      throw new Error(
        dados.mensagem || "Erro ao buscar pacientes."
      );
    }

    if (!dados.pacientes || dados.pacientes.length === 0) {

      resultado.innerHTML =
        '<div class="vazio">' +
        'Nenhum paciente encontrado.' +
        '</div>';

      return;
    }

    var html = "";

    dados.pacientes.forEach(function(paciente) {

      html +=
        '<div class="paciente" ' +
        'onclick="abrirPaciente(' + paciente.id + ')">' +

        '<div class="paciente-nome">' +
        escapar(paciente.nome) +
        '</div>' +

        '<div class="paciente-info">' +

        'Código: ' +
        escapar(paciente.codigo_externo || "-") +

        ' &nbsp; • &nbsp; ' +

        paciente.quantidade_pedidos +
        ' pedido(s)' +

        '</div>' +

        '</div>';

    });

    resultado.innerHTML = html;

  } catch (erro) {

    resultado.innerHTML =
      '<div class="vazio">' +
      'Erro: ' +
      escapar(erro.message) +
      '</div>';

  }

}

// ========================================
// PEDIDOS DO PACIENTE
// ========================================

async function abrirPaciente(pacienteId) {

  resultado.innerHTML =
    '<div class="loading">' +
    'Carregando pedidos...' +
    '</div>';

  try {

    var resposta = await fetch(
      "/api/pacientes/" +
      pacienteId +
      "/pedidos"
    );

    var dados = await resposta.json();

    if (!dados.sucesso) {
      throw new Error(dados.mensagem);
    }

    var html =
      '<h2>Pedidos do paciente</h2>';

    if (!dados.pedidos || dados.pedidos.length === 0) {

      html +=
        '<div class="vazio">' +
        'Nenhum pedido encontrado.' +
        '</div>';

    } else {

      dados.pedidos.forEach(function(pedido) {

        html +=
          '<div class="paciente" ' +
          'onclick="abrirPedido(' + pedido.id + ')">' +

          '<div class="paciente-nome">' +

          'Pedido: ' +
          escapar(pedido.numero_pedido) +

          '</div>' +

          '<div class="paciente-info">' +

          'Coleta: ' +
          formatarData(pedido.data_coleta) +

          ' &nbsp; • &nbsp; ' +

          pedido.quantidade_exames +
          ' exame(s)' +

          '</div>' +

          '</div>';

      });

    }

    html +=
      '<div class="acoes">' +

      '<button class="secundario" onclick="buscar()">' +

      '← VOLTAR' +

      '</button>' +

      '</div>';

    resultado.innerHTML = html;

  } catch (erro) {

    resultado.innerHTML =
      '<div class="vazio">' +
      'Erro: ' +
      escapar(erro.message) +
      '</div>';

  }

}

// ========================================
// PEDIDO COMPLETO
// ========================================

async function abrirPedido(pedidoId) {

  resultado.innerHTML =
    '<div class="loading">' +
    'Carregando exames...' +
    '</div>';

  try {

    var resposta = await fetch(
      "/api/pedidos/" + pedidoId
    );

    var dados = await resposta.json();

    if (!dados.sucesso) {
      throw new Error(dados.mensagem);
    }

    var pedido = dados.pedido;

    var html =
      '<h2>' +
      escapar(pedido.paciente_nome) +
      '</h2>';

    html +=
      '<p>' +
      '<strong>Pedido:</strong> ' +
      escapar(pedido.numero_pedido) +
      '</p>';

    html +=
      '<p>' +
      '<strong>Data da coleta:</strong> ' +
      formatarData(pedido.data_coleta) +
      '</p>';

    html += '<hr>';

    if (!pedido.exames || pedido.exames.length === 0) {

      html +=
        '<div class="vazio">' +
        'Nenhum exame encontrado.' +
        '</div>';

    }

    pedido.exames.forEach(function(exame) {

      html +=
        '<div class="paciente" style="cursor:default">';

      html +=
        '<div class="paciente-nome">' +
        escapar(exame.nome) +
        '</div>';

      if (exame.material) {

        html +=
          '<div class="paciente-info">' +
          '<strong>Material:</strong> ' +
          escapar(exame.material) +
          '</div>';

      }

      if (exame.metodo) {

        html +=
          '<div class="paciente-info">' +
          '<strong>Método:</strong> ' +
          escapar(exame.metodo) +
          '</div>';

      }

      if (
        exame.itens &&
        exame.itens.length > 0
      ) {

        html +=
          '<div style="margin-top:15px;overflow-x:auto">' +

          '<table>' +

          '<thead>' +

          '<tr>' +

          '<th>Exame</th>' +
          '<th>Resultado</th>' +
          '<th>Referência</th>' +

          '</tr>' +

          '</thead>' +

          '<tbody>';

        exame.itens.forEach(function(item) {

          html +=
            '<tr>' +

            '<td>' +
            escapar(item.nome) +
            '</td>' +

            '<td><strong>' +
            escapar(item.resultado || "-") +
            '</strong></td>' +

            '<td>' +
            escapar(item.referencia || "-") +
            '</td>' +

            '</tr>';

        });

        html +=
          '</tbody>' +
          '</table>' +
          '</div>';

      } else {

        if (exame.resultado_texto) {

          html +=
            '<div style="' +
            'margin-top:15px;' +
            'padding:15px;' +
            'background:#f8fafc;' +
            'border-radius:8px;' +
            '">' +

            '<strong>Resultado:</strong> ' +

            escapar(exame.resultado_texto) +

            '</div>';

        }

        if (exame.referencia_texto) {

          html +=
            '<div style="' +
            'margin-top:10px;' +
            'color:#6b7280;' +
            '">' +

            '<strong>Referência:</strong> ' +

            escapar(exame.referencia_texto) +

            '</div>';

        }

      }

      if (exame.observacoes) {

        html +=
          '<div style="' +
          'margin-top:15px;' +
          'color:#6b7280;' +
          '">' +

          '<strong>Observações:</strong><br>' +

          escapar(exame.observacoes) +

          '</div>';

      }

      html += '</div>';

    });

    html +=
      '<div class="acoes">' +

      '<button ' +
      'class="secundario" ' +
      'onclick="buscar()">' +

      '← NOVA BUSCA' +

      '</button>' +

      '</div>';

    resultado.innerHTML = html;

  } catch (erro) {

    resultado.innerHTML =
      '<div class="vazio">' +
      'Erro: ' +
      escapar(erro.message) +
      '</div>';

  }

}

</script>

</body>

</html>
  `);

});

// ========================================
// TESTE DO POSTGRES
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
// BUSCAR PACIENTES
// ========================================

app.get("/api/pacientes", async (req, res) => {

  try {

    const termo = String(
      req.query.termo || ""
    ).trim();

    if (!termo) {

      return res.status(400).json({
        sucesso: false,
        mensagem: "Informe um nome ou código."
      });

    }

    const pacientes =
      await buscarPacientes(termo);

    res.json({
      sucesso: true,
      pacientes
    });

  } catch (error) {

    console.error(
      "Erro ao buscar pacientes:",
      error
    );

    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao buscar pacientes.",
      erro: error.message
    });

  }

});

// ========================================
// PEDIDOS DO PACIENTE
// ========================================

app.get(
  "/api/pacientes/:id/pedidos",
  async (req, res) => {

    try {

      const pacienteId =
        Number(req.params.id);

      if (!Number.isInteger(pacienteId)) {

        return res.status(400).json({
          sucesso: false,
          mensagem: "ID do paciente inválido."
        });

      }

      const pedidos =
        await buscarPedidosPorPaciente(
          pacienteId
        );

      res.json({
        sucesso: true,
        pedidos
      });

    } catch (error) {

      console.error(
        "Erro ao buscar pedidos:",
        error
      );

      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao buscar pedidos.",
        erro: error.message
      });

    }

  }
);

// ========================================
// PEDIDO COMPLETO
// ========================================

app.get(
  "/api/pedidos/:id",
  async (req, res) => {

    try {

      const pedidoId =
        Number(req.params.id);

      if (!Number.isInteger(pedidoId)) {

        return res.status(400).json({
          sucesso: false,
          mensagem: "ID do pedido inválido."
        });

      }

      const pedido =
        await buscarPedido(pedidoId);

      if (!pedido) {

        return res.status(404).json({
          sucesso: false,
          mensagem: "Pedido não encontrado."
        });

      }

      res.json({
        sucesso: true,
        pedido
      });

    } catch (error) {

      console.error(
        "Erro ao buscar pedido:",
        error
      );

      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao buscar pedido.",
        erro: error.message
      });

    }

  }
);

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

body {
  margin: 0;
  font-family: Arial, Helvetica, sans-serif;
  background: #f4f6f8;
}

.container {
  max-width: 650px;
  margin: 60px auto;
  padding: 20px;
}

.card {
  background: white;
  padding: 35px;
  border-radius: 14px;
  box-shadow: 0 5px 25px rgba(0,0,0,0.08);
}

h1 {
  margin-top: 0;
}

input {
  width: 100%;
  padding: 12px;
  margin: 15px 0 25px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

button {
  width: 100%;
  padding: 15px;
  border: none;
  border-radius: 8px;
  background: #2563eb;
  color: white;
  font-weight: bold;
  cursor: pointer;
}

#resultado {
  margin-top: 20px;
  padding: 15px;
  background: #f1f5f9;
  border-radius: 8px;
  white-space: pre-wrap;
}

a {
  display: inline-block;
  margin-top: 20px;
  color: #2563eb;
}

</style>

</head>

<body>

<div class="container">

<div class="card">

<h1>
Importar exames
</h1>

<p>
Laboratorio Maiolini e Miranda
</p>

<form id="formulario">

<input
  id="arquivo"
  type="file"
  name="arquivo"
  accept=".txt"
  required
>

<button type="submit">
IMPORTAR EXAMES
</button>

</form>

<div
  id="resultado"
  style="display:none"
></div>

<a href="/">
← Voltar para busca
</a>

</div>

</div>

<script>

var formulario =
  document.getElementById("formulario");

var resultado =
  document.getElementById("resultado");

formulario.addEventListener(
  "submit",
  async function(event) {

    event.preventDefault();

    var arquivo =
      document.getElementById("arquivo").files[0];

    if (!arquivo) {
      return;
    }

    var dados = new FormData();

    dados.append("arquivo", arquivo);

    resultado.style.display = "block";

    resultado.textContent = "Importando...";

    try {

      var resposta = await fetch(
        "/importar",
        {
          method: "POST",
          body: dados
        }
      );

      var json =
        await resposta.json();

      resultado.textContent =
        JSON.stringify(
          json,
          null,
          2
        );

    } catch (error) {

      resultado.textContent =
        "Erro: " +
        error.message;

    }

  }
);

</script>

</body>

</html>
  `);

});

// ========================================
// IMPORTAÇÃO TXT
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

      const conteudo =
        req.file.buffer.toString("utf8");

      const pedidos =
        parseTXT(conteudo);

      if (
        !pedidos ||
        pedidos.length === 0
      ) {

        return res.status(400).json({
          sucesso: false,
          mensagem:
            "Nenhum pedido foi encontrado no arquivo."
        });

      }

      client =
        await pool.connect();

      await client.query("BEGIN");

      let pacientesInseridos = 0;
      let pacientesExistentes = 0;
      let pedidosInseridos = 0;
      let pedidosExistentes = 0;
      let examesInseridos = 0;
      let itensInseridos = 0;

      for (const pedidoData of pedidos) {

        const paciente =
          pedidoData.paciente;

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
              VALUES ($1, $2, $3, $4)
              RETURNING id
              `,
              [
                pacienteId,
                pedidoData.numeroPedido,
                paciente.dataEntrada,
                pedidoData.exames[0]
                  ? pedidoData.exames[0].dataColeta
                  : null
              ]
            );

          pedidoId =
            novoPedido.rows[0].id;

          pedidosInseridos++;

        }

        if (
          pedidoExistente.rows.length > 0
        ) {
          continue;
        }

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
                exame.unidade || null,
                exame.referenciaTexto,
                exame.observacoes
              ]
            );

          const exameId =
            novoExame.rows[0].id;

          examesInseridos++;

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
                VALUES ($1, $2, $3, $4, $5, $6)
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

      await client.query("COMMIT");

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
// ERROS
// ========================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    if (
      error instanceof multer.MulterError
    ) {

      return res.status(400).json({
        sucesso: false,
        mensagem: "Erro no upload do arquivo.",
        erro: error.message
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
      "Servidor iniciado na porta " + PORT
    );

  }
);
