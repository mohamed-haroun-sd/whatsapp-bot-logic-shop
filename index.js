import makeWASocket, { useMultiFileAuthState, MessageType, proto } from "@whiskeysockets/baileys";
import fs from "fs";

const startBot = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('auth');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async m => {
        if (!m.messages) return;
        const msg = m.messages[0];
        if (!msg.message) return;

        const sender = msg.key.remoteJid;

        if (msg.message.conversation === 'زر') {
            // زرار بسيط
            await sock.sendMessage(sender, { text: 'لقد ضغطت على الزر!' });
        }

        if (msg.message.conversation === 'قائمة') {
            // قائمة بسيطة
            await sock.sendMessage(sender, {
                text: 'اختر من القائمة:',
                buttons: [
                    { buttonId: 'btn1', buttonText: { displayText: 'الخيار 1' }, type: 1 },
                    { buttonId: 'btn2', buttonText: { displayText: 'الخيار 2' }, type: 1 }
                ],
                headerType: 1
            });
        }
    });
};

startBot();
