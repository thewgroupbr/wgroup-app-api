const express = require("express");
const cors = require("cors"); // safe to keep
const routes = require("./routes");

const app = express();
app.use(cors());

// ✅ Fast always-200 healthcheck for Render
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

const port = process.env.PORT || 3000;

app.get("/", (_req, res) => res.send("W Group API is live 🚀"));
app.use(routes);

app.listen(port, () => console.log(`API running on port ${port}`));

