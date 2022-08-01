const express = require("express");
const app = express();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const kebabCase = require("lodash/kebabCase");
const imagesToPdf = require("images-to-pdf");
const archiver = require("archiver");
const cors = require("cors");
require("dotenv/config");

fs.mkdirSync("files", { recursive: true });
fs.mkdirSync("pdf", { recursive: true });
fs.mkdirSync("zip", { recursive: true });

app.use(cors({ origin: true }));
app.enable("trust proxy");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "files/");
  },
  filename: (req, file, cb) => {
    cb(
      null,
      `${Date.now()}-${kebabCase(
        path
          .parse(file.originalname)
          .name.normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/Đ/g, "D")
      )}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({ storage });

app.get("/", (req, res) => {
  res.send("Hello from converter server");
});

app.post("/pdf", upload.array("images"), async (req, res) => {
  try {
    const serverBaseUrl = `${req.protocol}://${req.get("host")}`;

    if (!req.files || req.files.length === 0)
      return res.status(400).send("No file");

    const pdfId = Math.random().toString(36).slice(-8);

    await imagesToPdf(
      req.files.map((file) => file.path),
      path.join(__dirname, "pdf", `${pdfId}.pdf`)
    );

    res.send(`${serverBaseUrl}/pdf/${pdfId}`);
  } catch (error) {
    console.log(error);
    if (!res.headersSent) res.sendStatus(500);
  }
});

app.get("/pdf/:id", (req, res) => {
  try {
    const filePath = path.join(__dirname, "pdf", `${req.params.id}.pdf`);
    const exists = fs.existsSync(filePath);

    if (!exists) return res.status(404).send("File not found");

    res.download(filePath);
  } catch (error) {
    console.log(error);
    if (!res.headersSent) res.sendStatus(500);
  }
});

app.post("/zip", upload.array("images"), async (req, res) => {
  try {
    const serverBaseUrl = `${req.protocol}://${req.get("host")}`;

    if (!req.files || req.files.length === 0)
      return res.status(400).send("No file");

    const zipId = Math.random().toString(36).slice(-8);

    const output = fs.createWriteStream(
      path.join(__dirname, "zip", `${zipId}.zip`)
    );
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    archive.pipe(output);

    archive.on("finish", () => {
      res.send(`${serverBaseUrl}/zip/${zipId}`);
    });

    req.files.forEach((file) => {
      archive.file(file.path, { name: file.originalname });
    });

    archive.finalize();
  } catch (error) {
    console.log(error);
    if (!res.headersSent) res.sendStatus(500);
  }
});

app.get("/zip/:id", (req, res) => {
  try {
    const filePath = path.join(__dirname, "zip", `${req.params.id}.zip`);
    const exists = fs.existsSync(filePath);

    if (!exists) return res.status(404).send("File not found");

    res.download(filePath);
  } catch (error) {
    console.log(error);
    if (!res.headersSent) res.sendStatus(500);
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server is listening on port ${port}`));
