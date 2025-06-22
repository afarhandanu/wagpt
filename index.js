const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const { OpenAI } = require("openai");
const P = require("pino");
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function connectBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: P({ level: 'silent' })
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    const sender = msg.key.remoteJid;

    if (!text) return;

    const lowered = text.toLowerCase();

    // === Auto-reply untuk pesan tertentu ===
    if (lowered === "halo") {
      return await sock.sendMessage(sender, { text: "Hai juga! Ada yang bisa kubantu?" });
    }

    if (lowered.includes("siapa kamu")) {
      return await sock.sendMessage(sender, { text: "Aku adalah chatbot WhatsApp berbasis GPT-4o 🤖" });
    }

    // === Respon untuk perintah /menu ===
    if (lowered === "/menu") {
      const menu = `📋 *Menu Utama*:
1. Ketik apa pun untuk tanya GPT-4o
2. /menu - Tampilkan menu ini
3. halo - Balasan khusus
4. siapa kamu - Info tentang bot ini

Silakan tanya apa pun!`;
      return await sock.sendMessage(sender, { text: menu });
    }

    // === Kirim ke GPT-4o jika tidak ada keyword khusus ===
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: text }]
      });

      const reply = response.choices[0].message.content;
      await sock.sendMessage(sender, { text: reply });
    } catch (err) {
      await sock.sendMessage(sender, { text: "Gagal menjawab: " + err.message });
    }
  });

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      if ((lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut) {
        connectBot();
      }
    }
  });
}

connectBot();