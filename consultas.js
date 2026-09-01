const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,

  // Evita ficar travado indefinidamente
  connectionTimeoutMillis: 10000,

  // Cancela consulta que demorar mais de 15 segundos
  statement_timeout: 15000
});


// ========================================
// BUSCAR PACIENTES
// ========================================

async function buscarPacientes(termo) {

  const busca = `%${String(termo || "").trim()}%`;

  const resultado = await pool.query(
    `
    SELECT
      p.id,
      p.nome,
      p.codigo_externo,

      (
        SELECT COUNT(*)::integer
        FROM pedidos pe
        WHERE pe.paciente_id = p.id
      ) AS quantidade_pedidos

    FROM pacientes p

    WHERE
      p.nome ILIKE $1
      OR CAST(p.codigo_externo AS TEXT) ILIKE $1

    ORDER BY
      p.nome ASC

    LIMIT 50
    `,
    [busca]
  );

  return resultado.rows;
}


// ========================================
// BUSCAR PEDIDOS DE UM PACIENTE
// ========================================

async function buscarPedidosPorPaciente(pacienteId) {

  const resultado = await pool.query(
    `
    SELECT
      pe.id,
      pe.numero_pedido,
      pe.data_entrada,
      pe.data_coleta,

      (
        SELECT COUNT(*)::integer
        FROM exames e
        WHERE e.pedido_id = pe.id
      ) AS quantidade_exames

    FROM pedidos pe

    WHERE
      pe.paciente_id = $1

    ORDER BY
      pe.data_coleta DESC NULLS LAST,
      pe.id DESC
    `,
    [pacienteId]
  );

  return resultado.rows;
}


// ========================================
// BUSCAR UM PEDIDO COMPLETO
// ========================================

async function buscarPedido(pedidoId) {

  // ----------------------------------------
  // DADOS DO PEDIDO + PACIENTE
  // ----------------------------------------

  const pedidoResult = await pool.query(
    `
    SELECT
      pe.id,
      pe.numero_pedido,
      pe.data_entrada,
      pe.data_coleta,

      p.id AS paciente_id,
      p.nome AS paciente_nome,
      p.codigo_externo AS paciente_codigo

    FROM pedidos pe

    INNER JOIN pacientes p
      ON p.id = pe.paciente_id

    WHERE
      pe.id = $1

    LIMIT 1
    `,
    [pedidoId]
  );


  // Pedido não encontrado

  if (pedidoResult.rows.length === 0) {
    return null;
  }


  const pedido = pedidoResult.rows[0];


  // ========================================
  // EXAMES
  // ========================================

  const examesResult = await pool.query(
    `
    SELECT
      e.id,
      e.nome,
      e.material,
      e.metodo,
      e.resultado_texto,
      e.unidade,
      e.referencia_texto,
      e.observacoes

    FROM exames e

    WHERE
      e.pedido_id = $1

    ORDER BY
      e.id ASC
    `,
    [pedidoId]
  );


  // ========================================
  // ITENS DOS EXAMES
  // ========================================

  const itensResult = await pool.query(
    `
    SELECT
      ei.id,
      ei.exame_id,
      ei.nome,
      ei.resultado,
      ei.unidade,
      ei.referencia,
      ei.ordem

    FROM exame_itens ei

    INNER JOIN exames e
      ON e.id = ei.exame_id

    WHERE
      e.pedido_id = $1

    ORDER BY
      ei.exame_id ASC,
      ei.ordem ASC,
      ei.id ASC
    `,
    [pedidoId]
  );


  // ========================================
  // ASSOCIAR ITENS AOS EXAMES
  // ========================================

  const exames = examesResult.rows.map(function(exame) {

    const itens = itensResult.rows.filter(function(item) {

      return Number(item.exame_id) === Number(exame.id);

    });


    return {
      ...exame,
      itens
    };

  });


  // ========================================
  // RETORNO FINAL
  // ========================================

  return {
    ...pedido,
    exames
  };
}


// ========================================
// EXPORTAR FUNÇÕES
// ========================================

module.exports = {
  buscarPacientes,
  buscarPedidosPorPaciente,
  buscarPedido
};
