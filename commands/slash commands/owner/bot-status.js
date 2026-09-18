const { MessageFlags } = require('discord.js');
const Translator = require('../schema/TranslatorSchema.js');

module.exports = async (message) => {
    // Ignore bots and empty messages
    if (message.author.bot || !message.content.trim()) return false;

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        console.log("⚠️ [Translator] Failed: OPENAI_API_KEY is missing in your .env or host settings!");
        return false;
    }

    try {
        let channelLang = null;

        // Check if it's the specific Bilingual channel, otherwise fetch from Database
        if (message.channel.id === '907979176236163133') {
            channelLang = 'bilingual';
        } else {
            const config = await Translator.findOne({ channelId: message.channel.id });
            if (config) {
                channelLang = config.language;
            }
        }

        if (!channelLang) return false;

        const text = message.content.trim();
        let systemPrompt = "";

        // ==========================================
        // BILINGUAL (Arabic <-> English) LOGIC
        // ==========================================
        if (channelLang === 'bilingual') {
            systemPrompt = `You are an expert, natural-sounding translator. 
If the user's text is in Arabic (including dialects, interjections, laughter like "ههههه", or slang), translate to English and prefix your response with "EN:".
If the user's text is in English (including chat slang, diminutives, or laughter), translate to Arabic and prefix your response with "AR:".

CRITICAL RULES:
1. Understand chat slang, single-word messages, and stretched words (e.g., recognize that "بنامممم" means "I will sleep", not "in the name"). Condense elongated words to their base meaning before translating.
2. If a short phrase is highly ambiguous and has multiple distinct meanings due to lack of context, list the most likely translations as a numbered list after your prefix (e.g., EN: 1. [Meaning 1] \\n 2. [Meaning 2]). HOWEVER, if the context makes the meaning clear, provide ONLY the single correct translation.
3. Preserve all standard emojis, Discord custom emojis (<:name:id>), and mentions (@username, <@id>) exactly as they appear. Place them naturally in the translated text.
4. Only return the prefixed translation. If the message consists ONLY of emojis or mentions (no translatable text), reply with exactly: ALREADY_BILINGUAL`;

            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${OPENAI_API_KEY}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: systemPrompt }, 
                        { role: "user", content: text }
                    ],
                    temperature: 0.2
                })
            });

            const data = await res.json();
            
            if (data.error) {
                console.error("❌ [OpenAI Error (Bilingual)]:", data.error.message);
                return false;
            }

            const result = data.choices?.[0]?.message?.content?.trim() || "";

            if (result === "ALREADY_BILINGUAL") {
                return false; 
            } else if (result.startsWith("EN:")) {
                const finalTranslation = result.substring(3).trim();
                await message.reply({ 
                    content: `-# **TRANSLATED FROM __ARABIC__:**\n${finalTranslation}\n-# - AI translation is not 100% accurate`, 
                    flags: [MessageFlags.SuppressNotifications],
                    allowedMentions: { repliedUser: false } 
                });
            } else if (result.startsWith("AR:")) {
                const finalTranslation = result.substring(3).trim();
                await message.reply({ 
                    content: `-# **مترجم من __الإنجليزية__:**\n${finalTranslation}\n-# - الترجمة AI ليست دقيقة 100%`, 
                    flags: [MessageFlags.SuppressNotifications],
                    allowedMentions: { repliedUser: false } 
                });
            }
            return true;
        }

        // ==========================================
        // GENERAL CHANNELS (English, Spanish, Thai, Arabic)
        // ==========================================
        const langMap = {
            english: { name: 'English', header: '-# **TRANSLATED FROM __{LANG}__:**', warning: '-# - AI translation is not 100% accurate', ignore: 'ALREADY_ENGLISH' },
            spanish: { name: 'Spanish', header: '-# **TRADUCIDO DEL __{LANG}__:**', warning: '-# - La traducción por IA no es 100% precisa', ignore: 'ALREADY_SPANISH' },
            arabic: { name: 'Arabic', header: '-# **مترجم من __{LANG}__:**', warning: '-# - الترجمة AI ليست دقيقة 100%', ignore: 'ALREADY_ARABIC' },
            thai: { name: 'Thai', header: '-# **แปลจาก__{LANG}__:**', warning: '-# - คำแปลโดย AI ไม่ได้แม่นยำ 100%', ignore: 'ALREADY_THAI' }
        };

        const setting = langMap[channelLang];
        if (!setting) return false;

        systemPrompt = `You are a highly accurate translator. Your strict goal is to translate text from ANY source language into natural ${setting.name}. You are an expert at understanding slang, internet chat-speak, and diminutives (like Spanish words ending in -ita/-ito, e.g., "holita", "casita", or similar concepts in other languages) even without full sentence context.

CRITICAL RULES:
1. If the text is ALREADY mostly in ${setting.name} (including slang, diminutives, typos, or short single-word messages), do NOT translate or correct it. Reply with exactly and ONLY: ${setting.ignore}
2. Do not act as a grammar checker. Never "fix" ${setting.name} text into better ${setting.name}.
3. If the message consists ONLY of emojis/mentions (no translatable text), reply with exactly: ${setting.ignore}
4. Preserve all standard emojis, Discord custom emojis, and user/role mentions exactly as they appear.
5. If a short phrase is highly ambiguous and has multiple distinct meanings due to lack of context (e.g., just "como manzana" meaning "I eat an apple" vs "like an apple"), list the most likely translations as a numbered list. HOWEVER, if the context makes the meaning clear (e.g., "Yo como manzana" clearly means "I eat an apple"), provide ONLY the single correct translation.

If a translation IS needed, you MUST format your response exactly like this:
SRC: [Name of the Source Language written in ${setting.name}]
[Translated Text or Numbered List of Meanings]

Example for translating an ambiguous phrase like "como manzana" from Spanish to English:
SRC: Spanish
1. I eat an apple
2. Like an apple`;

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${OPENAI_API_KEY}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt }, 
                    { role: "user", content: text }
                ],
                temperature: 0.2
            })
        });

        const data = await res.json();

        if (data.error) {
            console.error("❌ [OpenAI Error (General)]:", data.error.message);
            return false;
        }

        const result = data.choices?.[0]?.message?.content?.trim() || "";

        if (result && !result.includes(setting.ignore)) {
            let translatedText = result;
            let detectedLang = "UNKNOWN";

            const lines = result.split('\n');

            if (lines.length >= 2) {
                const firstLine = lines.shift(); 
                detectedLang = firstLine.replace(/^SRC:\s*/i, '').trim().toUpperCase();
                translatedText = lines.join('\n').trim();
            } else {
                translatedText = result;
            }

            // ==========================================
            // FAILSAFE: Programmatically block same-language translations
            // ==========================================
            if (detectedLang.toLowerCase() === setting.name.toLowerCase()) {
                return false; 
            }

            const finalHeader = setting.header.replace('{LANG}', detectedLang);

            await message.reply({
                content: `${finalHeader}\n${translatedText}\n${setting.warning}`,
                flags: [MessageFlags.SuppressNotifications],
                allowedMentions: { repliedUser: false }
            });
        }
        return true;

    } catch (error) {
        console.error("❌ [Database Translator Crash Error]:", error);
        return false;
    }
};
