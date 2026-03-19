import discord
from discord.ext import commands
import datetime
import json
import aiohttp
import asyncio

# ===================== CONFIGURATION =====================
# ملاحظة: للحصول على التوكن، يتم استخراجه من الـ Console الخاص بالمتصفح (Network tab)
USER_TOKEN     = "YOUR_USER_TOKEN_HERE" 
TARGET_USER_ID = 123456789012345678       
WEBHOOK_URL    = "YOUR_WEBHOOK_URL_HERE"  
LOG_FILE       = "forensics_log.json"
# =========================================================

# استخدام مكتبة discord.py-self
# تثبيت: pip install discord.py-self
client = discord.Client()
events_log = []

# ============================================================
# أدوات مساعدة (نفس المنطق السابق مع تحسين التوافق)
# ============================================================

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
    """إرسال تنبيه عبر Webhook"""
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
        "footer": {"text": "🔍 User-Level Forensics | KAU Research"}
    }

# ============================================================
# الأحداث (Events)
# ============================================================

@client.event
async def on_ready():
    print(f"✅ تم تسجيل الدخول كحساب شخصي: {client.user}")
    print(f"🔍 مراقبة الهدف: {TARGET_USER_ID}")
    print("---")

@client.event
async def on_voice_state_update(member, before, after):
    if member.id != TARGET_USER_ID:
        return

    # منطق المراقبة الصوتية (نفس الكود السابق يعمل هنا)
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
    # في الحساب الشخصي، يمكنك مراقبة حتى الرسائل الخاصة (DMs) التي يراها حسابك
    if message.author.id != TARGET_USER_ID:
        return

    is_dm = isinstance(message.channel, discord.DMChannel)
    loc = "Direct Message" if is_dm else f"Guild: {message.guild.name} | Channel: {message.channel.name}"

    save_event("MESSAGE_SENT", {
        "location": loc,
        "length": len(message.content),
        "has_attachments": bool(message.attachments)
    })

    embed = make_embed("📝 رسالة صادرة من الهدف", 0x3498db, [
        {"name": "الموقع", "value": loc},
        {"name": "محتوى (Length)", "value": f"{len(message.content)} chars"}
    ])
    await send_webhook(embed)

@client.event
async def on_typing(channel, user, when):
    if user.id != TARGET_USER_ID:
        return
    
    embed = make_embed("⌨️ بدأ الكتابة", 0xf1c40f, [
        {"name": "القناة", "value": str(channel)}
    ])
    await send_webhook(embed)

# ============================================================
# التشغيل
# ============================================================

if __name__ == "__main__":
    # ملاحظة: في discord.py-self، نستخدم bot=False
    try:
        client.run(USER_TOKEN, bot=False)
    except discord.LoginFailure:
        print("❌ فشل تسجيل الدخول: التوكن غير صحيح.")
    except Exception as e:
        print(f"❌ حدث خطأ: {e}")
