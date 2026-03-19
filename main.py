import discord
import datetime
import json
import aiohttp
import os
import asyncio
from flask import Flask
from threading import Thread

# ===================== WEB SERVER (لإبقاء المشروع حياً على رندر) =====================
app = Flask(__name__)

@app.route('/')
def home():
    return "✅ Discord Forensics Monitor is actively running on Render!"

def run_server():
    # Render يعين رقم بورت تلقائي، يجب أن نستمع له
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)

# ===================== CONFIGURATION =====================
# سحب البيانات الحساسة من متغيرات البيئة بدلاً من الكود المباشر
USER_TOKEN     = os.environ.get("USER_TOKEN")
TARGET_USER_ID = int(os.environ.get("TARGET_USER_ID", 0))
WEBHOOK_URL    = os.environ.get("WEBHOOK_URL")
LOG_FILE       = "forensics_log.json"
# =========================================================

client = discord.Client()
events_log = []

def save_event(event_type: str, details: dict):
    event = {
        "timestamp":  datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "event_type": event_type,
        "details":    details
    }
    events_log.append(event)
    try:
        with open(LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(events_log, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"❌ Error saving log: {e}")
    return event

async def send_webhook(embed_data: dict):
    if not WEBHOOK_URL: return
    async with aiohttp.ClientSession() as session:
        payload = {"embeds": [embed_data]}
        await session.post(WEBHOOK_URL, json=payload)

def get_members_in_channel(channel) -> str:
    if not channel: return "—"
    return ", ".join([m.display_name for m in channel.members])

def make_embed(title: str, color: int, fields: list) -> dict:
    return {
        "title": title,
        "color": color,
        "fields": [{"name": f["name"], "value": str(f["value"]), "inline": f.get("inline", True)} for f in fields],
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "footer": {"text": "🔍 User-Level Forensics | Project Monitor"}
    }

# ===================== EVENTS =====================

@client.event
async def on_ready():
    print(f"✅ تم تسجيل الدخول بنجاح: {client.user}")
    print(f"🔍 جاري مراقبة الهدف: {TARGET_USER_ID}")

@client.event
async def on_voice_state_update(member, before, after):
    if member.id != TARGET_USER_ID: return

    if before.channel != after.channel:
        if after.channel:
            details = {"action": "Join/Move", "channel": after.channel.name, "guild": after.channel.guild.name}
            save_event("VOICE_ACTIVITY", details)
            embed = make_embed("🔊 نشاط صوتي للهدف", 0x2ecc71, [
                {"name": "الحالة", "value": f"دخل/انتقل إلى {after.channel.name}"},
                {"name": "السيرفر", "value": after.channel.guild.name},
                {"name": "المتواجدون", "value": get_members_in_channel(after.channel), "inline": False}
            ])
            await send_webhook(embed)

@client.event
async def on_message(message):
    if message.author.id != TARGET_USER_ID: return

    is_dm = isinstance(message.channel, discord.DMChannel)
    loc = "Direct Message" if is_dm else f"Guild: {message.guild.name} | Channel: {message.channel.name}"

    save_event("MESSAGE_SENT", {"location": loc, "length": len(message.content)})
    embed = make_embed("📝 رسالة صادرة من الهدف", 0x3498db, [
        {"name": "الموقع", "value": loc},
        {"name": "حجم الرسالة", "value": f"{len(message.content)} حرف"}
    ])
    await send_webhook(embed)

@client.event
async def on_typing(channel, user, when):
    if user.id != TARGET_USER_ID: return
    
    embed = make_embed("⌨️ بدأ الكتابة", 0xf1c40f, [{"name": "القناة", "value": str(channel)}])
    await send_webhook(embed)

# ===================== MAIN EXECUTION =====================

if __name__ == "__main__":
    if not USER_TOKEN or not TARGET_USER_ID:
        print("❌ خطأ: المتغيرات (USER_TOKEN) أو (TARGET_USER_ID) غير موجودة.")
    else:
        # 1. تشغيل خادم الويب في مسار (Thread) منفصل
        Thread(target=run_server, daemon=True).start()
        
        # 2. تشغيل بوت المراقبة
        try:
            client.run(USER_TOKEN, bot=False)
        except discord.LoginFailure:
            print("❌ فشل تسجيل الدخول: التوكن غير صحيح أو الحساب تبند.")
        except Exception as e:
            print(f"❌ حدث خطأ غير متوقع: {e}")
