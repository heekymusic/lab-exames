function limparTexto(texto) {
  return texto
    .replace(/\r/g, "")
    .trim();
}

function extrairData(texto) {
  const match = texto.match(/DT\.COLETA:\s*(\d{2}\/\d{2}\/\d{4})/i);

  if (!match) {
    return null;
  }

  const [dia, mes, ano] = match[1].split("/");

  return `${ano}-${mes}-${dia}`;
}

function converterData(texto) {
  const match = texto.match(
    /\*+\s*(.*?)\s+\((\d+)\)\s+DT\.ENTRADA:\s*(\d{2}\/\d{2}\/\d{4})/
  );

  if (!match) {
    return null;
  }

  const [dia, mes, ano] = match[3].split("/");

  return {
    nome: match[1].trim(),
    codigoExterno: match[2],
    dataEntrada: `${ano}-${mes}-${dia}`
  };
}

function extrairPedido(texto) {
  const match = texto.match(
    /No\. Pedido no Conveniado:\s*(\d+)/
  );

  return match ? match[1] : null;
}

function extrairBlocosExames(bloco) {
  const linhas = bloco.split("\n");

  const exames = [];

  let exameAtual = null;
  let dentroNotas = false;
  let dentroReferencia = false;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];

    const exameMatch = linha.match(
      /^\s*EXAME:\s*(.*?)\s+DT\.COLETA:\s*(\d{2}\/\d{2}\/\d{4})/i
    );

    if (exameMatch) {
      if (exameAtual) {
        exames.push(exameAtual);
      }

      exameAtual = {
        nome: exameMatch[1].trim(),
        material: null,
        metodo: null,
        dataColeta: extrairData(linha),
        resultadoTexto: null,
        unidade: null,
        referenciaTexto: null,
        observacoes: null,
        itens: []
      };

      dentroNotas = false;
      dentroReferencia = false;

      continue;
    }

    if (!exameAtual) {
      continue;
    }

    const materialMatch = linha.match(
      /^\s*MATERIAL:\s*(.+)$/i
    );

    if (materialMatch) {
      exameAtual.material = materialMatch[1].trim();
      continue;
    }

    const metodoMatch = linha.match(
      /^\s*M[ÉE]TODO:\s*(.+)$/i
    );

    if (metodoMatch) {
      exameAtual.metodo = metodoMatch[1].trim();
      continue;
    }

    const resultadoMatch = linha.match(
      /^\s*RESULTADO:\s*(.+)$/i
    );

    if (resultadoMatch) {
      exameAtual.resultadoTexto = resultadoMatch[1].trim();
      continue;
    }

    const referenciaMatch = linha.match(
      /^\s*VALOR(?:ES)? DE REFER[ÊE]NCIA:\s*(.*)$/i
    );

    if (referenciaMatch) {
      dentroReferencia = true;

      const valor = referenciaMatch[1].trim();

      if (valor) {
        exameAtual.referenciaTexto = valor;
      } else {
        exameAtual.referenciaTexto = "";
      }

      continue;
    }

    const notasMatch = linha.match(
      /^\s*NOTA(?:S)?\s*:/i
    );

    if (notasMatch) {
      dentroNotas = true;
      dentroReferencia = false;
      exameAtual.observacoes = "";
      continue;
    }

    const obsMatch = linha.match(
      /^\s*OBS\.\s*:/i
    );

    if (obsMatch) {
      dentroNotas = true;
      dentroReferencia = false;

      if (exameAtual.observacoes === null) {
        exameAtual.observacoes = "";
      }

      continue;
    }

    /*
     * Hemograma e outros exames compostos.
     *
     * Exemplo:
     * Hemoglobina: 14,5 g/dl || 12,0 A 16,0 g/dl
     */
    const itemMatch = linha.match(
      /^\s*([^:]+?)\s*:\s*(.*?)\s*\|\|\s*(.*?)\s*$/
    );

    if (itemMatch) {
      const nome = itemMatch[1].trim();

      /*
       * Evita interpretar textos de referência
       * ou observações como itens.
       */
      if (
        nome &&
        !/^VALORES? DE REFER[ÊE]NCIA$/i.test(nome)
      ) {
        exameAtual.itens.push({
          nome,
          resultado: itemMatch[2].trim(),
          referencia: itemMatch[3].trim(),
          ordem: exameAtual.itens.length
        });
      }

      continue;
    }

    if (dentroNotas) {
      const texto = linha.trim();

      if (texto) {
        exameAtual.observacoes +=
          (exameAtual.observacoes ? "\n" : "") + texto;
      }

      continue;
    }

    if (dentroReferencia) {
      const texto = linha.trim();

      if (texto) {
        exameAtual.referenciaTexto +=
          (exameAtual.referenciaTexto ? "\n" : "") + texto;
      }
    }
  }

  if (exameAtual) {
    exames.push(exameAtual);
  }

  return exames;
}

function parseTXT(conteudo) {
  const texto = limparTexto(conteudo);

  /*
   * Cada paciente começa com uma linha no formato:
   *
   * * nome (codigo) DT.ENTRADA: data *
   */
  const regexPaciente =
    /\*+\s*.*?\s+\(\d+\)\s+DT\.ENTRADA:\s*\d{2}\/\d{2}\/\d{4}\s+\*?/gi;

  const ocorrencias = [];
  let match;

  while ((match = regexPaciente.exec(texto)) !== null) {
    ocorrencias.push({
      inicio: match.index,
      fim: regexPaciente.lastIndex,
      cabecalho: match[0]
    });
  }

  const pedidos = [];

  for (let i = 0; i < ocorrencias.length; i++) {
    const atual = ocorrencias[i];

    const fim =
      i + 1 < ocorrencias.length
        ? ocorrencias[i + 1].inicio
        : texto.length;

    const bloco = texto.slice(atual.inicio, fim);

    const paciente = converterData(atual.cabecalho);

    if (!paciente) {
      continue;
    }

    const numeroPedido = extrairPedido(bloco);

    if (!numeroPedido) {
      continue;
    }

    const exames = extrairBlocosExames(bloco);

    pedidos.push({
      paciente,
      numeroPedido,
      exames
    });
  }

  return pedidos;
}

module.exports = {
  parseTXT
};
