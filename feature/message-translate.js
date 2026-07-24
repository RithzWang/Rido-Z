module.exports = async (message) => {
    if (message.channel.id !== '907979176236163133') return false;
    if (!message.content.trim()) return false;

    try {
        const text = message.content.trim();
        const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
        if (!DEEPL_API_KEY) return false;

        // Default request: Translate to English (EN-US)
        let response = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            headers: { 'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: [text], target_lang: 'EN-US' })
        });
        let data = await response.json();
        
        const detectedLang = data.translations[0].detected_source_language; 
        let finalTranslation = "";
        let translationHeader = "";
        let warningText = "";

        if (detectedLang === 'AR') {
            // It was Arabic -> English
            finalTranslation = data.translations[0].text;
            translationHeader = "-# **Translation:**";
            warningText = "-#   - AI translation is not 100% accurate";
        } 
        else if (detectedLang === 'EN') {
            // It was English -> Arabic
            response = await fetch('https://api-free.deepl.com/v2/translate', {
                method: 'POST',
                headers: { 'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: [text], target_lang: 'AR' })
            });
            data = await response.json();
            finalTranslation = data.translations[0].text;
            translationHeader = "-# **ترجمة:**";
            warningText = "-#   - الترجمة AI ليست دقيقة 100%";
        }

        if (finalTranslation && finalTranslation.toLowerCase() !== text.toLowerCase()) {
            await message.reply({
                content: `${translationHeader}\n${finalTranslation}\n${warningText}`,
                allowedMentions: { repliedUser: false } 
            });
        }
        return true; 
    } catch (error) {
        console.error("❌ DeepL Translate Error (Ar <-> En):", error);
        return false;
    }
};
