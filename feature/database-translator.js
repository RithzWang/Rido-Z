const Translator = require('../schema/TranslatorSchema.js');

module.exports = async (message) => {
    if (message.author.bot || !message.content.trim()) return false;

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return false;

    try {
        let channelLang = null;

        // 1. Check if this specific channel is the permanent hardcoded bilingual channel
        if (message.channel.id === '907979176236163133') {
            channelLang = 'bilingual';
        } else {
            // 2. Otherwise, check MongoDB for dynamically configured channels
            const config = await Translator.findOne({ channelId: message.channel.id });
            if (config) {
                channelLang = config.language;
            }
        }

        // If it's not a registered or hardcoded translation channel, ignore it
        if (!channelLang) return false;

        const text = message.content.trim();
        let systemPrompt = "";

        // ==========================================
        // BILINGUAL (Arabic <-> English) LOGIC
        // ==========================================
        if (channelLang === 'bilingual') {
            systemPrompt = `You are an expert, natural-sounding translator. 
If the user's text is in Arabic (including regional dialects, interjections like "هاه", laughter like "ههههه", or slang), translate it to English and prefix your response with "EN:".
If the user's text is in English (including laughter like "hahahaha"), translate it to Arabic and prefix your response with "AR:".
Always convert laughter and interjections to natural local equivalents.
Only return the prefixed translation, nothing else.`;

            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: text }],
                    temperature: 0.3
                })
            });

            const data = await res.json();
            const result = data.choices?.[0]?.message?.content?.trim() || "";

            if (result.startsWith("EN:")) {
                const finalTranslation = result.substring(3).trim();
                await message.reply({ 
                    content: `-# **Translation:**\n${finalTranslation}\n-#   - AI translation is not 100% accurate`, 
                    allowedMentions: { repliedUser: false } 
                });
            } else if (result.startsWith("AR:")) {
                const finalTranslation = result.substring(3).trim();
                await message.reply({ 
                    content: `-# **ترجمة:**\n${finalTranslation}\n-#   - الترجمة AI ليست دقيقة 100%`, 
                    allowedMentions: { repliedUser: false } 
                });
            }
            return true;
        }

        // ==========================================
        // GENERAL CHANNELS (English, Spanish, Thai, Arabic)
        // ==========================================
        const langMap = {
            english: { name: 'English', header: '-# **Translation:**', warning: '-#   - AI translation is not 100% accurate', ignore: 'ALREADY_ENGLISH' },
            spanish: { name: 'Spanish', header: '-# **Traducción:**', warning: '-#   - La traducción por IA no es 100% precisa', ignore: 'ALREADY_SPANISH' },
            arabic: { name: 'Arabic', header: '-# **ترجمة:**', warning: '-#   - الترجمة AI ليست دقيقة 100%', ignore: 'ALREADY_ARABIC' },
            thai: { name: 'Thai', header: '-# **คำแปล:**', warning: '-#   - คำแปลโดย AI อาจไม่ได้แม่นยำ 100%', ignore: 'ALREADY_THAI' }
        };

        const setting = langMap[channelLang];
        if (!setting) return false;

        systemPrompt = `You are a highly accurate translator. Translate the user's message into natural ${setting.name}. 
Translate all text, including interjections, laughter, internet slang, and dialects into local native equivalents.
If the text is ALREADY written natively in ${setting.name}, reply with strictly the word: ${setting.ignore}
Do not add any extra explanations.`;

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "system", content: systemPrompt }, { role: "user", content: text }],
                temperature: 0.3
            })
        });

        const data = await res.json();
        const result = data.choices?.[0]?.message?.content?.trim() || "";

        if (result && !result.includes(setting.ignore)) {
            await message.reply({
                content: `${setting.header}\n${result}\n${setting.warning}`,
                allowedMentions: { repliedUser: false }
            });
        }
        return true;

    } catch (error) {
        console.error("Database Translator Error:", error);
        return false;
    }
};
