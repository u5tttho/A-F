import discord
import datetime
import json
import aiohttp
import os
from flask import Flask
from threading import Thread

# ===================== WEB SERVER (Fixed for Render) =====================
app = Flask(__name__)

@app.route('/')
def home():
    return "✅ Forensic System is Online"

def run_server():
    # Render يبحث عن هذا المنفذ لتفعيل الخدمة
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)

# ===================== CONFIGURATION =====================
USER_TOKEN     = os.environ.get("USER_TOKEN")
TARGET_USER_ID = int(os.environ.get("TARGET_USER_ID", 0))
WEBHOOK_URL    = os.environ.get("WEBHOOK_URL")
LOG_FILE       = "forensics_log.json"

# ===================== SETUP =====================
# ملاحظة: في discord.py-self الإصدار الجديد، لا نستخدم Intents بنفس طريقة البوتات
client = discord.Client()
events_log = []

async def send_webhook(embed_data: dict):
    if not WEBHOOK_URL: return
    async with aiohttp.ClientSession() as session:
        payload = {"embeds": [embed_data]}
        await session.post(WEBHOOK_URL, json=payload)

def make_embed(title: str, color: int, fields: list) -> dict:
    return {
        "title": title,
        "color": color,
        "fields": [{"name": f["name"], "value": str(f["value"]), "inline": f.get("inline", True)} for f in fields],
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "footer": {"text": "🔍 KAU Forensics Research"}
    }

# ===================== EVENTS =====================

@client.event
async def on_ready():
    print(f"✅ Logged in as: {client.user}")
    print(f"🔍 Monitoring ID: {TARGET_USER_ID}")

@client.event
async def on_voice_state_update(member, before, after):
    if member.id != TARGET_USER_ID: return
    if before.channel != after.channel and after.channel:
        embed = make_embed("🔊 نشاط صوتي", 0x2ecc71, [
            {"name": "القناة", "value": after.channel.name},
            {"name": "السيرفر", "value": after.channel.guild.name}
        ])
        await send_webhook(embed)

@client.event
async def on_message(message):
    if message.author.id != TARGET_USER_ID: return
    embed = make_embed("📝 رسالة صادرة", 0x3498db, [
        {"name": "طول الرسالة", "value": f"{len(message.content)} حرف"}
    ])
    await send_webhook(embed)

# ===================== EXECUTION =====================

if __name__ == "__main__":
    if not USER_TOKEN:
        print("❌ Missing USER_TOKEN in Environment Variables")
    else:
        # 1. تشغيل خادم Flask أولاً ليراه Render
        server_thread = Thread(target=run_server)
        server_thread.daemon = True
        server_thread.start()
        
        print("🚀 Web server started, logging into Discord...")
        
        # 2. تشغيل البوت (تم حذف bot=False لإصلاح الخطأ)
        try:
            client.run(USER_TOKEN)
        except Exception as e:
            print(f"❌ Connection Error: {e}")
