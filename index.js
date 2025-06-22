const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const { OpenAI } = require("openai");
const P = require("pino");
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function connectBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' })
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        connectBot();
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    const lowered = text?.toLowerCase();

    if (!text) return;

    if (lowered === "/menu") {
      return await sock.sendMessage(sender, {
        text: `📋 *Menu Bot GPT-4o*

- Kirim pesan apa saja untuk dijawab AI
- /menu untuk lihat menu ini
- halo, siapa kamu → respon khusus`
      });
    }

    if (lowered === "halo") {
      return await sock.sendMessage(sender, { text: "Hai juga! Ada yang bisa kubantu?" });
    }

    if (lowered.includes("siapa kamu")) {
      return await sock.sendMessage(sender, {
        text: "Aku adalah chatbot WhatsApp berbasis GPT-4o. Tanyakan apa saja!"
      });
    }

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: text }]
      });
      const reply = completion.choices[0].message.content;
      await sock.sendMessage(sender, { text: reply });
    } catch (err) {
      await sock.sendMessage(sender, { text: "Maaf, terjadi kesalahan saat menjawab." });
    }
  });
}

connectBot();