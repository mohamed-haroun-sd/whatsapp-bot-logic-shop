import makeWASocket, { useMultiFileAuthState, disconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import fs from "fs";
import OpenAI from "openai";
import { Boom } from "@hapi/boom";

// إعداد OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const getAiResponse = async (prompt) => {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{
                role: "system",
                content: "أنت مساعد ذكي ولطيف باسم Logic Bot، ترد باللغة العربية بأسلوب مهذب ومختصر."
            }, {
                role: "user",
                content: prompt
            }],
        });
        return completion.choices[0].message.content;
    } catch (error) {
        console.error("Error with OpenAI:", error);
        return "عذراً، واجهت مشكلة في التفكير حالياً. جرب لاحقاً!";
    }
};

const startBot = async () => {
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        browser: ["Logic Bot", "Chrome", "1.0.0"]
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== disconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("Logic Bot connected successfully!");
        }
    });

    const welcomedUsers = new Set();

    sock.ev.on("messages.upsert", async m => {
        if (!m.messages || m.type !== "notify") return;
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        let messageText = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim().toLowerCase();

        // إزالة النقطة من بداية الرسالة إذا وجدت لتسهيل معالجة الأوامر
        const cleanText = messageText.startsWith(".") ? messageText.substring(1) : messageText;

        // ترحيب تلقائي للمستخدمين الجدد
        if (!welcomedUsers.has(sender)) {
            await sock.sendMessage(sender, { text: "مرحباً بك! 👋 أنا *Logic Bot* الذكي.\n\nأرسل كلمة *قائمة* أو *.اوامر* لعرض الخيارات المتاحة، أو اسألني أي سؤال وسأجيبك بالذكاء الاصطناعي!" });
            welcomedUsers.add(sender);
            return;
        }

        // معالجة الأوامر (دعم الأوامر التي ظهرت في الصورة)
        if (cleanText === "قائمة" || cleanText === "قوائم" || cleanText === "اوامر") {
            const menuText = `🤖 *Logic Bot v1.0*\n\n` +
                `هذه هي قائمة الأوامر المتاحة حالياً:\n\n` +
                `1️⃣ *ساعات العمل* 🕒\n` +
                `2️⃣ *موقعنا* 📍\n` +
                `3️⃣ *تواصل مع الدعم* 📞\n` +
                `4️⃣ *عن البوت* ℹ️\n\n` +
                `استخدم الأرقام (1, 2, 3) للرد السريع، أو اسألني أي شيء آخر للدردشة بالذكاء الاصطناعي!`;
            await sock.sendMessage(sender, { text: menuText });
            return;
        }

        // ردود القائمة والأزرار التجريبية
        if (cleanText === "1" || cleanText.includes("ساعات العمل")) {
            await sock.sendMessage(sender, { text: "🕒 *ساعات العمل:*\nمن الأحد إلى الخميس، من 9 صباحاً حتى 5 مساءً." });
        } else if (cleanText === "2" || cleanText.includes("موقعنا")) {
            await sock.sendMessage(sender, { text: "📍 *موقعنا:*\nيمكنك زيارة متجرنا الرئيسي في [أدخل العنوان هنا] أو عبر خرائط جوجل." });
        } else if (cleanText === "3" || cleanText.includes("دعم")) {
            await sock.sendMessage(sender, { text: "📞 *الدعم الفني:*\nتواصل معنا مباشرة عبر هذا الرقم أو عبر البريد: support@logic-store.com" });
        } else if (cleanText === "4" || cleanText.includes("عن البوت")) {
            await sock.sendMessage(sender, { text: "ℹ️ *عن البوت:*\nأنا بوت متطور أعمل بتقنية GPT-4o-mini لخدمة عملاء متجر لوجيك." });
        } else if (cleanText === "زر") {
            await sock.sendMessage(sender, { text: "✅ تم استقبال أمر الزر بنجاح! كيف يمكنني مساعدتك؟" });
        } else {
            // استخدام الذكاء الاصطناعي للرسائل الأخرى
            const aiResponse = await getAiResponse(messageText);
            await sock.sendMessage(sender, { text: aiResponse });
        }
    });
};

startBot();
