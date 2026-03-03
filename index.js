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
                content: "أنت مساعد ذكي ولطيف، ترد باللغة العربية بأسلوب مهذب ومختصر."
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
        browser: ["Manus Bot", "Chrome", "1.0.0"]
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== disconnectReason.loggedOut;
            console.log("Connection closed, reconnecting...", shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === "open") {
            console.log("Bot connected successfully!");
        }
    });

    const welcomedUsers = new Set();

    sock.ev.on("messages.upsert", async m => {
        if (!m.messages || m.type !== "notify") return;
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const messageText = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim().toLowerCase();

        // ترحيب تلقائي
        if (!welcomedUsers.has(sender)) {
            await sock.sendMessage(sender, { text: "مرحباً بك! 👋 أنا بوت واتساب الذكي.\n\nأرسل كلمة *قائمة* لعرض الخيارات المتاحة، أو اسألني أي سؤال وسأجيبك باستخدام الذكاء الاصطناعي!" });
            welcomedUsers.add(sender);
            return;
        }

        // معالجة الأوامر
        if (messageText === "قائمة") {
            const menuText = `*القائمة الرئيسية* 📋\n\n` +
                `1️⃣ *ساعات العمل*\n` +
                `2️⃣ *موقعنا*\n` +
                `3️⃣ *تواصل مع الدعم*\n` +
                `4️⃣ *عن البوت*\n\n` +
                `يرجى كتابة رقم الخيار أو اسمه (مثلاً: 1 أو ساعات العمل)`;
            await sock.sendMessage(sender, { text: menuText });
            return;
        }

        // ردود القائمة
        if (messageText === "1" || messageText.includes("ساعات العمل")) {
            await sock.sendMessage(sender, { text: "🕒 *ساعات العمل:*\nمن الأحد إلى الخميس، من 9 صباحاً حتى 5 مساءً." });
        } else if (messageText === "2" || messageText.includes("موقعنا")) {
            await sock.sendMessage(sender, { text: "📍 *موقعنا:*\nيمكنك زيارتنا في فرعنا الرئيسي أو عبر الخريطة: [رابط الخريطة]" });
        } else if (messageText === "3" || messageText.includes("الدعم")) {
            await sock.sendMessage(sender, { text: "📞 *الدعم الفني:*\nتواصل معنا عبر الواتساب على هذا الرقم أو عبر البريد: support@example.com" });
        } else if (messageText === "4" || messageText.includes("عن البوت")) {
            await sock.sendMessage(sender, { text: "🤖 أنا بوت واتساب مطور بواسطة Manus AI، أعمل بالذكاء الاصطناعي لخدمتكم!" });
        } else if (messageText === "زر") {
            await sock.sendMessage(sender, { text: "✅ تم استقبال أمر الزر بنجاح!" });
        } else {
            // إذا لم يكن أمراً، استخدم الذكاء الاصطناعي
            const aiResponse = await getAiResponse(messageText);
            await sock.sendMessage(sender, { text: aiResponse });
        }
    });
};

startBot();
