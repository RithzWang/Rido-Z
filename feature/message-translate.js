module.exports = async (message) => {
    // 1. Check if it's the correct channel and the message isn't empty
    if (message.channel.id !== '907979176236163133') return false;
    if (!message.content.trim()) return false;

    try {
        const text = message.content.trim();
        
        // 2. Send request to auto-detect language and translate to English
        const urlEn = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
        const resEn = await fetch(urlEn);
        const dataEn = await resEn.json();
        
        const detectedLang = dataEn[2]; // 'ar' for Arabic, 'en' for English
        let finalTranslation = "";
        let translationHeader = "";

        if (detectedLang.startsWith('ar')) {
            // It is Arabic, translating to English
            finalTranslation = dataEn[0].map(item => item[0]).join('');
            translationHeader = "-# **Translation:**";
        } 
        else if (detectedLang.startsWith('en')) {
            // It is English, translating to Arabic
            const urlAr = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=${encodeURIComponent(text)}`;
            const resAr = await fetch(urlAr);
            const dataAr = await resAr.json();
            finalTranslation = dataAr[0].map(item => item[0]).join('');
            translationHeader = "-# **ترجمة:**";
        }

        // 3. If a valid translation was found, reply without pinging
        if (finalTranslation && finalTranslation.toLowerCase() !== text.toLowerCase()) {
            await message.reply({
                content: `${translationHeader}\n> ${finalTranslation}`,
                allowedMentions: { repliedUser: false } // Prevents pinging the user
            });
        }
        
        // Return true to let index.js know we handled this message
        return true; 

    } catch (error) {
        console.error("❌ Auto-Translate Error:", error);
        return false;
    }
};
