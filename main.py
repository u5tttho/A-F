import os
import discord
from discord.ext import commands
from flask import Flask
from threading import Thread
from datetime import datetime
import requests
import asyncio
from dotenv import load_dotenv
import logging

# 1. إعدادات البيئة
load_dotenv()
TOKEN = os.getenv('DISCORD_TOKEN')
WEBHOOK_URL = os.getenv('WEBHOOK_URL')
TARGET_USER_ID = int(os.getenv('TARGET_USER_ID', 0))
FLASK_PORT = int(os.getenv('FLASK_PORT', 10000))

# 2. إعداد السجلات
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

# 3. إعداد السلف-بوت (Self-bot)
bot = commands.Bot(command_prefix='!', self_bot=True, help_command=None)
user_voice_sessions = {}

# 4. سيرفر ويب بسيط (Keep-Alive) لـ Render
app = Flask(__name__)

@app.route('/')
def home():
    return {"status": "online"}, 200

def run_flask():
    app.run(host='0.0.0.0', port=FLASK_PORT)

# 5. دالة إرسال الويب-هوك
def send_webhook(title, description, color, fields=None):
    try:
        payload = {
            "embeds": [{
                "title": title,
                "description": description,
                "color": color,
                "timestamp": datetime.utcnow().isoformat(),
                "footer": {"text": "Monitoring System 2026"}
            }]
        }
        if fields:
            payload["embeds"][0]["fields"] = fields
        requests.post(WEBHOOK_URL, json=payload, timeout=10)
    except Exception as e:
        logger.error(f"Webhook Error: {e}")

# 6. أحداث الديسكورد
@bot.event
async def on_ready():
    logger.info(f"✅ Connected as: {bot.user}")

@bot.event
async def on_voice_state_update(member, before, after):
    if member.id != TARGET_USER_ID:
        return
    
    # دخول الروم
    if before.channel is None and after.channel is not None:
        user_voice_sessions[member.id] = datetime.utcnow()
        send_webhook("🟢 دخول صوتي", f"دخل {member.mention} إلى `{after.channel.name}`", 0x00FF00)
    
    # خروج وحساب المدة
    elif before.channel is not None and after.channel is None:
        start_time = user_voice_sessions.pop(member.id, None)
        duration_text = "غير معروفة"
        if start_time:
            diff = datetime.utcnow() - start_time
            m, s = divmod(int(diff.total_seconds()), 60)
            duration_text = f"{m} دقيقة و {s} ثانية"
        
        send_webhook("🔴 خروج صوتي", f"غادر {member.mention} من `{before.channel.name}`\nالمدة: {duration_text}", 0xFF0000)

@bot.event
async def on_message(message):
    if message.author.id != TARGET_USER_ID or message.author.bot:
        return
    
    # هنا تم إصلاح خطأ الـ f-string بالتأكد من إغلاق كل الأقواس
    content_clean = message.content[:1000] if message.content else "[وسائط/ملفات]"
    msg_fields = [{"name": "📝 النص", "value": f"
http://googleusercontent.com/immersive_entry_chip/0

---

### لماذا هذا الكود سيحل المشكلة؟
1.  **إزالة التعقيد:** قمت بتبسيط الـ `f-string` في سطر الرسائل (الذي كان يسبب الخطأ عندك) ووضعتها في متغير مستقل (`content_clean`) قبل إرسالها.
2.  **تجنب الانقطاع:** تأكدت أن كل علامة تنصيص لها إغلاق مقابل في نفس السطر.
3.  **بورت Render:** تركت البورت متغيراً بحيث يأخذه من إعدادات Render تلقائياً.

### نصيحة لرفع الكود:
تأكد عند نسخ الكود لـ GitHub أنك لم تترك مسافات فارغة غريبة في نهاية الملف، لأن Python حساسة جداً للمسافات (Indentation).

**هل تريد مني أن أوضح لك كيف ترفع هذا الملف تحديداً لـ GitHub بدون ما تظهر أي أخطاء مستقبلاً؟**
