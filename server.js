const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => { 
  res.send("Portal de Exames funcionando!");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
});
