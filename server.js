const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const cors = require("cors");
const nodemailer = require("nodemailer");
const cron = require("node-cron");

const app = express();
const PORT = process.env.PORT || 4000;

const DATA_DIR = path.join(__dirname, "data");
const JSON_FILE = path.join(DATA_DIR, "clients.json");
const CSV_FILE = path.join(DATA_DIR, "clients.csv");
const LOGIN_FILE = path.join(DATA_DIR, "login-history.json");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: "botsbillnutter@gmail.com", pass: "iaiyadjihuhnktjr" },
});

app.use(cors());
app.use(express.json());

async function ensureFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  if (!(await fileExists(JSON_FILE))) await fs.writeFile(JSON_FILE, "[]");
  if (!(await fileExists(CSV_FILE)))
    await fs.writeFile(
      CSV_FILE,
      "Name,Phone,Email,RegistrationDate,ExpiryDate\n"
    );
  if (!(await fileExists(LOGIN_FILE))) await fs.writeFile(LOGIN_FILE, "[]");
}

const fileExists = async (file) => {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
};

ensureFiles();

app.post("/register", async (req, res) => {
  const { name, phone, email = "" } = req.body;
  if (!name || !phone)
    return res.status(400).json({ error: "Name and phone are required." });

  try {
    const clients = JSON.parse(await fs.readFile(JSON_FILE, "utf8"));
    if (clients.find((c) => c.phone === phone))
      return res
        .status(409)
        .json({ error: "User already registered. Please login." });

    const now = new Date();
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + 30);
    const registrationDate = now.toISOString().split("T")[0];
    const expiryDate = expiry.toISOString().split("T")[0];
    const client = {
      name,
      phone,
      email,
      registrationDate,
      expiryDate,
      loginHistory: [],
    };

    clients.push(client);
    await fs.writeFile(JSON_FILE, JSON.stringify(clients, null, 2));
    await fs.appendFile(
      CSV_FILE,
      `${name},${phone},${email},${registrationDate},${expiryDate}\n`
    );

    if (email)
      sendEmail(
        email,
        "Welcome to Nutter Services",
        `Hi ${name}, you are registered. Your service expires on ${expiryDate}.`
      );

    res.status(200).json({ message: "Client registered successfully" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.post("/login", async (req, res) => {
  const { phone } = req.body;
  if (!phone)
    return res.status(400).json({ error: "Phone number is required" });

  try {
    const clients = JSON.parse(await fs.readFile(JSON_FILE, "utf8"));
    const index = clients.findIndex((c) => c.phone === phone);

    if (index === -1) return res.status(200).json({ exists: false });

    const client = clients[index];
    const time = new Date().toISOString();
    client.loginHistory.push(time);

    const loginData = JSON.parse(await fs.readFile(LOGIN_FILE, "utf8"));
    loginData.push({ phone, name: client.name, time });

    await fs.writeFile(LOGIN_FILE, JSON.stringify(loginData, null, 2));
    await fs.writeFile(JSON_FILE, JSON.stringify(clients, null, 2));

    res.status(200).json({
      exists: true,
      client: {
        name: client.name,
        phone: client.phone,
        email: client.email,
        registrationDate: client.registrationDate,
        expiryDate: client.expiryDate,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

["/download-data", "/download-csv", "/download-logins"].forEach((route, i) => {
  const files = [JSON_FILE, CSV_FILE, LOGIN_FILE];
  app.get(route, (req, res) => {
    res.download(files[i], path.basename(files[i]), (err) => {
      if (err) res.status(500).send("Download failed.");
    });
  });
});

cron.schedule("0 8 * * *", async () => {
  try {
    const clients = JSON.parse(await fs.readFile(JSON_FILE, "utf8"));
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + 3);
    const dateStr = reminderDate.toISOString().split("T")[0];

    clients.forEach((client) => {
      if (client.expiryDate === dateStr && client.email) {
        sendEmail(
          client.email,
          "Your Nutter Bot is Expiring Soon",
          `Hi ${client.name}, just a reminder your service expires on ${client.expiryDate}. Kindly renew at Ksh.100.`
        );
      }
    });
  } catch (err) {
    console.error("Cron error:", err);
  }
});

const sendEmail = (to, subject, text) => {
  transporter.sendMail(
    { from: "botsbillnutter@gmail.com", to, subject, text },
    (err, info) => {
      if (err) console.error("Email error:", err);
      else console.log(`Email sent to ${to}: ${info.response}`);
    }
  );
};

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
