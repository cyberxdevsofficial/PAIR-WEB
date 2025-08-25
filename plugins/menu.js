module.exports = (sock) => {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const mek = messages[0];
      if (!mek?.message || mek.key.fromMe) return; // Incoming messagesට පමණක් respond වෙන්න

      const messageContent =
        mek.message.conversation ||
        mek.message.extendedTextMessage?.text ||
        "";

      const body = messageContent.trim().toLowerCase();

      if (body === ".menu") {
        // 💡 emoji reaction එක දෙනවා
        await sock.sendMessage(mek.key.remoteJid, {
          react: { key: mek.key, text: "📜" },
        });

        const madeMenu = `
╭─「 📜 ANUWH MD 」 
│ ⚙️ *MAIN COMMANDS*
│   ➥ .menu
│   ➥ .status
│   ➥ .help
│   *More features coming soon!*
╰──────────●●►
> POWERED BY ANUGA SENITHU BY CyberX Devs TM
`.trim();

        // Image + caption send කරමින් user message එක quote කරනවා
        await sock.sendMessage(
          mek.key.remoteJid,
          {
            image: {
              url: "https://github.com/cyberxdevsofficial/Photos/blob/main/anuwhmd-logo",
            },
            caption: madeMenu,
          },
          { quoted: mek }
        );
      }
    } catch (err) {
      console.error("❌ Error in menu plugin:", err);
    }
  });
};
