module.exports = async (message) => {
    if (message.channel.id !== '880430039919906826') return false;
    if (!message.content.trim()) return false;

    try {
        const text = message.content.trim();
        const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
        if (!DEEPL_API_KEY) return false;

        const response = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            headers: { 'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: [text], target_lang: 'ES' }) // Target: Spanish
        });
        const data = await response.json();
        
        const detectedLang = data.translations[0].detected_source_language; 
        const finalTranslation = data.translations[0].text;

        // Only reply if the language wasn't already Spanish
        if (detectedLang !== 'ES' && finalTranslation.toLowerCase() !== text.toLowerCase()) {
            await message.reply({
                content: `-# **Traducción:**\n${finalTranslation}`,
                allowedMentions: { repliedUser: false } 
            });
        }
        return true; 
    } catch (error) {
        console.error("❌ DeepL Spanish Translate Error:", error);
        return false;
    }
};
