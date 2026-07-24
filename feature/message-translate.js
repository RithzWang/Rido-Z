module.exports = async (message) => {
    if (message.channel.id !== '907979176236163133') return false;
    if (!message.content.trim()) return false;

    try {
        const text = message.content.trim();
        let finalTranslation = "";
        let detectedLang = "";
        let usedHeader = "";
        let warningText = "";

        // --- 1. TRY GOOGLE TRANSLATE FIRST ---
        try {
            const urlEn = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
            const resEn = await fetch(urlEn);
            const dataEn = await resEn.json();

            detectedLang = dataEn[2] || "";

            if (detectedLang.startsWith('ar')) {
                finalTranslation = dataEn[0].map(item => item[0]).join('');
                usedHeader = "-# **Translation:**";
                warningText = "-#   - AI translation is not 100% accurate";
            } else if (detectedLang.startsWith('en')) {
                const urlAr = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=${encodeURIComponent(text)}`;
                const resAr = await fetch(urlAr);
                const dataAr = await resAr.json();
                finalTranslation = dataAr[0].map(item => item[0]).join('');
                usedHeader = "-# **ترجمة:**";
                warningText = "-#   - الترجمة الآلية ليست دقيقة 100%";
            }
        } catch (googleError) {
            console.warn("⚠️ Google Translate failed, falling back to DeepL:", googleError.message);
        }

        // --- 2. FALLBACK TO DEEPL IF GOOGLE FAILED ---
        if (!finalTranslation && process.env.DEEPL_API_KEY) {
            const response = await fetch('https://api-free.deepl.com/v2/translate', {
                method: 'POST',
                headers: { 'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: [text], target_lang: 'EN-US' })
            });
            const data = await response.json();
            const deeplDetected = data.translations[0].detected_source_language;

            if (deeplDetected === 'AR') {
                finalTranslation = data.translations[0].text;
                usedHeader = "-# **Translation:**";
                warningText = "-#   - AI translation is not 100% accurate";
            } else if (deeplDetected === 'EN') {
                const resAr = await fetch('https://api-free.deepl.com/v2/translate', {
                    method: 'POST',
                    headers: { 'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: [text], target_lang: 'AR' })
                });
                const dataAr = await resAr.json();
                finalTranslation = dataAr.translations[0].text;
                usedHeader = "-# **ترجمة:**";
                warningText = "-#   - الترجمة الآلية ليست دقيقة 100%";
            }
        }

        if (finalTranslation && finalTranslation.toLowerCase() !== text.toLowerCase()) {
            await message.reply({
                content: `${usedHeader}\n${finalTranslation}\n${warningText}`,
                allowedMentions: { repliedUser: false }
            });
        }
        return true;
    } catch (error) {
        console.error("❌ Translate Error (Ar <-> En):", error);
        return false;
    }
};
