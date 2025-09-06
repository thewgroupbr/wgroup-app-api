const express = require("express");
const cors = require("cors");                // make sure this line exists
const routes = require("./routes");

const app = express();

// Allow requests from your dashboard/local dev
app.use(cors());                             // simple allow-all (fine for now)

// Fast 200 healthcheck so Render marks service healthy
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

app.get("/", (_req, res) => res.send("W Group API is live 🚀"));
app.use(routes);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API running on port ${port}`));
