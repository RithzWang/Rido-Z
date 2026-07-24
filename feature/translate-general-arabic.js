module.exports = async (message) => {
    if (message.channel.id !== '880431177499029534') return false;
    if (!message.content.trim()) return false;

    try {
        const text = message.content.trim();
        let finalTranslation = "";
        let detectedLang = "";

        // 1. Try Google Translate First
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            const data = await res.json();

            detectedLang = data[2] || "";
            if (!detectedLang.startsWith('ar')) {
                finalTranslation = data[0].map(item => item[0]).join('');
            }
        } catch (err) {
            console.warn("⚠️ Google Translate failed, falling back to DeepL...");
        }

        // 2. Fallback to DeepL
        if (!finalTranslation && !detectedLang.startsWith('ar') && process.env.DEEPL_API_KEY) {
            const res = await fetch('https://api-free.deepl.com/v2/translate', {
                method: 'POST',
                headers: { 'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: [text], target_lang: 'AR' })
            });
            const data = await res.json();
            if (data.translations[0].detected_source_language !== 'AR') {
                finalTranslation = data.translations[0].text;
            }
        }

        if (finalTranslation && finalTranslation.toLowerCase() !== text.toLowerCase()) {
            await message.reply({
                content: `-# **ترجمة:**\n${finalTranslation}\n-#   - الترجمة AI ليست دقيقة 100%`,
                allowedMentions: { repliedUser: false }
            });
        }
        return true;
    } catch (error) {
        console.error("❌ Translate Error (Any -> Ar):", error);
        return false;
    }
};
