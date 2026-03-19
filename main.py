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
import time

# تحميل الإعدادات
load_dotenv()

TOKEN = os.getenv('DISCORD_TOKEN')
WEBHOOK_URL = os.getenv('WEBHOOK_URL')
TARGET_USER_ID = int(os.getenv('TARGET_USER_ID'))
FLASK_PORT = int(os.getenv('FLASK_PORT', 10000)) # بورت رندر الافتراضي

# إعداد السجلات (Logging)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# إعداد الـ Self-bot
# ملاحظة: تم تفعيل self_bot=True ليقبل توكن حسابك الشخصي
bot = commands.Bot(command_prefix='!', self_bot=True, help_command=None)

user_voice_sessions = {}

# ==================== Flask Keep-Alive Server ====================
app = Flask(__name__)

@app.route('/')
def home():
    return {"status": "online", "message": "Monitoring System is Running"}, 200

def run_flask():
    try:
        app.run(host='0.0.0.0', port=FLASK_PORT)
    except Exception as e:
        logger.error(f"❌ Flask Error: {e}")

# ==================== Webhook Integration ====================
def send_webhook_embed(title, description, color, fields=None):
    try:
        embed_data = {
            "embeds": [{
                "title": title,
                "description": description,
                "color": color,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "footer": {"text": "Security Logging System 2026"}
            }]
        }
        if fields:
            embed_data["embeds"][0]["fields"] = fields
        
        requests.post(WEBHOOK_URL, json=embed_data, timeout=10)
    except Exception as e:
        logger.error(f"❌ Webhook Error: {e}")

# ==================== Events ====================
@bot.event
async def on_ready():
    logger.info(f"✅ Logged in as: {bot.user}")
    send_webhook_embed("🚀 النظام متصل", f"بدأ رصد الحساب: **{bot.user}**", 0x00FF00)

@bot.event
async def on_voice_state_update(member, before, after):
    if member.id != TARGET_USER_ID:
        return
    
    try:
        # حالة الدخول
        if before.channel is None and after.channel is not None:
            user_voice_sessions[member.id] = datetime.utcnow()
            msg = f"👤 {member.mention} دخل الروم: `{after.channel.name}`\n🏠 السيرفر: `{after.channel.guild.name}`"
            send_webhook_embed("🟢 دخول روم صوتي", msg, 0x00FF00)
            
        # حالة الخروج وحساب المدة
        elif before.channel is not None and after.channel is None:
            start_time = user_voice_sessions.pop(member.id, None)
            duration_str = "غير معروفة"
            if start_time:
                duration = datetime.utcnow() - start_time
                mins, secs = divmod(duration.total_seconds(), 60)
                duration_str = f"{int(mins)} دقيقة و {int(secs)} ثانية"
            
            msg = f"👤 {member.mention} غادر الروم: `{before.channel.name}`\n⏱ مدة التواجد: `{duration_str}`"
            send_webhook_embed("🔴 خروج من الروم", msg, 0xFF0000)
    except Exception as e:
        logger.error(f"❌ Voice Error: {e}")

@bot.event
async def on_message(message):
    if message.author.id != TARGET_USER_ID or message.author.bot:
        return
        
    try:
        content = message.content if message.content else "[صورة أو ملف]"
        fields = [{
            "name": "📝 محتوى الرسالة",
            "value": f"
http://googleusercontent.com/immersive_entry_chip/0

---

### 💡 تعليمات هامة للتشغيل في Render:

1.  **Environment Variables:** تأكد أنك أضفت `DISCORD_TOKEN` و `WEBHOOK_URL` و `TARGET_USER_ID` في لوحة تحكم Render.
2.  **الـ Port:** السكربت مبرمج على بورت `10000` وهو المتوافق مع Render.
3.  **تجاوز الـ 429:** إذا استمر ظهور خطأ `Cloudflare Ban` في السجلات (Logs)، اذهب إلى **Settings** في رندر وغير الـ **Region** (مثلاً من Frankfurt إلى Oregon أو Ohio). هذا سيغير الـ IP الخاص بك وغالباً سيحل المشكلة.

**بهذا الكود، النظام صار "مضبوط" تقنياً. هل تريد مني مساعدتك في اختبار الويب هوك قبل الرفع؟**
