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
Crucially: Understand chat slang and stretched words with repeated letters. For example, recognize that "بنامممم" means "I will sleep" ("بنام"), not "in the name". Condense elongated words to their base meaning before translating.
Always convert laughter and interjections to natural local equivalents.
Only return the prefixed translation and ignore only-emoji-messages but do not ignore emoji in messages like "hello 😃", nothing else.`;

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
                    content: `-# **TRANSLATION FROM __ARABIC__:**\n${finalTranslation}\n-#   - AI translation is not 100% accurate`, 
                    allowedMentions: { repliedUser: false } 
                });
            } else if (result.startsWith("AR:")) {
                const finalTranslation = result.substring(3).trim();
                await message.reply({ 
                    content: `-# **ترجمة من __الإنجليزية__:**\n${finalTranslation}\n-#   - الترجمة AI ليست دقيقة 100%`, 
                    allowedMentions: { repliedUser: false } 
                });
            }
            return true;
        }

        // ==========================================
        // GENERAL CHANNELS (English, Spanish, Thai, Arabic)
        // ==========================================
        // Notice we added a {LANG} placeholder in the headers below
        const langMap = {
            english: { name: 'English', header: '-# **TRANSLATION FROM __{LANG}__:**', warning: '-#   - AI translation is not 100% accurate', ignore: 'ALREADY_ENGLISH' },
            spanish: { name: 'Spanish', header: '-# **TRADUCCIÓN DEL __{LANG}__:**', warning: '-#   - La traducción por IA no es 100% precisa', ignore: 'ALREADY_SPANISH' },
            arabic: { name: 'Arabic', header: '-# **ترجمة من __{LANG}__:**', warning: '-#   - الترجمة AI ليست دقيقة 100%', ignore: 'ALREADY_ARABIC' },
            thai: { name: 'Thai', header: '-# **คำแปลจาก__{LANG}__:**', warning: '-#   - คำแปลโดย AI ไม่ได้แม่นยำ 100%', ignore: 'ALREADY_THAI' }
        };

        const setting = langMap[channelLang];
        if (!setting) return false;

        // Instructing the AI to format its answer so we can extract the detected language
        systemPrompt = `You are a highly accurate translator. Your strict goal is to translate text from ANY source language into natural ${setting.name}.
Whether the user speaks in Arabic, English, Spanish, Thai, or any other language, you MUST return the translation in ${setting.name}.
Translate all text, including interjections (e.g., "هاه", "huh"), laughter (e.g., "hahahaha", "ههههه"), internet slang, and dialects into local native equivalents in ${setting.name}.
Crucially: Understand chat slang and stretched words with repeated letters. For example, recognize that "بنامممم" in Arabic means "I will sleep". Condense elongated words to their base meaning before translating.

If the text is ALREADY written entirely natively in ${setting.name}, reply with strictly the word: ${setting.ignore}

Otherwise, you MUST format your response exactly like this:
SRC: [Source Language]
[Translated Text]

Replace [Source Language] with the name of the detected source language, written in ${setting.name} (e.g. if translating to Thai, write "ภาษาสเปน". If translating to English, write "SPANISH"). 
Do not add any extra explanations or conversational text.`;

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
            let translatedText = result;
            let detectedLang = "UNKNOWN";

            // Parse the AI's response to separate the language from the translation
            if (result.startsWith("SRC:")) {
                const lines = result.split('\n');
                // Grab the first line, remove "SRC:", and make it uppercase for English/Spanish
                detectedLang = lines.shift().substring(4).trim().toUpperCase();
                // The rest of the lines are the actual translation
                translatedText = lines.join('\n').trim();
            }

            // Replace the {LANG} placeholder in our template with the detected language
            const finalHeader = setting.header.replace('{LANG}', detectedLang);

            await message.reply({
                content: `${finalHeader}\n${translatedText}\n${setting.warning}`,
                allowedMentions: { repliedUser: false }
            });
        }
        return true;

    } catch (error) {
        console.error("Database Translator Error:", error);
        return false;
    }
};
