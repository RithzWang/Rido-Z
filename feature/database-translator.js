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
            systemPrompt = `You are a highly intelligent, natural Discord translator.
Translate Arabic text to English (prefix with "EN:").
Translate English text to Arabic (prefix with "AR:").

BEHAVIOR:
1. Translate Short Words: If the user types a single word, slang, diminutive (like "holita" or "casita"), or stretched word (like "بنامممم"), you MUST translate its base meaning. Do not ignore short messages.
2. Context is King: If a phrase is completely ambiguous, give a numbered list of the top meanings. BUT if there is context, output ONLY the single correct translation.
3. Untouched Elements: Emojis (<:name:id>) and mentions (<@id>) must remain exactly where they belong.
4. Skip Rule: If the message contains no translatable text, reply ONLY with: SKIP`;

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

            if (result === "SKIP") {
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
            english: { name: 'English', header: '-# **TRANSLATED FROM __{LANG}__:**', warning: '-# - AI translation is not 100% accurate' },
            spanish: { name: 'Spanish', header: '-# **TRADUCIDO DEL __{LANG}__:**', warning: '-# - La traducción por IA no es 100% precisa' },
            arabic: { name: 'Arabic', header: '-# **مترجم من __{LANG}__:**', warning: '-# - الترجمة AI ليست دقيقة 100%' },
            thai: { name: 'Thai', header: '-# **แปลจาก__{LANG}__:**', warning: '-# - คำแปลโดย AI ไม่ได้แม่นยำ 100%' }
        };

        const setting = langMap[channelLang];
        if (!setting) return false;

        systemPrompt = `You are a highly intelligent, natural Discord translator. Your target language is ${setting.name}.

BEHAVIOR:
1. Translate Short Words: If the text is a single foreign word, slang, or diminutive (e.g., Spanish "cosita", "holita", "casita"), you MUST translate its meaning into ${setting.name}. Do not ignore it just because it lacks context.
2. Skip Rule: If the text is ALREADY natively in ${setting.name}, do NOT translate or grammar-check it. Reply ONLY with: SKIP
3. Context is King: If a foreign phrase is completely ambiguous, provide a numbered list of meanings. If context makes it clear (e.g., "Yo como"), output ONLY the single correct translation.
4. Untouched Elements: Emojis (<:name:id>) and mentions (<@id>) must remain exactly where they belong.
5. Translate the Label: You MUST translate the name of the detected source language into ${setting.name}. For example, if the target is Thai and the source is English, you must write "SRC: ภาษาอังกฤษ", not "SRC: English". 

FORMAT:
If translating, output exactly:
SRC: [Source language name translated into ${setting.name}]
[Translation]`;

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

        // 1. If it replied with ONLY "SKIP", silently abort.
        if (result === "SKIP") return false;

        if (result) {
            let translatedText = result;
            let detectedLang = "UNKNOWN";

            const lines = result.split('\n');

            if (lines.length >= 2) {
                const firstLine = lines.shift(); 
                // Added .toUpperCase() back so English and Spanish channel labels are capitalized
                detectedLang = firstLine.replace(/^SRC:\s*/i, '').trim().toUpperCase();
                translatedText = lines.join('\n').trim();
            } else {
                translatedText = result;
            }

            // 2. If it replied with "SRC: [Lang]" and then "SKIP", silently abort.
            if (translatedText === "SKIP") return false;

            // 3. If it detected the source is the exact same language as the channel target, abort.
            if (detectedLang.toLowerCase() === setting.name.toLowerCase()) return false; 

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
