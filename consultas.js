const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false
});


// ========================================
// BUSCAR PACIENTES
// ========================================

async function buscarPacientes(termo) {

  const resultado = await pool.query(
    `
    SELECT
      p.id,
      p.nome,
      p.codigo_externo,
      COUNT(pe.id)::integer AS quantidade_pedidos
    FROM pacientes p
    LEFT JOIN pedidos pe
      ON pe.paciente_id = p.id
    WHERE
      p.nome ILIKE $1
      OR p.codigo_externo ILIKE $1
    GROUP BY
      p.id,
      p.nome,
      p.codigo_externo
    ORDER BY
      p.nome
    LIMIT 50
    `,
    [`%${termo}%`]
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
      COUNT(e.id)::integer AS quantidade_exames
    FROM pedidos pe
    LEFT JOIN exames e
      ON e.pedido_id = pe.id
    WHERE
      pe.paciente_id = $1
    GROUP BY
      pe.id,
      pe.numero_pedido,
      pe.data_entrada,
      pe.data_coleta
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

    WHERE pe.id = $1

    LIMIT 1
    `,
    [pedidoId]
  );


  if (pedidoResult.rows.length === 0) {
    return null;
  }


  const pedido = pedidoResult.rows[0];


  // ======================================
  // EXAMES
  // ======================================

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

    WHERE e.pedido_id = $1

    ORDER BY e.id
    `,
    [pedidoId]
  );


  // ======================================
  // ITENS DOS EXAMES
  // ======================================

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

    WHERE e.pedido_id = $1

    ORDER BY
      ei.exame_id,
      ei.ordem,
      ei.id
    `,
    [pedidoId]
  );


  // ======================================
  // ASSOCIAR ITENS AOS EXAMES
  // ======================================

  const exames = examesResult.rows.map((exame) => {

    const itens = itensResult.rows.filter(
      (item) => item.exame_id === exame.id
    );


    return {
      ...exame,
      itens
    };

  });


  return {
    ...pedido,
    exames
  };
}


module.exports = {
  buscarPacientes,
  buscarPedidosPorPaciente,
  buscarPedido
};
