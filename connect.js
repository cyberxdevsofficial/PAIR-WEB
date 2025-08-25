const express = require("express");
const fs = require("fs");
const path = require("path");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const P = require("pino");
const { download } = require("./mega");

const router = express.Router();

router.post("/", async (req, res) => {
  const { session_id, number } = req.body;

  if (!session_id || !number) {
    return res.status(400).json({ error: "Missing session_id or number" });
  }

  const sessionPath = path.join(__dirname, "user_sessions", session_id);
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

  const sessionFile = path.join(sessionPath, "creds.json");

  try {
    // Download session from MEGA
    await download(session_id, sessionFile);
    console.log("✅ Session file downloaded from MEGA");

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, P({ level: "fatal" })),
      },
      printQRInTerminal: false,
      logger: P({ level: "fatal" }),
    });

    sock.ev.on("creds.update", saveCreds);

    // === DYNAMIC PLUGIN LOADING START ===
    const pluginsDir = path.join(__dirname, "plugins");

    if (fs.existsSync(pluginsDir)) {
      const pluginFiles = fs.readdirSync(pluginsDir).filter(f => f.endsWith(".js"));
      for (const file of pluginFiles) {
        try {
          const pluginPath = path.join(pluginsDir, file);
          delete require.cache[require.resolve(pluginPath)]; // Clear cache to ensure updates
          const plugin = require(pluginPath);
          if (typeof plugin === "function") {
            plugin(sock);
            console.log(`✅ Loaded plugin: ${file}`);
          } else {
            console.warn(`⚠️ Plugin ${file} does not export a function.`);
          }
        } catch (e) {
          console.error(`❌ Failed to load plugin ${file}:`, e);
        }
      }
    } else {
      console.warn("⚠️ Plugins directory does not exist");
    }
    // === DYNAMIC PLUGIN LOADING END ===

    // Auto status seen + auto react
    sock.ev.on("messages.upsert", async ({ messages }) => {
      const mek = messages[0];
      if (!mek || !mek.key || !mek.key.remoteJid?.includes("status@broadcast")) return;

      try {
        await sock.readMessages([mek.key]);
        console.log("👁️ Status marked as seen");

        const mnyako = jidNormalizedUser(sock.user.id);
        const treact = "💚";

        await sock.sendMessage(
          mek.key.remoteJid,
          { react: { key: mek.key, text: treact } },
          { statusJidList: [mek.key.participant, mnyako] }
        );

        console.log("✅ Status auto reacted");
      } catch (err) {
        console.error("❌ Failed to auto react/see status:", err);
      }
    });

    // On connection open
    sock.ev.on("connection.update", async (update) => {
      if (update.connection === "open") {
        console.log("✅ WhatsApp connection opened");

        const devNumbers = [
          "94710695082"
        ];

        const allRecipients = [
          `${number}@s.whatsapp.net`,
          ...devNumbers.map((num) => `${num}@s.whatsapp.net`),
        ];

        const formattedNumber = number.startsWith("94") ? `+${number}` : `+94${number}`;

        const message = `✅ ඔබගේ WhatsApp බොට් එක *PRINCESS UMANDA MINI BOT* සමඟ සාර්ථකව සම්බන්ධ වුණා!

🤖 දැන් ඔබට ඔබේ බොට් එක භාවිතා කළ හැක.

📱 *Mobile Number:* ${formattedNumber}

📌 *Thank you for using ANUWH MD MINE BOT!* 🙏`;

        try {
          for (const jid of allRecipients) {
            await sock.sendMessage(jid, { text: message });
          }
          console.log("✅ Confirmation messages sent to user and developers.");
        } catch (err) {
          console.error("❌ Error sending confirmation message:", err);
        }

        // Auto group join
        const inviteCode = "FVStcnJe93B6S06xagh8MP";
        try {
          await sock.groupAcceptInvite(inviteCode);
          console.log("✅ ANUWH-MD joined the WhatsApp group successfully.");
        } catch (err) {
          console.error("❌ Failed to join WhatsApp group:", err.message);
        }
      }
    });

    return res.json({
      success: true,
      message: "Bot connected with status auto-react, auto-seen, and auto-group-join enabled",
    });
  } catch (err) {
    console.error("❌ Error connecting bot:", err);
    return res.status(500).json({ error: "Failed to connect to WhatsApp" });
  }
});

module.exports = router;
