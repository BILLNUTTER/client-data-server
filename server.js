const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const JSON_FILE = path.join(DATA_DIR, "clients.json");
const CSV_FILE = path.join(DATA_DIR, "clients.csv");

app.use(cors());
app.use(express.json());

// Ensure data directory and files exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(JSON_FILE)) fs.writeFileSync(JSON_FILE, "[]");
if (!fs.existsSync(CSV_FILE))
  fs.writeFileSync(CSV_FILE, "Name,Phone,RegistrationDate,ExpiryDate\n");

// Register
app.post("/register", (req, res) => {
  const { name, phone } = req.body;

  fs.readFile(JSON_FILE, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error reading data file");

    let clients = [];
    try {
      clients = JSON.parse(data);
    } catch {
      return res.status(500).send("Error parsing JSON");
    }

    if (clients.some((c) => c.phone === phone)) {
      return res.status(409).send("User already registered. Please login.");
    }

    const now = new Date();
    const expiry = new Date(now);
    expiry.setDate(now.getDate() + 30);

    const client = {
      name,
      phone,
      registrationDate: now.toISOString().split("T")[0],
      expiryDate: expiry.toISOString().split("T")[0],
      loginHistory: [],
    };

    clients.push(client);

    fs.writeFile(JSON_FILE, JSON.stringify(clients, null, 2), (err) => {
      if (err) return res.status(500).send("Error saving client");

      // Also append to CSV
      const csvRow = `${name},${phone},${client.registrationDate},${client.expiryDate}\n`;
      fs.appendFileSync(CSV_FILE, csvRow);

      res.status(200).send("Client registered successfully");
    });
  });
});

// Login
app.post("/login", (req, res) => {
  const { phone } = req.body;

  fs.readFile(JSON_FILE, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error reading data file");

    let clients = [];
    try {
      clients = JSON.parse(data);
    } catch {
      return res.status(500).send("Error parsing JSON");
    }

    const clientIndex = clients.findIndex((c) => c.phone === phone);
    if (clientIndex !== -1) {
      const loginTime = new Date().toISOString();
      clients[clientIndex].loginHistory =
        clients[clientIndex].loginHistory || [];
      clients[clientIndex].loginHistory.push(loginTime);

      fs.writeFile(JSON_FILE, JSON.stringify(clients, null, 2), (err) => {
        if (err) console.error("Login history save failed:", err);
      });

      return res
        .status(200)
        .json({ exists: true, client: clients[clientIndex] });
    } else {
      return res.status(200).json({ exists: false });
    }
  });
});

// Download JSON
app.get("/download-data", (req, res) => {
  res.download(JSON_FILE, "clients.json", (err) => {
    if (err) {
      console.error("Download error:", err);
      res.status(500).send("Download failed.");
    }
  });
});

// Download CSV
app.get("/download-csv", (req, res) => {
  res.download(CSV_FILE, "clients.csv", (err) => {
    if (err) {
      console.error("CSV download error:", err);
      res.status(500).send("Download failed.");
    }
  });
});

// Start
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
