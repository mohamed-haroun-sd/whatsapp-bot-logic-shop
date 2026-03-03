import makeWASocket, { useMultiFileAuthState, MessageType, proto } from "@whiskeysockets/baileys";
import fs from "fs";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const getAiResponse = async (prompt) => {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // استخدام gpt-4o-mini لأنه متاح في البيئة
            messages: [{
                role: "user",
                content: prompt
            }],
        });
        return completion.choices[0].message.content;
    } catch (error) {
        console.error("Error getting AI response:", error);
        return "عذراً، حدث خطأ أثناء معالجة طلبك بواسطة الذكاء الاصطناعي.";
    }
};

const startBot = async () => {
    const { state, saveCreds } = await useMultiFileAuthState("auth");

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on("creds.update", saveCreds);

    // Set to store JIDs of users who have received a welcome message
    const welcomedUsers = new Set();

    sock.ev.on("messages.upsert", async m => {
        if (!m.messages) return;
        const msg = m.messages[0];
        if (!msg.message) return;

        const sender = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // Welcome message logic
        if (!welcomedUsers.has(sender) && !msg.key.fromMe) {
            await sock.sendMessage(sender, { text: "مرحباً بك! أنا بوت واتساب الخاص بك. كيف يمكنني مساعدتك اليوم؟" });
            welcomedUsers.add(sender);
        }

        if (messageText === "زر") {
            await sock.sendMessage(sender, { text: "لقد ضغطت على الزر!" });
        }

        if (messageText === "قائمة") {
            await sock.sendMessage(sender, {
                text: "اختر من القائمة الرئيسية:",
                buttons: [
                    { buttonId: "hours", buttonText: { displayText: "ساعات العمل" }, type: 1 },
                    { buttonId: "location", buttonText: { displayText: "موقعنا" }, type: 1 },
                    { buttonId: "support", buttonText: { displayText: "تواصل مع الدعم" }, type: 1 },
                    { buttonId: "ai_chat", buttonText: { displayText: "تحدث مع الذكاء الاصطناعي" }, type: 1 }
                ],
                headerType: 1
            });
        }

        // Handle button responses
        if (msg.message.buttonsResponseMessage) {
            const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
            switch (buttonId) {
                case "hours":
                    await sock.sendMessage(sender, { text: "ساعات العمل: من الأحد إلى الخميس، من 9 صباحاً حتى 5 مساءً." });
                    break;
                case "location":
                    await sock.sendMessage(sender, { text: "يمكنك العثور علينا هنا: [رابط خرائط جوجل](https://maps.app.goo.gl/your_location)" });
                    break;
                case "support":
                    await sock.sendMessage(sender, { text: "للتواصل مع الدعم الفني، يرجى الاتصال على: +123456789 أو إرسال بريد إلكتروني إلى support@example.com" });
                    break;
                case "ai_chat":
                    await sock.sendMessage(sender, { text: "أهلاً بك في وضع الدردشة مع الذكاء الاصطناعي. اسألني أي شيء!" });
                    break;
                default:
                    await sock.sendMessage(sender, { text: "خيار غير صالح. يرجى الاختيار من القائمة." });
                    break;
            }
        }

        // AI response for unhandled messages
        if (!msg.key.fromMe && !msg.message.buttonsResponseMessage && messageText !== "زر" && messageText !== "قائمة" && messageText !== "") {
            const aiResponse = await getAiResponse(messageText);
            await sock.sendMessage(sender, { text: aiResponse });
        }
    });
};

startBot();
