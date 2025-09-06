// server.js
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (_req, res) => res.send("W Group API is live 🚀"));

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});
