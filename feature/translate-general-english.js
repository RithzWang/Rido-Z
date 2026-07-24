module.exports = async (message) => {
    if (message.channel.id !== '878582639215407134') return false;
    if (!message.content.trim()) return false;

    try {
        const text = message.content.trim();
        let finalTranslation = "";
        let detectedLang = "";

        // 1. Try Google Translate First
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            const data = await res.json();

            detectedLang = data[2] || "";
            if (!detectedLang.startsWith('en')) {
                finalTranslation = data[0].map(item => item[0]).join('');
            }
        } catch (err) {
            console.warn("⚠️ Google Translate failed, falling back to DeepL...");
        }

        // 2. Fallback to DeepL
        if (!finalTranslation && !detectedLang.startsWith('en') && process.env.DEEPL_API_KEY) {
            const res = await fetch('https://api-free.deepl.com/v2/translate', {
                method: 'POST',
                headers: { 'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: [text], target_lang: 'EN-US' })
            });
            const data = await res.json();
            if (data.translations[0].detected_source_language !== 'EN') {
                finalTranslation = data.translations[0].text;
            }
        }

        if (finalTranslation && finalTranslation.toLowerCase() !== text.toLowerCase()) {
            await message.reply({
                content: `-# **Translation:**\n${finalTranslation}\n-#   - AI translation is not 100% accurate`,
                allowedMentions: { repliedUser: false }
            });
        }
        return true;
    } catch (error) {
        console.error("❌ Translate General Error (Any -> En):", error);
        return false;
    }
};
