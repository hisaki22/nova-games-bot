# Nova Games Bot 🎮

بوت Discord عربي يحتوي على ألعاب ممتعة.

## الألعاب
- 🕵️ **Imposter** — لعبة المحقق والمجرم
- 🔤 **Scramble** — حزر الكلمة المبعثرة
- 🔍 **Search** — لعبة البحث عن الكلمات
- 🎰 **Roulette** — لعبة الروليت
- ❌⭕ **HotXO** — لعبة إكس أو

## النشر على Railway

### الخطوات:

1. ادخل على [railway.app](https://railway.app) وسجل دخول بحساب GitHub
2. اضغط **New Project** → **Deploy from GitHub repo**
3. اختر مستودع `nova-games-bot`
4. اضغط على **Add a Service** → **Database** → **Add PostgreSQL** (مهم!)
5. اذهب إلى إعدادات مشروعك → **Variables** → أضف المتغيرات التالية:

### المتغيرات المطلوبة:

| المتغير | الوصف | مطلوب |
|---------|-------|--------|
| `DISCORD_BOT_TOKEN` | توكن البوت من Discord Developer Portal | ✅ مطلوب |
| `DATABASE_URL` | يُنشأ تلقائياً عند إضافة PostgreSQL | ✅ مطلوب |

### متغيرات اختيارية:

| المتغير | الوصف |
|---------|-------|
| `OPENAI_API_KEY` | لتفعيل ميزات الذكاء الاصطناعي |
| `GROQ_API_KEY` | بديل لـ OpenAI |

6. اضغط **Deploy** ✅

## ملاحظة مهمة
⚠️ يجب إضافة قاعدة بيانات PostgreSQL من Railway قبل تشغيل البوت.  
البوت يحفظ النقاط والإعدادات في PostgreSQL، وبدونها ستُفقد البيانات عند كل إعادة تشغيل.

## المتطلبات
- Node.js 18+
- توكن بوت Discord
- قاعدة بيانات PostgreSQL (من Railway)
