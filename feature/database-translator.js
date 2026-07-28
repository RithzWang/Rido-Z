const { MessageFlags } = require('discord.js');
const Translator = require('../schema/TranslatorSchema.js');

module.exports = async (message) => {
    if (message.author.bot || !message.content.trim()) return false;

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        console.log("⚠️ [Translator] Failed: OPENAI_API_KEY is missing in your .env or host settings!");
        return false;
    }

    try {
        let channelLang = null;

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
If the user's text is in Arabic (including regional dialects, interjections like "هاه", laughter like "ههههه", or slang), translate it to English and prefix your response with "EN:".
If the user's text is in English (including laughter like "hahahaha"), translate it to Arabic and prefix your response with "AR:".
Crucially: Understand chat slang and stretched words with repeated letters. For example, recognize that "بنامممم" means "I will sleep" ("بنام"), not "in the name". Condense elongated words to their base meaning before translating.
Always convert laughter and interjections to natural local equivalents.
IMPORTANT: You MUST preserve all standard emojis, Discord custom emojis (which look like <:name:id> or <a:name:id>), and user/role mentions (which look like @username, <@id>, or <@&id>) exactly as they appear in the original message. Do not translate, remove, or modify them. Place them naturally in the translated text.
Only return the prefixed translation. If the message consists ONLY of emojis or mentions (no text to translate), reply with exactly: ALREADY_BILINGUAL`;

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

        systemPrompt = `You are a highly accurate translator. Your strict goal is to translate text from ANY source language into natural ${setting.name}.
CRITICAL RULES:
1. Whether the user speaks in English, Arabic, Spanish, or any other language, you MUST return the translation in ${setting.name}. 
2. Even if the text is very short (like "What", "Please", "Hello"), you MUST translate it. Never leave English text untranslated.
3. Understand chat slang and stretched words.
4. Preserve all standard emojis, Discord custom emojis (e.g., <:name:id> or <a:name:id>), and user/role mentions (e.g., @username, <@id>, <@&id>) exactly as they appear. Place them logically within the translated sentence.

If the text is ALREADY written entirely natively in ${setting.name}, OR if the message consists ONLY of emojis/mentions (no translatable text), reply with exactly: ${setting.ignore}

Otherwise, you MUST format your response exactly like this example:
SRC: [Source Language in ${setting.name}]
[Translated Text]

Example for translating "@Rithz Please" from English to Thai:
SRC: ภาษาอังกฤษ
@Rithz โปรด`;

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
