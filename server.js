const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "clients.json");

app.use(cors()); // allow requests from your Netlify frontend
app.use(express.json()); // parse JSON bodies

// POST endpoint to receive client data (register)
app.post("/register", (req, res) => {
  const newClient = req.body;

  fs.readFile(DATA_FILE, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error reading data file");

    let clients = [];
    try {
      clients = JSON.parse(data);
    } catch (e) {
      return res.status(500).send("Error parsing JSON");
    }

    clients.push(newClient);

    fs.writeFile(DATA_FILE, JSON.stringify(clients, null, 2), (err) => {
      if (err) return res.status(500).send("Error saving client");
      res.status(200).send("Client registered successfully");
    });
  });
});

// POST endpoint to check if client exists (login)
app.post("/login", (req, res) => {
  const { phone } = req.body;

  fs.readFile(DATA_FILE, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error reading data file");

    let clients = [];
    try {
      clients = JSON.parse(data);
    } catch (e) {
      return res.status(500).send("Error parsing JSON");
    }

    const client = clients.find((c) => c.phone === phone);

    if (client) {
      res.status(200).json({ exists: true, client });
    } else {
      res.status(200).json({ exists: false });
    }
  });
});

// DOWNLOAD clients.json FILE
app.get("/download-data", (req, res) => {
  res.download(DATA_FILE, "clients.json", (err) => {
    if (err) {
      console.error("Download error:", err);
      res.status(500).send("Download failed.");
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
