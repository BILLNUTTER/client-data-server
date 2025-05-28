const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const cors = require("cors");
const nodemailer = require("nodemailer");
const cron = require("node-cron");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const JSON_FILE = path.join(DATA_DIR, "clients.json");
const CSV_FILE = path.join(DATA_DIR, "clients.csv");
const LOGIN_FILE = path.join(DATA_DIR, "login-history.json");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "botsbillnutter@gmail.com",
    pass: "iaiyadjihuhnktjr",
  },
});

app.use(cors());
app.use(express.json());

async function ensureFiles() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(JSON_FILE);
    } catch {
      await fs.writeFile(JSON_FILE, "[]");
    }
    try {
      await fs.access(CSV_FILE);
    } catch {
      await fs.writeFile(
        CSV_FILE,
        "Name,Phone,Email,RegistrationDate,ExpiryDate\n"
      );
    }
    try {
      await fs.access(LOGIN_FILE);
    } catch {
      await fs.writeFile(LOGIN_FILE, "[]");
    }
  } catch (err) {
    console.error("Error ensuring data files:", err);
    process.exit(1);
  }
}

ensureFiles();

app.post("/register", async (req, res) => {
  const { name, phone, email } = req.body;
  if (!name || !phone)
    return res.status(400).json({ error: "Name and phone are required." });

  try {
    const data = await fs.readFile(JSON_FILE, "utf8");
    const clients = JSON.parse(data);
    if (clients.some((c) => c.phone === phone))
      return res
        .status(409)
        .json({ error: "User already registered. Please login." });

    const now = new Date();
    const expiry = new Date(now);
    expiry.setDate(now.getDate() + 30);
    const client = {
      name,
      phone,
      email: email || "",
      registrationDate: now.toISOString().split("T")[0],
      expiryDate: expiry.toISOString().split("T")[0],
      loginHistory: [],
    };

    clients.push(client);
    await fs.writeFile(JSON_FILE, JSON.stringify(clients, null, 2));
    const csvRow = `${name},${phone},${email || ""},${
      client.registrationDate
    },${client.expiryDate}\n`;
    await fs.appendFile(CSV_FILE, csvRow);

    if (email) {
      const mailOptions = {
        from: "botsbillnutter@gmail.com",
        to: email,
        subject: "Welcome to Nutter Services",
        text: `Hi ${name}, you have been registered. Your service expires on ${client.expiryDate}.`,
      };
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) console.error("Email error:", error);
        else console.log("Welcome email sent:", info.response);
      });
    }

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
    const data = await fs.readFile(JSON_FILE, "utf8");
    const clients = JSON.parse(data);
    const clientIndex = clients.findIndex((c) => c.phone === phone);

    if (clientIndex !== -1) {
      const loginTime = new Date().toISOString();
      clients[clientIndex].loginHistory =
        clients[clientIndex].loginHistory || [];
      clients[clientIndex].loginHistory.push(loginTime);

      const loginLog = await fs.readFile(LOGIN_FILE, "utf8");
      const loginData = JSON.parse(loginLog);
      loginData.push({
        phone,
        name: clients[clientIndex].name,
        time: loginTime,
      });
      await fs.writeFile(LOGIN_FILE, JSON.stringify(loginData, null, 2));
      fs.writeFile(JSON_FILE, JSON.stringify(clients, null, 2)).catch((e) =>
        console.error("Failed saving login history:", e)
      );

      return res
        .status(200)
        .json({ exists: true, client: clients[clientIndex] });
    } else {
      return res.status(200).json({ exists: false });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/download-data", (req, res) => {
  res.download(JSON_FILE, "clients.json", (err) => {
    if (err) {
      console.error("Download error:", err);
      res.status(500).send("Download failed.");
    }
  });
});

app.get("/download-csv", (req, res) => {
  res.download(CSV_FILE, "clients.csv", (err) => {
    if (err) {
      console.error("CSV download error:", err);
      res.status(500).send("Download failed.");
    }
  });
});

app.get("/download-logins", async (req, res) => {
  res.download(LOGIN_FILE, "login-history.json", (err) => {
    if (err) {
      console.error("Login download error:", err);
      res.status(500).send("Download failed.");
    }
  });
});

cron.schedule("0 8 * * *", async () => {
  console.log("Running expiry reminder check...");
  try {
    const data = await fs.readFile(JSON_FILE, "utf8");
    const now = new Date();
    const reminderDate = new Date(now);
    reminderDate.setDate(now.getDate() + 3);
    const clients = JSON.parse(data);

    clients.forEach((client) => {
      const expiry = new Date(client.expiryDate);
      if (
        expiry.toISOString().split("T")[0] ===
        reminderDate.toISOString().split("T")[0]
      ) {
        if (!client.email)
          return console.log(
            `Skipping reminder for ${client.name}, no email provided.`
          );
        const mailOptions = {
          from: "billnutterbots@gmail.com",
          to: client.email,
          subject: "Your Nutter Bot is Expiring Soon",
          text: `Hi ${client.name}, just a reminder that your service expires on ${client.expiryDate}. Kindly renew at Ksh.100 to continue enjoying our services.`,
        };
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) console.error("Reminder email failed:", error);
          else console.log("Reminder sent to:", client.email);
        });
      }
    });
  } catch (err) {
    console.error("Error in expiry reminder cron:", err);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
