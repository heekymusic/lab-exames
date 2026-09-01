const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');

const { parseTXT } = require('./parser');

const {
  buscarPacientes,
  buscarPedidosPorPaciente,
  buscarPedido
} = require('./consultas');

const app = express();

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  connectionTimeoutMillis: 10000,
  query_timeout: 15000,
  statement_timeout: 15000
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: function(req, file, cb) {
    if (!file.originalname.toLowerCase().endsWith('.txt')) {
      return cb(new Error('Apenas arquivos TXT são permitidos.'));
    }

    cb(null, true);
  }
});

app.use(express.json());

function escapar(valor) {
  if (valor === null || valor === undefined) {
    return '';
  }

  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatarData(data) {
  if (!data) {
    return '-';
  }

  const texto = String(data);
  const partes = texto.substring(0, 10).split('-');

  if (partes.length !== 3) {
    return texto;
  }

  return partes[2] + '/' + partes[1] + '/' + partes[0];
}

/* ======================================================
   PÁGINA PRINCIPAL
====================================================== */

app.get('/', function(req, res) {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>Laboratório Maiolini e Miranda</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #f3f5f8;
  color: #172033;
  font-family: Arial, Helvetica, sans-serif;
}

button,
input {
  font-family: inherit;
}

.topbar {
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
}

.topbar-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 22px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-logo {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: #1769e0;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 18px;
}

.brand-name {
  font-size: 19px;
  font-weight: 700;
}

.brand-subtitle {
  margin-top: 3px;
  color: #6b7280;
  font-size: 13px;
}

.container {
  max-width: 1120px;
  margin: 0 auto;
  padding: 36px 24px 60px;
}

.search-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06);
}

.search-title {
  margin: 0;
  font-size: 25px;
}

.search-description {
  margin: 8px 0 24px;
  color: #64748b;
}

.search-row {
  display: flex;
  gap: 12px;
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 52px;
  padding: 0 16px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-size: 16px;
  outline: none;
}

.search-input:focus {
  border-color: #1769e0;
  box-shadow: 0 0 0 3px rgba(23, 105, 224, 0.10);
}

.primary-button {
  height: 52px;
  padding: 0 26px;
  border: 0;
  border-radius: 10px;
  background: #1769e0;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
}

.primary-button:hover {
  background: #1258bd;
}

.results {
  margin-top: 24px;
}

.patient-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 12px;
  cursor: pointer;
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease,
    border-color 0.12s ease;
}

.patient-card:hover {
  transform: translateY(-1px);
  border-color: #1769e0;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.07);
}

.patient-name {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 7px;
}

.patient-info {
  color: #64748b;
  font-size: 14px;
}

.patient-arrow {
  float: right;
  color: #1769e0;
  font-size: 22px;
}

.message {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 22px;
  text-align: center;
  color: #64748b;
}

.order-header {
  margin-top: 24px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  overflow: hidden;
}

.order-header-main {
  padding: 28px 30px;
}

.order-label {
  color: #1769e0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.order-patient {
  margin: 7px 0 20px;
  font-size: 27px;
}

.order-details {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
}

.order-detail {
  min-width: 150px;
}

.order-detail-label {
  display: block;
  color: #64748b;
  font-size: 12px;
  margin-bottom: 5px;
}

.order-detail-value {
  font-weight: 700;
}

.actions {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}

.secondary-button {
  height: 44px;
  padding: 0 18px;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  background: #ffffff;
  color: #334155;
  font-weight: 700;
  cursor: pointer;
}

.secondary-button:hover {
  background: #f8fafc;
}

.print-button {
  height: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 9px;
  background: #172033;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
}

.print-button:hover {
  background: #0f172a;
}

.exam-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.exam-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
}

.exam-header {
  padding: 20px 22px 16px;
  border-bottom: 1px solid #edf2f7;
}

.exam-name {
  margin: 0;
  font-size: 19px;
  color: #172033;
}

.exam-meta {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  color: #64748b;
  font-size: 13px;
}

.exam-body {
  padding: 20px 22px;
}

.result-box {
  background: #f1f6ff;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  padding: 17px;
  margin-bottom: 17px;
}

.result-label {
  display: block;
  color: #64748b;
  font-size: 12px;
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 6px;
}

.result-value {
  font-size: 20px;
  font-weight: 700;
  color: #1455a5;
}

.exam-info {
  margin-top: 14px;
}

.exam-info-label {
  display: block;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 5px;
}

.exam-info-text {
  color: #334155;
  line-height: 1.55;
  white-space: pre-line;
}

.item-table-wrapper {
  overflow-x: auto;
  margin-top: 10px;
}

.item-table {
  width: 100%;
  border-collapse: collapse;
}

.item-table th {
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  text-transform: uppercase;
  text-align: left;
  padding: 11px;
  border-bottom: 1px solid #e2e8f0;
}

.item-table td {
  padding: 12px 11px;
  border-bottom: 1px solid #edf2f7;
  vertical-align: top;
}

.item-table td:nth-child(2) {
  font-weight: 700;
}

.footer {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 24px 35px;
  text-align: center;
  color: #94a3b8;
  font-size: 12px;
}

@media (max-width: 700px) {

  .topbar-inner {
    padding: 17px;
  }

  .container {
    padding: 20px 14px 40px;
  }

  .search-card {
    padding: 22px;
  }

  .search-row {
    flex-direction: column;
  }

  .primary-button {
    width: 100%;
  }

  .order-header-main {
    padding: 22px;
  }

  .order-patient {
    font-size: 23px;
  }

  .actions {
    flex-direction: column;
  }

  .secondary-button,
  .print-button {
    width: 100%;
  }

  .exam-header,
  .exam-body {
    padding: 17px;
  }

}

/* ======================================================
   IMPRESSÃO
   ====================================================== */

@page {
  size: A4 portrait;
  margin: 12mm;
}

@media print {

  html,
  body {
    background: #ffffff !important;
    margin: 0;
    padding: 0;
  }

  .topbar {
    display: none !important;
  }

  /*
   * IMPORTANTE:
   * O resultado dos exames fica dentro de .search-card.
   * Não escondemos mais .search-card.
   * Escondemos somente os elementos de busca.
   */

  .search-card {
    display: block !important;
    max-width: none !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: #ffffff !important;
  }

  .search-title,
  .search-description,
  .search-row {
    display: none !important;
  }

  .results {
    display: block !important;
    margin: 0 !important;
  }

  .container {
    max-width: none !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .actions {
    display: none !important;
  }

  .order-header {
    margin-top: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    overflow: visible !important;
  }

  .order-header-main {
    padding: 0 0 12px !important;
  }

  .order-label {
    color: #000000 !important;
  }

  .order-patient {
    font-size: 22px !important;
  }

  .order-details {
    gap: 20px;
  }

  .exam-list {
    display: flex !important;
    gap: 10px !important;
  }

  .exam-card {
    border: 1px solid #cbd5e1 !important;
    border-radius: 6px !important;
    box-shadow: none !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  .exam-header {
    padding: 12px 14px 10px !important;
  }

  .exam-body {
    padding: 12px 14px !important;
  }

  .result-box {
    background: #ffffff !important;
    border: 1px solid #cbd5e1 !important;
  }

  .item-table-wrapper {
    overflow: visible !important;
  }

  .item-table {
    width: 100% !important;
  }

  .item-table th,
  .item-table td {
    font-size: 10px !important;
    padding: 6px !important;
  }

  .exam-info-text {
    line-height: 1.35 !important;
  }

  .footer {
    display: none !important;
  }

}

</style>

</head>

<body>

<header class="topbar">

  <div class="topbar-inner">

    <div class="brand">

      <div class="brand-logo">
        LM
      </div>

      <div>

        <div class="brand-name">
          Laboratório Maiolini e Miranda
        </div>

        <div class="brand-subtitle">
          Portal de exames laboratoriais
        </div>

      </div>

    </div>

  </div>

</header>

<main class="container">

  <section class="search-card">

    <h1 class="search-title">
      Buscar paciente
    </h1>

    <p class="search-description">
      Digite o nome do paciente ou código.
    </p>

    <div class="search-row">

      <input
        id="termo"
        class="search-input"
        type="text"
        placeholder="Nome ou código do paciente"
        autocomplete="off"
      >

      <button
        class="primary-button"
        onclick="buscar()"
      >
        BUSCAR
      </button>

    </div>

    <div
      id="resultado"
      class="results"
    ></div>

  </section>

</main>

<footer class="footer">
  Laboratório Maiolini e Miranda
</footer>

<script>

function escapar(valor) {

  if (valor === null || valor === undefined) {
    return '';
  }

  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}

var campo =
  document.getElementById('termo');

var resultado =
  document.getElementById('resultado');

campo.addEventListener(
  'keydown',
  function(event) {

    if (event.key === 'Enter') {
      buscar();
    }

  }
);

async function buscarComTimeout(url, opcoes) {

  var controlador = new AbortController();

  var tempoLimite = setTimeout(
    function() {
      controlador.abort();
    },
    20000
  );

  try {

    var configuracao = opcoes || {};

    configuracao.signal = controlador.signal;

    return await fetch(url, configuracao);

  } finally {

    clearTimeout(tempoLimite);

  }

}

async function buscar() {

  var termo =
    campo.value.trim();

  if (!termo) {

    resultado.innerHTML =
      '<div class="message">' +
      'Digite o nome ou código do paciente.' +
      '</div>';

    return;
  }

  resultado.innerHTML =
    '<div class="message">Buscando...</div>';

  try {

    var resposta =
      await buscarComTimeout(
        '/api/pacientes?termo=' +
        encodeURIComponent(termo)
      );

    var dados =
      await resposta.json();

    if (!dados.sucesso) {

      throw new Error(
        dados.mensagem ||
        'Erro ao buscar pacientes.'
      );

    }

    if (
      !dados.pacientes ||
      dados.pacientes.length === 0
    ) {

      resultado.innerHTML =
        '<div class="message">' +
        'Nenhum paciente encontrado.' +
        '</div>';

      return;
    }

    var html = '';

    dados.pacientes.forEach(
      function(paciente) {

        html +=
          '<div ' +
          'class="patient-card" ' +
          'onclick="abrirPaciente(' +
          paciente.id +
          ')">' +

          '<span class="patient-arrow">›</span>' +

          '<div class="patient-name">' +
          escapar(paciente.nome) +
          '</div>' +

          '<div class="patient-info">' +

          'Código: ' +
          escapar(
            paciente.codigo_externo || '-'
          ) +

          ' &nbsp; • &nbsp; ' +

          paciente.quantidade_pedidos +

          ' pedido(s)' +

          '</div>' +

          '</div>';

      }
    );

    resultado.innerHTML = html;

  } catch (erro) {

    var mensagem =
      erro.name === 'AbortError'
        ? 'A busca demorou mais que o esperado. Tente novamente.'
        : erro.message;

    resultado.innerHTML =
      '<div class="message">' +
      'Erro: ' +
      escapar(mensagem) +
      '</div>';

  }

}

async function abrirPaciente(pacienteId) {

  resultado.innerHTML =
    '<div class="message">' +
    'Carregando pedidos...' +
    '</div>';

  try {

    var resposta =
      await fetch(
        '/api/pacientes/' +
        pacienteId +
        '/pedidos'
      );

    var dados =
      await resposta.json();

    if (!dados.sucesso) {

      throw new Error(
        dados.mensagem ||
        'Erro ao carregar pedidos.'
      );

    }

    var html = '';

    html +=
      '<div class="order-header">' +

      '<div class="order-header-main">' +

      '<div class="order-label">' +
      'Histórico do paciente' +
      '</div>' +

      '<h2 class="order-patient">' +
      'Pedidos encontrados' +
      '</h2>' +

      '</div>' +

      '</div>';

    html +=
      '<div class="actions">' +

      '<button ' +
      'class="secondary-button" ' +
      'onclick="voltarBusca()">' +

      '← VOLTAR' +

      '</button>' +

      '</div>';

    if (
      !dados.pedidos ||
      dados.pedidos.length === 0
    ) {

      html +=
        '<div class="message">' +
        'Nenhum pedido encontrado.' +
        '</div>';

    } else {

      dados.pedidos.forEach(
        function(pedido) {

          html +=
            '<div ' +
            'class="patient-card" ' +
            'onclick="abrirPedido(' +
            pedido.id +
            ')">' +

            '<span class="patient-arrow">›</span>' +

            '<div class="patient-name">' +

            'Pedido ' +

            escapar(
              pedido.numero_pedido
            ) +

            '</div>' +

            '<div class="patient-info">' +

            'Data da coleta: ' +

            formatarData(
              pedido.data_coleta
            ) +

            ' &nbsp; • &nbsp; ' +

            pedido.quantidade_exames +

            ' exame(s)' +

            '</div>' +

            '</div>';

        }
      );

    }

    resultado.innerHTML = html;

  } catch (erro) {

    resultado.innerHTML =
      '<div class="message">' +
      'Erro: ' +
      escapar(erro.message) +
      '</div>';

  }

}

async function abrirPedido(pedidoId) {

  resultado.innerHTML =
    '<div class="message">' +
    'Carregando resultado...' +
    '</div>';

  try {

    var resposta =
      await fetch(
        '/api/pedidos/' +
        pedidoId
      );

    var dados =
      await resposta.json();

    if (!dados.sucesso) {

      throw new Error(
        dados.mensagem ||
        'Erro ao carregar pedido.'
      );

    }

    var pedido =
      dados.pedido;

    var html = '';

    html +=
      '<div class="order-header">' +

      '<div class="order-header-main">' +

      '<div class="order-label">' +
      'Resultado de exames' +
      '</div>' +

      '<h2 class="order-patient">' +
      escapar(pedido.paciente_nome) +
      '</h2>' +

      '<div class="order-details">' +

      '<div class="order-detail">' +

      '<span class="order-detail-label">' +
      'Pedido' +
      '</span>' +

      '<span class="order-detail-value">' +
      escapar(pedido.numero_pedido) +
      '</span>' +

      '</div>' +

      '<div class="order-detail">' +

      '<span class="order-detail-label">' +
      'Data da coleta' +
      '</span>' +

      '<span class="order-detail-value">' +
      formatarData(pedido.data_coleta) +
      '</span>' +

      '</div>' +

      '</div>' +

      '</div>' +

      '</div>';

    html +=
      '<div class="actions">' +

      '<button ' +
      'class="secondary-button" ' +
      'onclick="voltarBusca()">' +

      '← NOVA BUSCA' +

      '</button>' +

      '<button ' +
      'class="print-button" ' +
      'onclick="window.print()">' +

      'IMPRIMIR RESULTADO' +

      '</button>' +

      '</div>';

    html +=
      '<div class="exam-list">';

    if (
      !pedido.exames ||
      pedido.exames.length === 0
    ) {

      html +=
        '<div class="message">' +
        'Nenhum exame encontrado neste pedido.' +
        '</div>';

    } else {

      pedido.exames.forEach(
        function(exame) {

          html +=
            '<article class="exam-card">';

          html +=
            '<div class="exam-header">' +

            '<h3 class="exam-name">' +
            escapar(exame.nome) +
            '</h3>';

          var temMeta =
            exame.material ||
            exame.metodo;

          if (temMeta) {

            html +=
              '<div class="exam-meta">';

            if (exame.material) {

              html +=
                '<span>' +
                '<strong>Material:</strong> ' +
                escapar(exame.material) +
                '</span>';

            }

            if (exame.metodo) {

              html +=
                '<span>' +
                '<strong>Método:</strong> ' +
                escapar(exame.metodo) +
                '</span>';

            }

            html +=
              '</div>';

          }

          html +=
            '</div>';

          html +=
            '<div class="exam-body">';

          if (
            exame.itens &&
            exame.itens.length > 0
          ) {

            html +=
              '<div class="item-table-wrapper">' +

              '<table class="item-table">' +

              '<thead>' +

              '<tr>' +

              '<th>Exame</th>' +
              '<th>Resultado</th>' +
              '<th>Unidade</th>' +
              '<th>Referência</th>' +

              '</tr>' +

              '</thead>' +

              '<tbody>';

            exame.itens.forEach(
              function(item) {

                html +=
                  '<tr>' +

                  '<td>' +
                  escapar(item.nome) +
                  '</td>' +

                  '<td>' +
                  escapar(
                    item.resultado || '-'
                  ) +
                  '</td>' +

                  '<td>' +
                  escapar(
                    item.unidade || '-'
                  ) +
                  '</td>' +

                  '<td>' +
                  escapar(
                    item.referencia || '-'
                  ) +
                  '</td>' +

                  '</tr>';

              }
            );

            html +=
              '</tbody>' +
              '</table>' +
              '</div>';

          } else {

            if (exame.resultado_texto) {

              html +=
                '<div class="result-box">' +

                '<span class="result-label">' +
                'Resultado' +
                '</span>' +

                '<div class="result-value">' +

                escapar(
                  exame.resultado_texto
                ) +

                (
                  exame.unidade
                    ? ' ' +
                      escapar(exame.unidade)
                    : ''
                ) +

                '</div>' +

                '</div>';

            }

            if (exame.referencia_texto) {

              html +=
                '<div class="exam-info">' +

                '<span class="exam-info-label">' +
                'Referência' +
                '</span>' +

                '<div class="exam-info-text">' +

                escapar(
                  exame.referencia_texto
                ) +

                '</div>' +

                '</div>';

            }

          }

          if (exame.observacoes) {

            html +=
              '<div class="exam-info">' +

              '<span class="exam-info-label">' +
              'Observações' +
              '</span>' +

              '<div class="exam-info-text">' +

              escapar(
                exame.observacoes
              ) +

              '</div>' +

              '</div>';

          }

          html +=
            '</div>' +

            '</article>';

        }
      );

    }

    html +=
      '</div>';

    resultado.innerHTML = html;

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

  } catch (erro) {

    resultado.innerHTML =
      '<div class="message">' +
      'Erro: ' +
      escapar(erro.message) +
      '</div>';

  }

}

function voltarBusca() {

  resultado.innerHTML = '';

  campo.focus();

}

</script>

</body>
</html>
  `);
});

/* ======================================================
   TESTE DO BANCO
====================================================== */

app.get('/db', async function(req, res) {

  try {

    const result =
      await pool.query(`
        SELECT
          NOW() AS horario,
          current_database() AS banco
      `);

    res.json({

      sucesso: true,

      mensagem:
        'PostgreSQL conectado com sucesso!',

      horario:
        result.rows[0].horario,

      banco:
        result.rows[0].banco

    });

  } catch (error) {

    console.error(
      'Erro PostgreSQL:',
      error
    );

    res.status(500).json({

      sucesso: false,

      mensagem:
        'Erro ao conectar ao PostgreSQL',

      erro:
        error.message

    });

  }

});

/* ======================================================
   BUSCAR PACIENTES
====================================================== */

app.get(
  '/api/pacientes',
  async function(req, res) {

    try {

      const termo =
        String(
          req.query.termo || ''
        ).trim();

      if (!termo) {

        return res.status(400).json({

          sucesso: false,

          mensagem:
            'Informe um nome ou código.'

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
        'Erro ao buscar pacientes:',
        error
      );

      res.status(500).json({

        sucesso: false,

        mensagem:
          'Erro ao buscar pacientes.',

        erro:
          error.message

      });

    }

  }
);

/* ======================================================
   PEDIDOS DO PACIENTE
====================================================== */

app.get(
  '/api/pacientes/:id/pedidos',
  async function(req, res) {

    try {

      const pacienteId =
        Number(req.params.id);

      if (
        !Number.isInteger(pacienteId)
      ) {

        return res.status(400).json({

          sucesso: false,

          mensagem:
            'ID do paciente inválido.'

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
        'Erro ao buscar pedidos:',
        error
      );

      res.status(500).json({

        sucesso: false,

        mensagem:
          'Erro ao buscar pedidos.',

        erro:
          error.message

      });

    }

  }
);

/* ======================================================
   PEDIDO COMPLETO
====================================================== */

app.get(
  '/api/pedidos/:id',
  async function(req, res) {

    try {

      const pedidoId =
        Number(req.params.id);

      if (
        !Number.isInteger(pedidoId)
      ) {

        return res.status(400).json({

          sucesso: false,

          mensagem:
            'ID do pedido inválido.'

        });

      }

      const pedido =
        await buscarPedido(pedidoId);

      if (!pedido) {

        return res.status(404).json({

          sucesso: false,

          mensagem:
            'Pedido não encontrado.'

        });

      }

      res.json({

        sucesso: true,

        pedido

      });

    } catch (error) {

      console.error(
        'Erro ao buscar pedido:',
        error
      );

      res.status(500).json({

        sucesso: false,

        mensagem:
          'Erro ao buscar pedido.',

        erro:
          error.message

      });

    }

  }
);

/* ======================================================
   PÁGINA DE IMPORTAÇÃO
====================================================== */

app.get(
  '/importar',
  function(req, res) {

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
  background: #f3f5f8;
  color: #172033;
  font-family: Arial, Helvetica, sans-serif;
}

.container {
  max-width: 650px;
  margin: 60px auto;
  padding: 20px;
}

.card {
  background: #ffffff;
  padding: 32px;
  border-radius: 16px;
  box-shadow:
    0 8px 30px rgba(15, 23, 42, 0.07);
}

h1 {
  margin-top: 0;
}

input {
  width: 100%;
  padding: 13px;
  margin: 15px 0 25px;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
}

button {
  width: 100%;
  padding: 14px;
  border: 0;
  border-radius: 9px;
  background: #1769e0;
  color: #ffffff;
  font-weight: bold;
  cursor: pointer;
}

#resultado {
  margin-top: 20px;
  padding: 15px;
  background: #f1f5f9;
  border-radius: 9px;
  white-space: pre-wrap;
}

a {
  display: inline-block;
  margin-top: 20px;
  color: #1769e0;
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
Laboratório Maiolini e Miranda
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
  document.getElementById('formulario');

var resultado =
  document.getElementById('resultado');

formulario.addEventListener(
  'submit',
  async function(event) {

    event.preventDefault();

    var arquivo =
      document
        .getElementById('arquivo')
        .files[0];

    if (!arquivo) {
      return;
    }

    var dados =
      new FormData();

    dados.append(
      'arquivo',
      arquivo
    );

    resultado.style.display =
      'block';

    resultado.textContent =
      'Importando...';

    try {

      var resposta =
        await fetch(
          '/importar',
          {
            method: 'POST',
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
        'Erro: ' +
        error.message;

    }

  }
);

</script>

</body>

</html>

    `);

  }
);

/* ======================================================
   IMPORTAR TXT
====================================================== */

app.post(
  '/importar',
  upload.single('arquivo'),
  async function(req, res) {

    if (!req.file) {

      return res.status(400).json({

        sucesso: false,

        mensagem:
          'Nenhum arquivo TXT foi enviado.'

      });

    }

    let client;

    try {

      const conteudo =
        req.file.buffer.toString('utf8');

      const pedidos =
        parseTXT(conteudo);

      if (
        !pedidos ||
        pedidos.length === 0
      ) {

        return res.status(400).json({

          sucesso: false,

          mensagem:
            'Nenhum pedido foi encontrado no arquivo.'

        });

      }

      client =
        await pool.connect();

      await client.query('BEGIN');

      let pacientesInseridos = 0;
      let pacientesExistentes = 0;
      let pedidosInseridos = 0;
      let pedidosExistentes = 0;
      let examesInseridos = 0;
      let itensInseridos = 0;

      for (
        const pedidoData of pedidos
      ) {

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
          const exame of pedidoData.exames
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
              const item of exame.itens
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

      await client.query('COMMIT');

      res.json({

        sucesso: true,

        mensagem:
          'Arquivo importado com sucesso!',

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

          await client.query(
            'ROLLBACK'
          );

        } catch (rollbackError) {

          console.error(
            'Erro no rollback:',
            rollbackError
          );

        }

      }

      console.error(
        'Erro na importação:',
        error
      );

      res.status(500).json({

        sucesso: false,

        mensagem:
          'Erro ao importar o arquivo.',

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

/* ======================================================
   ERROS DO UPLOAD
====================================================== */

app.use(
  function(error, req, res, next) {

    if (
      error instanceof multer.MulterError
    ) {

      return res.status(400).json({

        sucesso: false,

        mensagem:
          'Erro no upload do arquivo.',

        erro:
          error.message

      });

    }

    if (
      error &&
      error.message ===
      'Apenas arquivos TXT são permitidos.'
    ) {

      return res.status(400).json({

        sucesso: false,

        mensagem:
          'Somente arquivos TXT são permitidos.'

      });

    }

    next(error);

  }
);

/* ======================================================
   SERVIDOR
====================================================== */

app.listen(
  PORT,
  '0.0.0.0',
  function() {

    console.log(
      'Servidor iniciado na porta ' +
      PORT
    );

  }
);

