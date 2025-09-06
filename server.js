// server.js
const express = require("express");
const routes = require("./routes");

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (_req, res) => res.send("W Group API is live 🚀"));
app.use(routes);

app.listen(port, () => console.log(`API running on port ${port}`));
