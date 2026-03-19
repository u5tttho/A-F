const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  AuditLogEvent,
  Events
} = require("discord.js");
const fs = require("fs");
const config = require("./config.js");

// ═══════════════════════════════════════
// العميل والإنتنتات
// ═══════════════════════════════════════

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.User
  ]
});

// ═══════════════════════════════════════
// دوال مساعدة — البيانات
// ═══════════════════════════════════════

function getData() {
  try {
    const raw = fs.readFileSync("./data.json", "utf8");
    return JSON.parse(raw);
  } catch (e) {
    const defaultData = { guilds: {}, users: {} };
    fs.writeFileSync("./data.json", JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
}

function saveData(data) {
  try {
    fs.writeFileSync("./data.json", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("خطأ في حفظ البيانات:", e);
  }
}

function getDefaultGuild() {
  return {
    prefix: config.prefix,
    muteRole: null,
    logChannel: null,
    welcomeChannel: null,
    welcomeMessage: "مرحباً {user} في {server}! 🎉",
    leaveChannel: null,
    leaveMessage: "وداعاً {user} 👋",
    autoRole: null,
    verifyChannel: null,
    verifyRole: null,
    verifyType: "button",
    suggestChannel: null,
    levelChannel: null,
    automod: {
      enabled: false,
      antiSpam: true,
      antiLinks: false,
      antiRaid: false,
      maxWarns: 3,
      warnAction: "mute"
    },
    statsChannels: {
      members: null,
      online: null,
      bots: null
    },
    reactionRoles: [],
    buttonRoles: [],
    autoRoles: [],
    levelRoles: [],
    customCommands: [],
    autoResponders: [],
    polls: [],
    suggestions: []
  };
}

function getGuild(guildId) {
  const data = getData();
  if (!data.guilds) data.guilds = {};
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = getDefaultGuild();
    saveData(data);
  }
  const g = data.guilds[guildId];
  const def = getDefaultGuild();
  let changed = false;
  for (const key of Object.keys(def)) {
    if (g[key] === undefined) {
      g[key] = def[key];
      changed = true;
    }
  }
  if (!g.automod) { g.automod = def.automod; changed = true; }
  for (const key of Object.keys(def.automod)) {
    if (g.automod[key] === undefined) {
      g.automod[key] = def.automod[key];
      changed = true;
    }
  }
  if (!g.statsChannels) { g.statsChannels = def.statsChannels; changed = true; }
  if (!g.autoResponders) { g.autoResponders = []; changed = true; }
  if (!g.suggestions) { g.suggestions = []; changed = true; }
  if (changed) {
    data.guilds[guildId] = g;
    saveData(data);
  }
  return g;
}

function getUser(guildId, userId) {
  const data = getData();
  if (!data.users) data.users = {};
  if (!data.users[guildId]) data.users[guildId] = {};
  if (!data.users[guildId][userId]) {
    data.users[guildId][userId] = {
      xp: 0,
      level: 0,
      warns: [],
      lastMessage: 0
    };
    saveData(data);
  }
  return data.users[guildId][userId];
}

function saveGuild(guildId, guildData) {
  const data = getData();
  if (!data.guilds) data.guilds = {};
  data.guilds[guildId] = guildData;
  saveData(data);
}

function saveUser(guildId, userId, userData) {
  const data = getData();
  if (!data.users) data.users = {};
  if (!data.users[guildId]) data.users[guildId] = {};
  data.users[guildId][userId] = userData;
  saveData(data);
}

// ═══════════════════════════════════════
// دوال مساعدة — عامة
// ═══════════════════════════════════════

function calcXP(level) {
  return level * 100 + 200;
}

function formatTime(ms) {
  if (ms < 0) ms = 0;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours % 24 > 0) parts.push(`${hours % 24}h`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
  if (seconds % 60 > 0 && days === 0) parts.push(`${seconds % 60}s`);
  return parts.length > 0 ? parts.join(" ") : "0s";
}

function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(s|m|h|d|w)$/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return num * (multipliers[unit] || 0);
}

function hasPerm(member, perm) {
  if (!member) return false;
  if (member.id === config.ownerId) return true;
  if (member.permissions && member.permissions.has(perm)) return true;
  return false;
}

async function sendLog(guild, embed) {
  try {
    const guildData = getGuild(guild.id);
    if (!guildData.logChannel) return;
    const channel = guild.channels.cache.get(guildData.logChannel);
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
  } catch (e) {
    console.error("خطأ في إرسال اللوق:", e.message);
  }
}

function errorEmbed(description) {
  return new EmbedBuilder()
    .setColor(config.colors.error)
    .setTitle("❌ خطأ")
    .setDescription(description)
    .setTimestamp();
}

function successEmbed(description) {
  return new EmbedBuilder()
    .setColor(config.colors.success)
    .setTitle("✅ تم")
    .setDescription(description)
    .setTimestamp();
}

function infoEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function getPrefix(guildId) {
  if (!guildId) return config.prefix;
  const guildData = getGuild(guildId);
  return guildData.prefix || config.prefix;
}

// ═══════════════════════════════════════
// Anti-Spam تتبع
// ═══════════════════════════════════════

const spamMap = new Map();
const raidMap = new Map();
const captchaMap = new Map();

// ═══════════════════════════════════════
// جاهز
// ═══════════════════════════════════════

client.once("ready", () => {
  console.log(`═══════════════════════════════════════`);
  console.log(`✅ البوت شغّال: ${client.user.tag}`);
  console.log(`📡 السيرفرات: ${client.guilds.cache.size}`);
  console.log(`👥 الأعضاء: ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`);
  console.log(`═══════════════════════════════════════`);

  client.user.setActivity("!help | نظام متكامل", { type: 3 });

  // تحديث قنوات الإحصائيات كل 10 دقائق
  setInterval(() => {
    updateAllStatsChannels();
  }, 600000);

  // تحديث أولي
  setTimeout(() => {
    updateAllStatsChannels();
  }, 5000);
});

// ═══════════════════════════════════════
// تحديث قنوات الإحصائيات
// ═══════════════════════════════════════

async function updateAllStatsChannels() {
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const guildData = getGuild(guildId);
      if (!guildData.statsChannels) continue;

      const members = await guild.members.fetch().catch(() => guild.members.cache);

      if (guildData.statsChannels.members) {
        const ch = guild.channels.cache.get(guildData.statsChannels.members);
        if (ch) {
          await ch.setName(`👥 الأعضاء: ${guild.memberCount.toLocaleString()}`).catch(() => {});
        }
      }

      if (guildData.statsChannels.online) {
        const ch = guild.channels.cache.get(guildData.statsChannels.online);
        if (ch) {
          const online = members.size ? members.filter(m => m.presence && m.presence.status !== "offline").size : 0;
          await ch.setName(`🟢 أونلاين: ${online.toLocaleString()}`).catch(() => {});
        }
      }

      if (guildData.statsChannels.bots) {
        const ch = guild.channels.cache.get(guildData.statsChannels.bots);
        if (ch) {
          const bots = members.size ? members.filter(m => m.user.bot).size : 0;
          await ch.setName(`🤖 بوتات: ${bots.toLocaleString()}`).catch(() => {});
        }
      }
    } catch (e) {
      // تجاهل
    }
  }
}

// ═══════════════════════════════════════
// حدث انضمام عضو
// ═══════════════════════════════════════

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const guildData = getGuild(member.guild.id);

    // Anti-Raid
    if (guildData.automod && guildData.automod.enabled && guildData.automod.antiRaid) {
      const now = Date.now();
      const key = member.guild.id;
      if (!raidMap.has(key)) raidMap.set(key, []);
      const joins = raidMap.get(key);
      joins.push(now);
      const recentJoins = joins.filter(t => now - t < 60000);
      raidMap.set(key, recentJoins);

      if (recentJoins.length > 10) {
        // Lockdown
        const channels = member.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
        for (const [, ch] of channels) {
          try {
            await ch.permissionOverwrites.edit(member.guild.roles.everyone, {
              SendMessages: false
            });
          } catch (e) { }
        }

        const logEmbed = new EmbedBuilder()
          .setColor(config.colors.error)
          .setTitle("🚨 تم تفعيل الـ Lockdown — Anti-Raid")
          .setDescription(`انضم أكثر من 10 أعضاء في دقيقة واحدة!\nتم منع الإرسال في كل القنوات.`)
          .setTimestamp();
        await sendLog(member.guild, logEmbed);

        raidMap.set(key, []);
      }
    }

    // رسالة ترحيب
    if (guildData.welcomeChannel) {
      const channel = member.guild.channels.cache.get(guildData.welcomeChannel);
      if (channel) {
        let msg = guildData.welcomeMessage || "مرحباً {user} في {server}! 🎉";
        msg = msg.replace(/{user}/g, `<@${member.id}>`);
        msg = msg.replace(/{server}/g, member.guild.name);
        msg = msg.replace(/{memberCount}/g, member.guild.memberCount.toString());
        msg = msg.replace(/{userId}/g, member.id);

        const embed = new EmbedBuilder()
          .setColor(config.colors.success)
          .setTitle("👋 عضو جديد!")
          .setDescription(msg)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .addFields(
            { name: "العضو", value: `${member.user.tag}`, inline: true },
            { name: "عدد الأعضاء", value: `${member.guild.memberCount}`, inline: true },
            { name: "تاريخ الإنشاء", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
          )
          .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    // Auto Role
    if (guildData.autoRole) {
      const role = member.guild.roles.cache.get(guildData.autoRole);
      if (role) {
        await member.roles.add(role).catch(() => {});
      }
    }

    // Auto Roles (متعدد)
    if (guildData.autoRoles && guildData.autoRoles.length > 0) {
      for (const roleId of guildData.autoRoles) {
        const role = member.guild.roles.cache.get(roleId);
        if (role) {
          await member.roles.add(role).catch(() => {});
        }
      }
    }

    // لوق الانضمام
    const joinLog = new EmbedBuilder()
      .setColor(config.colors.success)
      .setTitle("📥 عضو انضم")
      .setDescription(`${member.user.tag} (<@${member.id}>)`)
      .addFields(
        { name: "الحساب أُنشئ", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: "عدد الأعضاء الآن", value: `${member.guild.memberCount}`, inline: true }
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();
    await sendLog(member.guild, joinLog);
  } catch (e) {
    console.error("خطأ في GuildMemberAdd:", e.message);
  }
});

// ═══════════════════════════════════════
// حدث خروج عضو
// ═══════════════════════════════════════

client.on(Events.GuildMemberRemove, async (member) => {
  try {
    const guildData = getGuild(member.guild.id);

    // رسالة توديع
    if (guildData.leaveChannel) {
      const channel = member.guild.channels.cache.get(guildData.leaveChannel);
      if (channel) {
        let msg = guildData.leaveMessage || "وداعاً {user} 👋";
        msg = msg.replace(/{user}/g, member.user.tag);
        msg = msg.replace(/{server}/g, member.guild.name);
        msg = msg.replace(/{memberCount}/g, member.guild.memberCount.toString());
        msg = msg.replace(/{userId}/g, member.id);

        const embed = new EmbedBuilder()
          .setColor(config.colors.error)
          .setTitle("👋 عضو غادر")
          .setDescription(msg)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    // لوق المغادرة
    const leaveLog = new EmbedBuilder()
      .setColor(config.colors.error)
      .setTitle("📤 عضو غادر")
      .setDescription(`${member.user.tag} (<@${member.id}>)`)
      .addFields(
        { name: "انضم في", value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "غير معروف", inline: true },
        { name: "عدد الأعضاء الآن", value: `${member.guild.memberCount}`, inline: true }
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();
    await sendLog(member.guild, leaveLog);
  } catch (e) {
    console.error("خطأ في GuildMemberRemove:", e.message);
  }
});

// ═══════════════════════════════════════
// حدث حذف رسالة
// ═══════════════════════════════════════

client.on(Events.MessageDelete, async (message) => {
  try {
    if (!message.guild) return;
    if (message.partial) return;
    if (message.author && message.author.bot) return;

    const logEmbed = new EmbedBuilder()
      .setColor(config.colors.warning)
      .setTitle("🗑 رسالة محذوفة")
      .addFields(
        { name: "الكاتب", value: message.author ? `${message.author.tag} (<@${message.author.id}>)` : "غير معروف", inline: true },
        { name: "القناة", value: `<#${message.channel.id}>`, inline: true },
        { name: "المحتوى", value: message.content ? message.content.substring(0, 1024) : "*لا يوجد نص*" }
      )
      .setTimestamp();

    await sendLog(message.guild, logEmbed);
  } catch (e) {
    // تجاهل
  }
});

// ═══════════════════════════════════════
// حدث تعديل رسالة
// ═══════════════════════════════════════

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  try {
    if (!newMessage.guild) return;
    if (oldMessage.partial || newMessage.partial) return;
    if (newMessage.author && newMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const logEmbed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle("✏️ رسالة معدّلة")
      .addFields(
        { name: "الكاتب", value: newMessage.author ? `${newMessage.author.tag} (<@${newMessage.author.id}>)` : "غير معروف", inline: true },
        { name: "القناة", value: `<#${newMessage.channel.id}>`, inline: true },
        { name: "قبل", value: oldMessage.content ? oldMessage.content.substring(0, 1024) : "*فارغ*" },
        { name: "بعد", value: newMessage.content ? newMessage.content.substring(0, 1024) : "*فارغ*" }
      )
      .setTimestamp();

    await sendLog(newMessage.guild, logEmbed);
  } catch (e) {
    // تجاهل
  }
});

// ═══════════════════════════════════════
// حدث تغيير رولات العضو
// ═══════════════════════════════════════

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  try {
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    const addedRoles = newRoles.filter(r => !oldRoles.has(r.id));
    const removedRoles = oldRoles.filter(r => !newRoles.has(r.id));

    if (addedRoles.size > 0 || removedRoles.size > 0) {
      const fields = [];
      if (addedRoles.size > 0) {
        fields.push({ name: "➕ رولات أُضيفت", value: addedRoles.map(r => `<@&${r.id}>`).join(", ") });
      }
      if (removedRoles.size > 0) {
        fields.push({ name: "➖ رولات أُزيلت", value: removedRoles.map(r => `<@&${r.id}>`).join(", ") });
      }

      const logEmbed = new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle("🔄 تغيير رولات")
        .setDescription(`العضو: ${newMember.user.tag} (<@${newMember.id}>)`)
        .addFields(fields)
        .setTimestamp();

      await sendLog(newMember.guild, logEmbed);
    }
  } catch (e) {
    // تجاهل
  }
});

// ═══════════════════════════════════════
// حدث Reaction Add — Reaction Roles
// ═══════════════════════════════════════

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  try {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (!reaction.message.guild) return;

    const guildData = getGuild(reaction.message.guild.id);
    if (!guildData.reactionRoles) return;

    const rr = guildData.reactionRoles.find(
      r => r.messageId === reaction.message.id && r.emoji === (reaction.emoji.id || reaction.emoji.name)
    );

    if (rr) {
      const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
      if (member) {
        const role = reaction.message.guild.roles.cache.get(rr.roleId);
        if (role) {
          await member.roles.add(role).catch(() => {});
        }
      }
    }
  } catch (e) {
    // تجاهل
  }
});

// ═══════════════════════════════════════
// حدث Reaction Remove — Reaction Roles
// ═══════════════════════════════════════

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  try {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});
    if (!reaction.message.guild) return;

    const guildData = getGuild(reaction.message.guild.id);
    if (!guildData.reactionRoles) return;

    const rr = guildData.reactionRoles.find(
      r => r.messageId === reaction.message.id && r.emoji === (reaction.emoji.id || reaction.emoji.name)
    );

    if (rr) {
      const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
      if (member) {
        const role = reaction.message.guild.roles.cache.get(rr.roleId);
        if (role) {
          await member.roles.remove(role).catch(() => {});
        }
      }
    }
  } catch (e) {
    // تجاهل
  }
});

// ═══════════════════════════════════════
// حدث التفاعل مع الأزرار
// ═══════════════════════════════════════

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isButton()) return;

    // Button Roles
    if (interaction.customId.startsWith("btnrole_")) {
      const roleId = interaction.customId.replace("btnrole_", "");
      const member = interaction.member;
      const role = interaction.guild.roles.cache.get(roleId);

      if (!role) {
        return interaction.reply({ content: "❌ الرول غير موجود.", ephemeral: true });
      }

      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(role).catch(() => {});
        return interaction.reply({ content: `✅ تم إزالة الرول ${role.name}`, ephemeral: true });
      } else {
        await member.roles.add(role).catch(() => {});
        return interaction.reply({ content: `✅ تم إعطاؤك الرول ${role.name}`, ephemeral: true });
      }
    }

    // Verify Button
    if (interaction.customId === "verify_button") {
      const guildData = getGuild(interaction.guild.id);
      if (!guildData.verifyRole) {
        return interaction.reply({ content: "❌ لم يتم إعداد رول التحقق.", ephemeral: true });
      }

      const member = interaction.member;
      const role = interaction.guild.roles.cache.get(guildData.verifyRole);
      if (!role) {
        return interaction.reply({ content: "❌ الرول غير موجود.", ephemeral: true });
      }

      if (member.roles.cache.has(role.id)) {
        return interaction.reply({ content: "✅ أنت متحقق بالفعل!", ephemeral: true });
      }

      if (guildData.verifyType === "captcha") {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        captchaMap.set(`${interaction.guild.id}_${member.id}`, {
          code: code,
          expires: Date.now() + 300000
        });

        try {
          await member.send({
            embeds: [
              new EmbedBuilder()
                .setColor(config.colors.info)
                .setTitle("🔐 رمز التحقق")
                .setDescription(`رمز التحقق الخاص بك هو: **${code}**\n\nاكتب هذا الرمز في قناة التحقق خلال 5 دقائق.`)
                .setTimestamp()
            ]
          });
          return interaction.reply({ content: "📩 تم إرسال رمز التحقق في رسائلك الخاصة. اكتبه هنا.", ephemeral: true });
        } catch (e) {
          return interaction.reply({ content: "❌ لا أستطيع إرسال رسالة خاصة لك. فعّل الرسائل الخاصة.", ephemeral: true });
        }
      } else {
        await member.roles.add(role).catch(() => {});
        return interaction.reply({ content: "✅ تم التحقق بنجاح! مرحباً بك.", ephemeral: true });
      }
    }

    // Setup Wizard Buttons
    if (interaction.customId.startsWith("setup_")) {
      if (!hasPerm(interaction.member, PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "❌ تحتاج صلاحية المدير.", ephemeral: true });
      }

      const step = interaction.customId.replace("setup_", "");
      const prefix = getPrefix(interaction.guild.id);

      const instructions = {
        logs: `اكتب في الشات:\n\`${prefix}setlog #اسم-القناة\``,
        welcome: `اكتب في الشات:\n\`${prefix}setwelcome #اسم-القناة رسالة الترحيب\`\nالمتغيرات: {user} {server} {memberCount}`,
        autorole: `اكتب في الشات:\n\`${prefix}setautorole @الرول\``,
        automod: `اكتب في الشات:\n\`${prefix}automod spam on\`\n\`${prefix}automod links on\`\n\`${prefix}automod raid on\``,
        verify: `اكتب في الشات:\n\`${prefix}setverify #اسم-القناة @الرول button\`\nأو\n\`${prefix}setverify #اسم-القناة @الرول captcha\``,
        levels: `اكتب في الشات:\n\`${prefix}setlevelchannel #اسم-القناة\``
      };

      const desc = instructions[step] || "غير معروف";
      return interaction.reply({
        embeds: [infoEmbed(`📋 إعداد: ${step}`, desc)],
        ephemeral: true
      });
    }

    // Poll Buttons
    if (interaction.customId.startsWith("poll_")) {
      const parts = interaction.customId.split("_");
      const pollId = parts[1];
      const optionIndex = parseInt(parts[2]);

      const guildData = getGuild(interaction.guild.id);
      const poll = guildData.polls.find(p => p.id === pollId);

      if (!poll) {
        return interaction.reply({ content: "❌ التصويت غير موجود.", ephemeral: true });
      }

      if (poll.endTime && Date.now() > poll.endTime) {
        return interaction.reply({ content: "❌ انتهى وقت التصويت.", ephemeral: true });
      }

      // إزالة تصويت سابق
      for (let i = 0; i < poll.options.length; i++) {
        const idx = poll.options[i].voters.indexOf(interaction.user.id);
        if (idx > -1) {
          poll.options[i].voters.splice(idx, 1);
          poll.options[i].votes--;
        }
      }

      // إضافة التصويت الجديد
      poll.options[optionIndex].voters.push(interaction.user.id);
      poll.options[optionIndex].votes++;

      saveGuild(interaction.guild.id, guildData);

      // تحديث الـ embed
      const totalVotes = poll.options.reduce((a, o) => a + o.votes, 0);
      const pollEmbed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle(`📊 ${poll.question}`)
        .setDescription(
          poll.options.map((o, i) => {
            const percent = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
            const bar = "█".repeat(Math.floor(percent / 5)) + "░".repeat(20 - Math.floor(percent / 5));
            return `**${i + 1}.** ${o.text}\n${bar} ${percent}% (${o.votes} صوت)`;
          }).join("\n\n")
        )
        .setFooter({ text: `إجمالي الأصوات: ${totalVotes}` })
        .setTimestamp();

      await interaction.update({ embeds: [pollEmbed] }).catch(() => {});
    }

    // Suggestion Accept/Reject
    if (interaction.customId.startsWith("suggest_accept_") || interaction.customId.startsWith("suggest_reject_")) {
      if (!hasPerm(interaction.member, PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: "❌ لا تملك الصلاحية.", ephemeral: true });
      }

      const isAccept = interaction.customId.startsWith("suggest_accept_");
      const sugId = interaction.customId.split("_")[2];

      const guildData = getGuild(interaction.guild.id);
      const sug = guildData.suggestions.find(s => s.id === sugId);

      if (!sug) {
        return interaction.reply({ content: "❌ الاقتراح غير موجود.", ephemeral: true });
      }

      sug.status = isAccept ? "accepted" : "rejected";
      sug.reviewedBy = interaction.user.id;
      saveGuild(interaction.guild.id, guildData);

      const color = isAccept ? config.colors.success : config.colors.error;
      const status = isAccept ? "✅ مقبول" : "❌ مرفوض";

      const sugEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`💡 اقتراح — ${status}`)
        .setDescription(sug.content)
        .addFields(
          { name: "المقترح", value: `<@${sug.userId}>`, inline: true },
          { name: "الحالة", value: status, inline: true },
          { name: "تمت المراجعة بواسطة", value: `<@${interaction.user.id}>`, inline: true }
        )
        .setTimestamp();

      await interaction.update({ embeds: [sugEmbed], components: [] }).catch(() => {});
    }

  } catch (e) {
    console.error("خطأ في التفاعل:", e.message);
    if (interaction.replied || interaction.deferred) return;
    interaction.reply({ content: "❌ حدث خطأ.", ephemeral: true }).catch(() => {});
  }
});

// ═══════════════════════════════════════
// حدث الرسائل — الأوامر + الأنظمة
// ═══════════════════════════════════════

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) {
      // التحقق من captcha عبر DM — لا نعالج هنا، بل في القناة
      return;
    }

    const guildData = getGuild(message.guild.id);
    const prefix = guildData.prefix || config.prefix;

    // ═══ التحقق Captcha ═══
    if (guildData.verifyChannel && message.channel.id === guildData.verifyChannel && guildData.verifyType === "captcha") {
      const captchaKey = `${message.guild.id}_${message.author.id}`;
      const captchaData = captchaMap.get(captchaKey);

      if (captchaData) {
        await message.delete().catch(() => {});

        if (Date.now() > captchaData.expires) {
          captchaMap.delete(captchaKey);
          const dm = await message.author.send({ embeds: [errorEmbed("انتهت صلاحية الرمز. اضغط الزر مرة أخرى.")] }).catch(() => null);
          return;
        }

        if (message.content.trim() === captchaData.code) {
          const role = message.guild.roles.cache.get(guildData.verifyRole);
          if (role) {
            const member = await message.guild.members.fetch(message.author.id).catch(() => null);
            if (member) {
              await member.roles.add(role).catch(() => {});
            }
          }
          captchaMap.delete(captchaKey);
          await message.author.send({ embeds: [successEmbed("✅ تم التحقق بنجاح!")] }).catch(() => {});
        } else {
          await message.author.send({ embeds: [errorEmbed("❌ الرمز غير صحيح. حاول مرة أخرى.")] }).catch(() => {});
        }
        return;
      }
    }

    // ═══ الأوتو مود ═══
    if (guildData.automod && guildData.automod.enabled) {
      // Anti-Spam
      if (guildData.automod.antiSpam) {
        const key = `${message.guild.id}_${message.author.id}`;
        if (!spamMap.has(key)) spamMap.set(key, []);
        const timestamps = spamMap.get(key);
        const now = Date.now();
        timestamps.push(now);
        const recent = timestamps.filter(t => now - t < 3000);
        spamMap.set(key, recent);

        if (recent.length > 5 && !hasPerm(message.member, PermissionFlagsBits.ManageMessages)) {
          try {
            await message.member.timeout(300000, "Anti-Spam: رسائل كثيرة").catch(() => {});
            await message.channel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(config.colors.error)
                  .setDescription(`⚠️ <@${message.author.id}> تم كتمك لمدة 5 دقائق بسبب السبام.`)
              ]
            });

            const logEmbed = new EmbedBuilder()
              .setColor(config.colors.error)
              .setTitle("🔇 كتم تلقائي — Anti-Spam")
              .setDescription(`العضو: ${message.author.tag} (<@${message.author.id}>)\nالسبب: إرسال أكثر من 5 رسائل في 3 ثواني`)
              .setTimestamp();
            await sendLog(message.guild, logEmbed);

            spamMap.set(key, []);
          } catch (e) { }
          return;
        }
      }

      // Anti-Links
      if (guildData.automod.antiLinks) {
        const urlRegex = /(https?:\/\/[^\s]+)|(discord\.gg\/[^\s]+)|(www\.[^\s]+)/gi;
        if (urlRegex.test(message.content) && !hasPerm(message.member, PermissionFlagsBits.ManageMessages)) {
          await message.delete().catch(() => {});
          await message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(config.colors.error)
                .setDescription(`⚠️ <@${message.author.id}> الروابط غير مسموحة هنا!`)
            ]
          }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));

          const logEmbed = new EmbedBuilder()
            .setColor(config.colors.warning)
            .setTitle("🔗 رابط محذوف — Anti-Links")
            .setDescription(`العضو: ${message.author.tag}\nالمحتوى: ${message.content.substring(0, 500)}`)
            .setTimestamp();
          await sendLog(message.guild, logEmbed);
          return;
        }
      }
    }

    // ═══ Auto Responder ═══
    if (guildData.autoResponders && guildData.autoResponders.length > 0) {
      const content = message.content.toLowerCase();
      for (const ar of guildData.autoResponders) {
        if (content.includes(ar.trigger.toLowerCase())) {
          await message.reply(ar.response).catch(() => {});
          break;
        }
      }
    }

    // ═══ Custom Commands ═══
    if (guildData.customCommands && guildData.customCommands.length > 0) {
      if (message.content.startsWith(prefix)) {
        const cmdContent = message.content.slice(prefix.length).trim();
        const cc = guildData.customCommands.find(c => cmdContent.toLowerCase().startsWith(c.trigger.toLowerCase()));
        if (cc) {
          await message.reply(cc.response).catch(() => {});
          return;
        }
      }
    }

    // ═══ XP / Leveling ═══
    if (!message.content.startsWith(prefix)) {
      const userData = getUser(message.guild.id, message.author.id);
      const now = Date.now();
      if (now - userData.lastMessage > 60000) {
        const xpGain = Math.floor(Math.random() * 26) + 15;
        userData.xp += xpGain;
        userData.lastMessage = now;

        const requiredXP = calcXP(userData.level);
        let leveledUp = false;

        while (userData.xp >= calcXP(userData.level)) {
          userData.xp -= calcXP(userData.level);
          userData.level++;
          leveledUp = true;
        }

        saveUser(message.guild.id, message.author.id, userData);

        if (leveledUp) {
          const levelEmbed = new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle("🎉 ترقية مستوى!")
            .setDescription(`مبروك <@${message.author.id}>! وصلت للمستوى **${userData.level}**!`)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
            .addFields(
              { name: "المستوى", value: `${userData.level}`, inline: true },
              { name: "XP", value: `${userData.xp}/${calcXP(userData.level)}`, inline: true }
            )
            .setTimestamp();

          const levelChannel = guildData.levelChannel
            ? message.guild.channels.cache.get(guildData.levelChannel)
            : message.channel;

          if (levelChannel) {
            await levelChannel.send({ embeds: [levelEmbed] }).catch(() => {});
          }

          // Level Roles
          if (guildData.levelRoles && guildData.levelRoles.length > 0) {
            for (const lr of guildData.levelRoles) {
              if (userData.level >= lr.level) {
                const role = message.guild.roles.cache.get(lr.roleId);
                if (role && !message.member.roles.cache.has(role.id)) {
                  await message.member.roles.add(role).catch(() => {});
                }
              }
            }
          }
        }
      }
    }

    // ═══ الأوامر ═══
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // ═══════════════════════════════════════
    // أمر Help
    // ═══════════════════════════════════════

    if (command === "help") {
      const helpEmbed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle("📖 قائمة الأوامر")
        .setDescription(`البريفكس: \`${prefix}\``)
        .addFields(
          {
            name: "🛡 المودريشن",
            value: `\`${prefix}ban\` \`${prefix}unban\` \`${prefix}kick\` \`${prefix}mute\` \`${prefix}unmute\` \`${prefix}warn\` \`${prefix}warnings\` \`${prefix}clearwarnings\` \`${prefix}clear\` \`${prefix}timeout\``,
            inline: false
          },
          {
            name: "🤖 الأوتو مود",
            value: `\`${prefix}automod\``,
            inline: false
          },
          {
            name: "📝 اللوقز",
            value: `\`${prefix}setlog\` \`${prefix}disablelog\``,
            inline: false
          },
          {
            name: "👋 الترحيب",
            value: `\`${prefix}setwelcome\` \`${prefix}setleave\` \`${prefix}setautorole\` \`${prefix}testwelcome\``,
            inline: false
          },
          {
            name: "🏷 الرولات",
            value: `\`${prefix}reactionrole\` \`${prefix}buttonrole\` \`${prefix}autorole\` \`${prefix}levelrole\``,
            inline: false
          },
          {
            name: "📊 الليفلينق",
            value: `\`${prefix}rank\` \`${prefix}leaderboard\` \`${prefix}setxp\` \`${prefix}resetxp\` \`${prefix}setlevelchannel\``,
            inline: false
          },
          {
            name: "⚡ أوامر مخصصة",
            value: `\`${prefix}addcmd\` \`${prefix}removecmd\` \`${prefix}listcmds\` \`${prefix}autorespond\``,
            inline: false
          },
          {
            name: "📊 التصويت والاقتراحات",
            value: `\`${prefix}poll\` \`${prefix}suggest\` \`${prefix}accept\` \`${prefix}reject\` \`${prefix}setsuggest\``,
            inline: false
          },
          {
            name: "🔐 التحقق",
            value: `\`${prefix}setverify\``,
            inline: false
          },
          {
            name: "📈 الإحصائيات",
            value: `\`${prefix}serverstats\` \`${prefix}statschannel\``,
            inline: false
          },
          {
            name: "⚙️ الإعدادات",
            value: `\`${prefix}prefix\` \`${prefix}settings\` \`${prefix}setup\``,
            inline: false
          }
        )
        .setFooter({ text: `اكتب ${prefix}help <أمر> لمعرفة التفاصيل` })
        .setTimestamp();

      return message.reply({ embeds: [helpEmbed] });
    }

    // ═══════════════════════════════════════
    // أمر Ban
    // ═══════════════════════════════════════

    if (command === "ban") {
      if (!hasPerm(message.member, PermissionFlagsBits.BanMembers)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **حظر الأعضاء**.")] });
      }

      const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
      if (!target) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}ban @user [مدة] [سبب]\``)] });
      }

      if (!target.bannable) {
        return message.reply({ embeds: [errorEmbed("لا أستطيع حظر هذا العضو.")] });
      }

      if (target.roles.highest.position >= message.member.roles.highest.position && message.author.id !== config.ownerId) {
        return message.reply({ embeds: [errorEmbed("لا تستطيع حظر عضو رتبته أعلى منك أو مساوية.")] });
      }

      let duration = null;
      let reason = "لا يوجد سبب";

      if (args[1]) {
        const parsedDur = parseDuration(args[1]);
        if (parsedDur) {
          duration = parsedDur;
          reason = args.slice(2).join(" ") || "لا يوجد سبب";
        } else {
          reason = args.slice(1).join(" ") || "لا يوجد سبب";
        }
      }

      try {
        await target.send({
          embeds: [
            new EmbedBuilder()
              .setColor(config.colors.error)
              .setTitle("🔨 تم حظرك")
              .setDescription(`تم حظرك من **${message.guild.name}**`)
              .addFields(
                { name: "السبب", value: reason },
                { name: "المدة", value: duration ? formatTime(duration) : "دائم" },
                { name: "بواسطة", value: message.author.tag }
              )
              .setTimestamp()
          ]
        }).catch(() => {});

        await target.ban({ reason: `${reason} | بواسطة: ${message.author.tag}`, deleteMessageSeconds: 604800 });

        const banEmbed = successEmbed(`تم حظر **${target.user.tag}**\n**السبب:** ${reason}\n**المدة:** ${duration ? formatTime(duration) : "دائم"}`);
        await message.reply({ embeds: [banEmbed] });

        // لوق
        const logEmbed = new EmbedBuilder()
          .setColor(config.colors.error)
          .setTitle("🔨 حظر عضو")
          .addFields(
            { name: "العضو", value: `${target.user.tag} (${target.id})`, inline: true },
            { name: "بواسطة", value: `${message.author.tag}`, inline: true },
            { name: "السبب", value: reason },
            { name: "المدة", value: duration ? formatTime(duration) : "دائم" }
          )
          .setTimestamp();
        await sendLog(message.guild, logEmbed);

        // فك الحظر بعد المدة
        if (duration) {
          setTimeout(async () => {
            try {
              await message.guild.members.unban(target.id, "انتهاء مدة الحظر");
            } catch (e) { }
          }, duration);
        }
      } catch (e) {
        return message.reply({ embeds: [errorEmbed(`حدث خطأ: ${e.message}`)] });
      }
    }

    // ═══════════════════════════════════════
    // أمر Unban
    // ═══════════════════════════════════════

    if (command === "unban") {
      if (!hasPerm(message.member, PermissionFlagsBits.BanMembers)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **حظر الأعضاء**.")] });
      }

      const userId = args[0];
      if (!userId) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}unban <userId>\``)] });
      }

      try {
        await message.guild.members.unban(userId);
        await message.reply({ embeds: [successEmbed(`تم فك الحظر عن **${userId}**`)] });

        const logEmbed = new EmbedBuilder()
          .setColor(config.colors.success)
          .setTitle("🔓 فك حظر")
          .addFields(
            { name: "ID العضو", value: userId, inline: true },
            { name: "بواسطة", value: message.author.tag, inline: true }
          )
          .setTimestamp();
        await sendLog(message.guild, logEmbed);
      } catch (e) {
        return message.reply({ embeds: [errorEmbed("لم يتم العثور على حظر لهذا المستخدم.")] });
      }
    }

    // ═══════════════════════════════════════
    // أمر Kick
    // ═══════════════════════════════════════

    if (command === "kick") {
      if (!hasPerm(message.member, PermissionFlagsBits.KickMembers)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **طرد الأعضاء**.")] });
      }

      const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
      if (!target) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}kick @user [سبب]\``)] });
      }

      if (!target.kickable) {
        return message.reply({ embeds: [errorEmbed("لا أستطيع طرد هذا العضو.")] });
      }

      if (target.roles.highest.position >= message.member.roles.highest.position && message.author.id !== config.ownerId) {
        return message.reply({ embeds: [errorEmbed("لا تستطيع طرد عضو رتبته أعلى منك أو مساوية.")] });
      }

      const reason = args.slice(1).join(" ") || "لا يوجد سبب";

      try {
        await target.send({
          embeds: [
            new EmbedBuilder()
              .setColor(config.colors.error)
              .setTitle("👢 تم طردك")
              .setDescription(`تم طردك من **${message.guild.name}**`)
              .addFields(
                { name: "السبب", value: reason },
                { name: "بواسطة", value: message.author.tag }
              )
              .setTimestamp()
          ]
        }).catch(() => {});

        await target.kick(`${reason} | بواسطة: ${message.author.tag}`);
        await message.reply({ embeds: [successEmbed(`تم طرد **${target.user.tag}**\n**السبب:** ${reason}`)] });

        const logEmbed = new EmbedBuilder()
          .setColor(config.colors.error)
          .setTitle("👢 طرد عضو")
          .addFields(
            { name: "العضو", value: `${target.user.tag} (${target.id})`, inline: true },
            { name: "بواسطة", value: message.author.tag, inline: true },
            { name: "السبب", value: reason }
          )
          .setTimestamp();
        await sendLog(message.guild, logEmbed);
      } catch (e) {
        return message.reply({ embeds: [errorEmbed(`حدث خطأ: ${e.message}`)] });
      }
    }

    // ═══════════════════════════════════════
    // أمر Mute
    // ═══════════════════════════════════════

    if (command === "mute") {
      if (!hasPerm(message.member, PermissionFlagsBits.ModerateMembers)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **كتم الأعضاء**.")] });
      }

      const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
      if (!target) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}mute @user [مدة] [سبب]\``)] });
      }

      if (target.roles.highest.position >= message.member.roles.highest.position && message.author.id !== config.ownerId) {
        return message.reply({ embeds: [errorEmbed("لا تستطيع كتم عضو رتبته أعلى منك أو مساوية.")] });
      }

      let duration = 600000; // 10 دقائق افتراضي
      let reason = "لا يوجد سبب";

      if (args[1]) {
        const parsedDur = parseDuration(args[1]);
        if (parsedDur) {
          duration = parsedDur;
          reason = args.slice(2).join(" ") || "لا يوجد سبب";
        } else {
          reason = args.slice(1).join(" ") || "لا يوجد سبب";
        }
      }

      // حد timeout هو 28 يوم
      if (duration > 2419200000) duration = 2419200000;

      try {
        await target.timeout(duration, `${reason} | بواسطة: ${message.author.tag}`);
        await message.reply({
          embeds: [successEmbed(`تم كتم **${target.user.tag}** لمدة **${formatTime(duration)}**\n**السبب:** ${reason}`)]
        });

        const logEmbed = new EmbedBuilder()
          .setColor(config.colors.warning)
          .setTitle("🔇 كتم عضو")
          .addFields(
            { name: "العضو", value: `${target.user.tag} (${target.id})`, inline: true },
            { name: "بواسطة", value: message.author.tag, inline: true },
            { name: "المدة", value: formatTime(duration), inline: true },
            { name: "السبب", value: reason }
          )
          .setTimestamp();
        await sendLog(message.guild, logEmbed);
      } catch (e) {
        return message.reply({ embeds: [errorEmbed(`حدث خطأ: ${e.message}`)] });
      }
    }

    // ═══════════════════════════════════════
    // أمر Unmute
    // ═══════════════════════════════════════

    if (command === "unmute") {
      if (!hasPerm(message.member, PermissionFlagsBits.ModerateMembers)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **كتم الأعضاء**.")] });
      }

      const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
      if (!target) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}unmute @user\``)] });
      }

      try {
        await target.timeout(null);
        await message.reply({ embeds: [successEmbed(`تم فك الكتم عن **${target.user.tag}**`)] });

        const logEmbed = new EmbedBuilder()
          .setColor(config.colors.success)
          .setTitle("🔊 فك كتم")
          .addFields(
            { name: "العضو", value: `${target.user.tag} (${target.id})`, inline: true },
            { name: "بواسطة", value: message.author.tag, inline: true }
          )
          .setTimestamp();
        await sendLog(message.guild, logEmbed);
      } catch (e) {
        return message.reply({ embeds: [errorEmbed(`حدث خطأ: ${e.message}`)] });
      }
    }

    // ═══════════════════════════════════════
    // أمر Timeout
    // ═══════════════════════════════════════

    if (command === "timeout") {
      if (!hasPerm(message.member, PermissionFlagsBits.ModerateMembers)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **كتم الأعضاء**.")] });
      }

      const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
      if (!target) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}timeout @user <مدة> [سبب]\``)] });
      }

      if (!args[1]) {
        return message.reply({ embeds: [errorEmbed("حدد المدة. مثال: 10m, 1h, 1d")] });
      }

      const duration = parseDuration(args[1]);
      if (!duration) {
        return message.reply({ embeds: [errorEmbed("مدة غير صحيحة. استخدم: 10s, 5m, 1h, 1d, 1w")] });
      }

      const reason = args.slice(2).join(" ") || "لا يوجد سبب";

      try {
        await target.timeout(Math.min(duration, 2419200000), `${reason} | بواسطة: ${message.author.tag}`);
        await message.reply({
          embeds: [successEmbed(`تم عمل timeout لـ **${target.user.tag}** لمدة **${formatTime(duration)}**\n**السبب:** ${reason}`)]
        });

        const logEmbed = new EmbedBuilder()
          .setColor(config.colors.warning)
          .setTitle("⏰ Timeout")
          .addFields(
            { name: "العضو", value: `${target.user.tag} (${target.id})`, inline: true },
            { name: "بواسطة", value: message.author.tag, inline: true },
            { name: "المدة", value: formatTime(duration), inline: true },
            { name: "السبب", value: reason }
          )
          .setTimestamp();
        await sendLog(message.guild, logEmbed);
      } catch (e) {
        return message.reply({ embeds: [errorEmbed(`حدث خطأ: ${e.message}`)] });
      }
    }

    // ═══════════════════════════════════════
    // أمر Warn
    // ═══════════════════════════════════════

    if (command === "warn") {
      if (!hasPerm(message.member, PermissionFlagsBits.ManageMessages)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **إدارة الرسائل**.")] });
      }

      const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
      if (!target) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}warn @user [سبب]\``)] });
      }

      const reason = args.slice(1).join(" ") || "لا يوجد سبب";
      const userData = getUser(message.guild.id, target.id);

      userData.warns.push({
        reason: reason,
        moderator: message.author.id,
        date: Date.now()
      });

      saveUser(message.guild.id, target.id, userData);

      const warnCount = userData.warns.length;

      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(config.colors.warning)
            .setTitle("⚠️ تحذير")
            .setDescription(`تم تحذير **${target.user.tag}**`)
            .addFields(
              { name: "السبب", value: reason },
              { name: "عدد التحذيرات", value: `${warnCount}/${guildData.automod.maxWarns}`, inline: true },
              { name: "بواسطة", value: message.author.tag, inline: true }
            )
            .setTimestamp()
        ]
      });

      // إرسال للعضو
      await target.send({
        embeds: [
          new EmbedBuilder()
            .setColor(config.colors.warning)
            .setTitle("⚠️ تم تحذيرك")
            .setDescription(`تم تحذيرك في **${message.guild.name}**`)
            .addFields(
              { name: "السبب", value: reason },
              { name: "عدد التحذيرات", value: `${warnCount}/${guildData.automod.maxWarns}` }
            )
            .setTimestamp()
        ]
      }).catch(() => {});

      // لوق
      const logEmbed = new EmbedBuilder()
        .setColor(config.colors.warning)
        .setTitle("⚠️ تحذير عضو")
        .addFields(
          { name: "العضو", value: `${target.user.tag} (${target.id})`, inline: true },
          { name: "بواسطة", value: message.author.tag, inline: true },
          { name: "السبب", value: reason },
          { name: "التحذيرات", value: `${warnCount}/${guildData.automod.maxWarns}` }
        )
        .setTimestamp();
      await sendLog(message.guild, logEmbed);

      // أكشن تلقائي عند بلوغ الحد
      if (warnCount >= guildData.automod.maxWarns) {
        const action = guildData.automod.warnAction || "mute";

        if (action === "mute") {
          await target.timeout(3600000, "بلوغ الحد الأقصى من التحذيرات").catch(() => {});
          await message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(config.colors.error)
                .setDescription(`🔇 تم كتم **${target.user.tag}** تلقائياً لبلوغ الحد الأقصى من التحذيرات.`)
            ]
          });
        } else if (action === "kick") {
          await target.kick("بلوغ الحد الأقصى من التحذيرات").catch(() => {});
          await message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(config.colors.error)
                .setDescription(`👢 تم طرد **${target.user.tag}** تلقائياً لبلوغ الحد الأقصى من التحذيرات.`)
            ]
          });
        } else if (action === "ban") {
          await target.ban({ reason: "بلوغ الحد الأقصى من التحذيرات" }).catch(() => {});
          await message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(config.colors.error)
                .setDescription(`🔨 تم حظر **${target.user.tag}** تلقائياً لبلوغ الحد الأقصى من التحذيرات.`)
            ]
          });
        }

        // مسح التحذيرات بعد الأكشن
        userData.warns = [];
        saveUser(message.guild.id, target.id, userData);
      }
    }

    // ═══════════════════════════════════════
    // أمر Warnings
    // ═══════════════════════════════════════

    if (command === "warnings") {
      const target = message.mentions.members.first() || (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : message.member);
      if (!target) {
        return message.reply({ embeds: [errorEmbed("العضو غير موجود.")] });
      }

      const userData = getUser(message.guild.id, target.id);

      if (!userData.warns || userData.warns.length === 0) {
        return message.reply({
          embeds: [infoEmbed("📋 التحذيرات", `**${target.user.tag}** ليس لديه أي تحذيرات.`)]
        });
      }

      const warnList = userData.warns.map((w, i) => {
        return `**${i + 1}.** ${w.reason}\n   بواسطة: <@${w.moderator}> — <t:${Math.floor(w.date / 1000)}:R>`;
      }).join("\n\n");

      const embed = new EmbedBuilder()
        .setColor(config.colors.warning)
        .setTitle(`⚠️ تحذيرات ${target.user.tag}`)
        .setDescription(warnList)
        .setFooter({ text: `الإجمالي: ${userData.warns.length}/${guildData.automod.maxWarns}` })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // ═══════════════════════════════════════
    // أمر ClearWarnings
    // ═══════════════════════════════════════

    if (command === "clearwarnings" || command === "clearwarns") {
      if (!hasPerm(message.member, PermissionFlagsBits.ManageMessages)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **إدارة الرسائل**.")] });
      }

      const target = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
      if (!target) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}clearwarnings @user\``)] });
      }

      const userData = getUser(message.guild.id, target.id);
      const count = userData.warns.length;
      userData.warns = [];
      saveUser(message.guild.id, target.id, userData);

      await message.reply({ embeds: [successEmbed(`تم مسح **${count}** تحذير من **${target.user.tag}**`)] });

      const logEmbed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle("🗑 مسح تحذيرات")
        .addFields(
          { name: "العضو", value: `${target.user.tag}`, inline: true },
          { name: "بواسطة", value: message.author.tag, inline: true },
          { name: "عدد التحذيرات المحذوفة", value: `${count}` }
        )
        .setTimestamp();
      await sendLog(message.guild, logEmbed);
    }

    // ═══════════════════════════════════════
    // أمر Clear
    // ═══════════════════════════════════════

    if (command === "clear" || command === "purge") {
      if (!hasPerm(message.member, PermissionFlagsBits.ManageMessages)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **إدارة الرسائل**.")] });
      }

      const amount = parseInt(args[0]);
      if (!amount || amount < 1 || amount > 100) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}clear <1-100>\``)] });
      }

      try {
        const deleted = await message.channel.bulkDelete(amount + 1, true);
        const reply = await message.channel.send({
          embeds: [successEmbed(`تم حذف **${deleted.size - 1}** رسالة.`)]
        });
        setTimeout(() => reply.delete().catch(() => {}), 3000);

        const logEmbed = new EmbedBuilder()
          .setColor(config.colors.info)
          .setTitle("🗑 حذف رسائل")
          .addFields(
            { name: "القناة", value: `<#${message.channel.id}>`, inline: true },
            { name: "العدد", value: `${deleted.size - 1}`, inline: true },
            { name: "بواسطة", value: message.author.tag, inline: true }
          )
          .setTimestamp();
        await sendLog(message.guild, logEmbed);
      } catch (e) {
        return message.reply({ embeds: [errorEmbed(`حدث خطأ: ${e.message}`)] });
      }
    }

    // ═══════════════════════════════════════
    // أمر Automod
    // ═══════════════════════════════════════

    if (command === "automod") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const subcommand = args[0] ? args[0].toLowerCase() : null;
      const value = args[1] ? args[1].toLowerCase() : null;

      if (!subcommand) {
        const automodEmbed = new EmbedBuilder()
          .setColor(config.colors.info)
          .setTitle("🤖 إعدادات الأوتو مود")
          .setDescription(
            `**الحالة:** ${guildData.automod.enabled ? "✅ مفعّل" : "❌ معطّل"}\n` +
            `**Anti-Spam:** ${guildData.automod.antiSpam ? "✅" : "❌"}\n` +
            `**Anti-Links:** ${guildData.automod.antiLinks ? "✅" : "❌"}\n` +
            `**Anti-Raid:** ${guildData.automod.antiRaid ? "✅" : "❌"}\n` +
            `**Max Warns:** ${guildData.automod.maxWarns}\n` +
            `**Warn Action:** ${guildData.automod.warnAction}`
          )
          .addFields(
            { name: "الأوامر", value: `\`${prefix}automod on/off\`\n\`${prefix}automod spam on/off\`\n\`${prefix}automod links on/off\`\n\`${prefix}automod raid on/off\`\n\`${prefix}automod maxwarns <عدد>\`\n\`${prefix}automod action <mute/kick/ban>\`` }
          )
          .setTimestamp();
        return message.reply({ embeds: [automodEmbed] });
      }

      if (subcommand === "on") {
        guildData.automod.enabled = true;
        saveGuild(message.guild.id, guildData);
        return message.reply({ embeds: [successEmbed("✅ تم تفعيل الأوتو مود.")] });
      }

      if (subcommand === "off") {
        guildData.automod.enabled = false;
        saveGuild(message.guild.id, guildData);
        return message.reply({ embeds: [successEmbed("❌ تم تعطيل الأوتو مود.")] });
      }

      if (subcommand === "spam") {
        if (value === "on") {
          guildData.automod.antiSpam = true;
          saveGuild(message.guild.id, guildData);
          return message.reply({ embeds: [successEmbed("✅ تم تفعيل Anti-Spam.")] });
        } else if (value === "off") {
          guildData.automod.antiSpam = false;
          saveGuild(message.guild.id, guildData);
          return message.reply({ embeds: [successEmbed("❌ تم تعطيل Anti-Spam.")] });
        }
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}automod spam on/off\``)] });
      }

      if (subcommand === "links") {
        if (value === "on") {
          guildData.automod.antiLinks = true;
          saveGuild(message.guild.id, guildData);
          return message.reply({ embeds: [successEmbed("✅ تم تفعيل Anti-Links.")] });
        } else if (value === "off") {
          guildData.automod.antiLinks = false;
          saveGuild(message.guild.id, guildData);
          return message.reply({ embeds: [successEmbed("❌ تم تعطيل Anti-Links.")] });
        }
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}automod links on/off\``)] });
      }

      if (subcommand === "raid") {
        if (value === "on") {
          guildData.automod.antiRaid = true;
          saveGuild(message.guild.id, guildData);
          return message.reply({ embeds: [successEmbed("✅ تم تفعيل Anti-Raid.")] });
        } else if (value === "off") {
          guildData.automod.antiRaid = false;
          saveGuild(message.guild.id, guildData);
          return message.reply({ embeds: [successEmbed("❌ تم تعطيل Anti-Raid.")] });
        }
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}automod raid on/off\``)] });
      }

      if (subcommand === "maxwarns") {
        const num = parseInt(value);
        if (!num || num < 1 || num > 20) {
          return message.reply({ embeds: [errorEmbed("حدد رقم بين 1 و 20.")] });
        }
        guildData.automod.maxWarns = num;
        saveGuild(message.guild.id, guildData);
        return message.reply({ embeds: [successEmbed(`✅ تم تغيير الحد الأقصى للتحذيرات إلى **${num}**`)] });
      }

      if (subcommand === "action") {
        if (!value || !["mute", "kick", "ban"].includes(value)) {
          return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}automod action <mute/kick/ban>\``)] });
        }
        guildData.automod.warnAction = value;
        saveGuild(message.guild.id, guildData);
        return message.reply({ embeds: [successEmbed(`✅ تم تغيير الأكشن عند بلوغ الحد إلى **${value}**`)] });
      }

      return message.reply({ embeds: [errorEmbed("أمر فرعي غير معروف.")] });
    }

    // ═══════════════════════════════════════
    // أمر SetLog
    // ═══════════════════════════════════════

    if (command === "setlog") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
      if (!channel) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}setlog #channel\``)] });
      }

      guildData.logChannel = channel.id;
      saveGuild(message.guild.id, guildData);

      return message.reply({ embeds: [successEmbed(`✅ تم تعيين قناة اللوقز: <#${channel.id}>`)] });
    }

    // ═══════════════════════════════════════
    // أمر DisableLog
    // ═══════════════════════════════════════

    if (command === "disablelog") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      guildData.logChannel = null;
      saveGuild(message.guild.id, guildData);
      return message.reply({ embeds: [successEmbed("✅ تم تعطيل اللوقز.")] });
    }

    // ═══════════════════════════════════════
    // أمر SetWelcome
    // ═══════════════════════════════════════

    if (command === "setwelcome") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const channel = message.mentions.channels.first();
      if (!channel) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}setwelcome #channel [رسالة]\`\nالمتغيرات: {user} {server} {memberCount} {userId}`)] });
      }

      const welcomeMsg = args.slice(1).join(" ") || "مرحباً {user} في {server}! 🎉";

      guildData.welcomeChannel = channel.id;
      guildData.welcomeMessage = welcomeMsg;
      saveGuild(message.guild.id, guildData);

      return message.reply({
        embeds: [successEmbed(`✅ تم تعيين قناة الترحيب: <#${channel.id}>\nالرسالة: ${welcomeMsg}`)]
      });
    }

    // ═══════════════════════════════════════
    // أمر SetLeave
    // ═══════════════════════════════════════

    if (command === "setleave") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const channel = message.mentions.channels.first();
      if (!channel) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}setleave #channel [رسالة]\``)] });
      }

      const leaveMsg = args.slice(1).join(" ") || "وداعاً {user} 👋";

      guildData.leaveChannel = channel.id;
      guildData.leaveMessage = leaveMsg;
      saveGuild(message.guild.id, guildData);

      return message.reply({
        embeds: [successEmbed(`✅ تم تعيين قناة التوديع: <#${channel.id}>\nالرسالة: ${leaveMsg}`)]
      });
    }

    // ═══════════════════════════════════════
    // أمر SetAutoRole
    // ═══════════════════════════════════════

    if (command === "setautorole") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
      if (!role) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}setautorole @role\``)] });
      }

      guildData.autoRole = role.id;
      saveGuild(message.guild.id, guildData);

      return message.reply({ embeds: [successEmbed(`✅ تم تعيين الرول التلقائي: <@&${role.id}>`)] });
    }

    // ═══════════════════════════════════════
    // أمر TestWelcome
    // ═══════════════════════════════════════

    if (command === "testwelcome") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      if (!guildData.welcomeChannel) {
        return message.reply({ embeds: [errorEmbed("لم يتم إعداد قناة الترحيب بعد.")] });
      }

      const channel = message.guild.channels.cache.get(guildData.welcomeChannel);
      if (!channel) {
        return message.reply({ embeds: [errorEmbed("قناة الترحيب غير موجودة.")] });
      }

      let msg = guildData.welcomeMessage || "مرحباً {user} في {server}! 🎉";
      msg = msg.replace(/{user}/g, `<@${message.author.id}>`);
      msg = msg.replace(/{server}/g, message.guild.name);
      msg = msg.replace(/{memberCount}/g, message.guild.memberCount.toString());
      msg = msg.replace(/{userId}/g, message.author.id);

      const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle("👋 عضو جديد! (تجربة)")
        .setDescription(msg)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: "العضو", value: message.author.tag, inline: true },
          { name: "عدد الأعضاء", value: `${message.guild.memberCount}`, inline: true }
        )
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      return message.reply({ embeds: [successEmbed("✅ تم إرسال رسالة ترحيب تجريبية.")] });
    }

    // ═══════════════════════════════════════
    // أمر Reaction Role
    // ═══════════════════════════════════════

    if (command === "reactionrole" || command === "rr") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const channel = message.mentions.channels.first();
      if (!channel) {
        return message.reply({
          embeds: [errorEmbed(`الاستخدام: \`${prefix}reactionrole #channel <رسالة> <emoji> @role\`\nمثال: \`${prefix}reactionrole #roles اختر رولك 🎮 @Gamer\``)]
        });
      }

      const role = message.mentions.roles.first();
      if (!role) {
        return message.reply({ embeds: [errorEmbed("حدد الرول. مثال: @Gamer")] });
      }

      // استخراج الإيموجي
      const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic}|<a?:\w+:\d+>)/gu;
      const remainingArgs = args.slice(1).filter(a => !a.startsWith("<@&") && !a.startsWith("<#"));
      const emojiMatch = remainingArgs.join(" ").match(emojiRegex);
      const emoji = emojiMatch ? emojiMatch[0] : "✅";

      // الرسالة
      const textParts = args.slice(1).filter(a => !a.startsWith("<@&") && !a.match(emojiRegex));
      const rrText = textParts.join(" ") || "تفاعل للحصول على الرول";

      const rrEmbed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle("🏷 Reaction Role")
        .setDescription(`${rrText}\n\nتفاعل بـ ${emoji} للحصول على <@&${role.id}>`)
        .setTimestamp();

      try {
        const sent = await channel.send({ embeds: [rrEmbed] });
        await sent.react(emoji).catch(() => {});

        if (!guildData.reactionRoles) guildData.reactionRoles = [];
        guildData.reactionRoles.push({
          messageId: sent.id,
          channelId: channel.id,
          emoji: emoji,
          roleId: role.id
        });
        saveGuild(message.guild.id, guildData);

        return message.reply({ embeds: [successEmbed(`✅ تم إنشاء Reaction Role في <#${channel.id}>`)] });
      } catch (e) {
        return message.reply({ embeds: [errorEmbed(`حدث خطأ: ${e.message}`)] });
      }
    }

    // ═══════════════════════════════════════
    // أمر Button Role
    // ═══════════════════════════════════════

    if (command === "buttonrole" || command === "br") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const channel = message.mentions.channels.first();
      const role = message.mentions.roles.first();

      if (!channel || !role) {
        return message.reply({
          embeds: [errorEmbed(`الاستخدام: \`${prefix}buttonrole #channel <label> @role\`\nمثال: \`${prefix}buttonrole #roles 🎮 Gamer @Gamer\``)]
        });
      }

      const label = args.slice(1).filter(a => !a.startsWith("<@&") && !a.startsWith("<#")).join(" ") || role.name;

      const brEmbed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle("🏷 Button Role")
        .setDescription(`اضغط الزر للحصول على الرول أو إزالته.`)
        .setTimestamp();

      const button = new ButtonBuilder()
        .setCustomId(`btnrole_${role.id}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(button);

      try {
        const sent = await channel.send({ embeds: [brEmbed], components: [row] });

        if (!guildData.buttonRoles) guildData.buttonRoles = [];
        guildData.buttonRoles.push({
          messageId: sent.id,
          channelId: channel.id,
          roleId: role.id,
          label: label
        });
        saveGuild(message.guild.id, guildData);

        return message.reply({ embeds: [successEmbed(`✅ تم إنشاء Button Role في <#${channel.id}>`)] });
      } catch (e) {
        return message.reply({ embeds: [errorEmbed(`حدث خطأ: ${e.message}`)] });
      }
    }

    // ═══════════════════════════════════════
    // أمر Auto Role
    // ═══════════════════════════════════════

    if (command === "autorole") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const sub = args[0] ? args[0].toLowerCase() : null;

      if (!sub || !["add", "remove", "list"].includes(sub)) {
        return message.reply({
          embeds: [errorEmbed(`الاستخدام:\n\`${prefix}autorole add @role\`\n\`${prefix}autorole remove @role\`\n\`${prefix}autorole list\``)]
        });
      }

      if (sub === "add") {
        const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
        if (!role) return message.reply({ embeds: [errorEmbed("حدد الرول.")] });

        if (!guildData.autoRoles) guildData.autoRoles = [];
        if (guildData.autoRoles.includes(role.id)) {
          return message.reply({ embeds: [errorEmbed("هذا الرول موجود بالفعل.")] });
        }

        guildData.autoRoles.push(role.id);
        saveGuild(message.guild.id, guildData);
        return message.reply({ embeds: [successEmbed(`✅ تمت إضافة <@&${role.id}> كرول تلقائي.`)] });
      }

      if (sub === "remove") {
        const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
        if (!role) return message.reply({ embeds: [errorEmbed("حدد الرول.")] });

        if (!guildData.autoRoles) guildData.autoRoles = [];
        guildData.autoRoles = guildData.autoRoles.filter(r => r !== role.id);
        saveGuild(message.guild.id, guildData);
        return message.reply({ embeds: [successEmbed(`✅ تمت إزالة <@&${role.id}> من الرولات التلقائية.`)] });
      }

      if (sub === "list") {
        if (!guildData.autoRoles || guildData.autoRoles.length === 0) {
          return message.reply({ embeds: [infoEmbed("🏷 الرولات التلقائية", "لا توجد رولات تلقائية.")] });
        }
        const list = guildData.autoRoles.map(r => `<@&${r}>`).join("\n");
        return message.reply({ embeds: [infoEmbed("🏷 الرولات التلقائية", list)] });
      }
    }

    // ═══════════════════════════════════════
    // أمر Level Role
    // ═══════════════════════════════════════

    if (command === "levelrole" || command === "lr") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const sub = args[0] ? args[0].toLowerCase() : null;

      if (!sub || !["add", "remove", "list"].includes(sub)) {
        return message.reply({
          embeds: [errorEmbed(`الاستخدام:\n\`${prefix}levelrole add <level> @role\`\n\`${prefix}levelrole remove <level>\`\n\`${prefix}levelrole list\``)]
        });
      }

      if (sub === "add") {
        const level = parseInt(args[1]);
        const role = message.mentions.roles.first();
        if (!level || !role) {
          return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}levelrole add 10 @role\``)] });
        }

        if (!guildData.levelRoles) guildData.levelRoles = [];
        guildData.levelRoles = guildData.levelRoles.filter(lr => lr.level !== level);
        guildData.levelRoles.push({ level: level, roleId: role.id });
        guildData.levelRoles.sort((a, b) => a.level - b.level);
        saveGuild(message.guild.id, guildData);

        return message.reply({ embeds: [successEmbed(`✅ عند المستوى **${level}** يحصل العضو على <@&${role.id}>`)] });
      }

      if (sub === "remove") {
        const level = parseInt(args[1]);
        if (!level) return message.reply({ embeds: [errorEmbed("حدد المستوى.")] });

        if (!guildData.levelRoles) guildData.levelRoles = [];
        guildData.levelRoles = guildData.levelRoles.filter(lr => lr.level !== level);
        saveGuild(message.guild.id, guildData);
        return message.reply({ embeds: [successEmbed(`✅ تمت إزالة رول المستوى **${level}**`)] });
      }

      if (sub === "list") {
        if (!guildData.levelRoles || guildData.levelRoles.length === 0) {
          return message.reply({ embeds: [infoEmbed("🏷 رولات المستويات", "لا توجد رولات مستويات.")] });
        }
        const list = guildData.levelRoles.map(lr => `المستوى **${lr.level}** → <@&${lr.roleId}>`).join("\n");
        return message.reply({ embeds: [infoEmbed("🏷 رولات المستويات", list)] });
      }
    }

    // ═══════════════════════════════════════
    // أمر Rank
    // ═══════════════════════════════════════

    if (command === "rank" || command === "level") {
      const target = message.mentions.members.first() || message.member;
      const userData = getUser(message.guild.id, target.id);
      const requiredXP = calcXP(userData.level);
      const progress = Math.floor((userData.xp / requiredXP) * 20);
      const progressBar = "█".repeat(progress) + "░".repeat(20 - progress);
      const percent = Math.floor((userData.xp / requiredXP) * 100);

      // ترتيب
      const data = getData();
      const guildUsers = data.users[message.guild.id] || {};
      const sorted = Object.entries(guildUsers)
        .map(([id, u]) => ({ id, totalXP: u.xp + u.level * 1000 }))
        .sort((a, b) => b.totalXP - a.totalXP);
      const rank = sorted.findIndex(u => u.id === target.id) + 1;

      const rankEmbed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle(`📊 رتبة ${target.user.tag}`)
        .setThumbnail(target.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: "المستوى", value: `${userData.level}`, inline: true },
          { name: "XP", value: `${userData.xp}/${requiredXP}`, inline: true },
          { name: "الترتيب", value: `#${rank}`, inline: true },
          { name: "التقدم", value: `${progressBar} ${percent}%` }
        )
        .setTimestamp();

      return message.reply({ embeds: [rankEmbed] });
    }

    // ═══════════════════════════════════════
    // أمر Leaderboard
    // ═══════════════════════════════════════

    if (command === "leaderboard" || command === "lb" || command === "top") {
      const data = getData();
      const guildUsers = data.users[message.guild.id] || {};
      const sorted = Object.entries(guildUsers)
        .map(([id, u]) => ({ id, level: u.level, xp: u.xp, totalXP: u.xp + u.level * 1000 }))
        .sort((a, b) => b.totalXP - a.totalXP)
        .slice(0, 10);

      if (sorted.length === 0) {
        return message.reply({ embeds: [infoEmbed("🏆 المتصدرين", "لا توجد بيانات بعد.")] });
      }

      const medals = ["🥇", "🥈", "🥉"];
      const list = sorted.map((u, i) => {
        const medal = medals[i] || `**${i + 1}.**`;
        return `${medal} <@${u.id}> — المستوى **${u.level}** | XP: **${u.xp}**`;
      }).join("\n");

      const lbEmbed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle("🏆 المتصدرين")
        .setDescription(list)
        .setTimestamp();

      return message.reply({ embeds: [lbEmbed] });
    }

    // ═══════════════════════════════════════
    // أمر SetXP
    // ═══════════════════════════════════════

    if (command === "setxp") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const target = message.mentions.members.first();
      const amount = parseInt(args[1]);

      if (!target || isNaN(amount)) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}setxp @user <amount>\``)] });
      }

      const userData = getUser(message.guild.id, target.id);
      userData.xp = amount;
      saveUser(message.guild.id, target.id, userData);

      return message.reply({ embeds: [successEmbed(`✅ تم تعيين XP لـ **${target.user.tag}** إلى **${amount}**`)] });
    }

    // ═══════════════════════════════════════
    // أمر ResetXP
    // ═══════════════════════════════════════

    if (command === "resetxp") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const target = message.mentions.members.first();
      if (!target) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}resetxp @user\``)] });
      }

      const userData = getUser(message.guild.id, target.id);
      userData.xp = 0;
      userData.level = 0;
      saveUser(message.guild.id, target.id, userData);

      return message.reply({ embeds: [successEmbed(`✅ تم إعادة تعيين XP والمستوى لـ **${target.user.tag}**`)] });
    }

    // ═══════════════════════════════════════
    // أمر SetLevelChannel
    // ═══════════════════════════════════════

    if (command === "setlevelchannel") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const channel = message.mentions.channels.first();
      if (!channel) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}setlevelchannel #channel\``)] });
      }

      guildData.levelChannel = channel.id;
      saveGuild(message.guild.id, guildData);

      return message.reply({ embeds: [successEmbed(`✅ تم تعيين قناة الليفلينق: <#${channel.id}>`)] });
    }

    // ═══════════════════════════════════════
    // أمر AddCmd
    // ═══════════════════════════════════════

    if (command === "addcmd") {
      if (!hasPerm(message.member, PermissionFlagsBits.ManageGuild)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **إدارة السيرفر**.")] });
      }

      if (args.length < 2) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}addcmd <trigger> <response>\``)] });
      }

      const trigger = args[0].toLowerCase();
      const response = args.slice(1).join(" ");

      if (!guildData.customCommands) guildData.customCommands = [];
      guildData.customCommands = guildData.customCommands.filter(c => c.trigger !== trigger);
      guildData.customCommands.push({ trigger, response });
      saveGuild(message.guild.id, guildData);

      return message.reply({ embeds: [successEmbed(`✅ تم إضافة الأمر \`${prefix}${trigger}\` → ${response}`)] });
    }

    // ═══════════════════════════════════════
    // أمر RemoveCmd
    // ═══════════════════════════════════════

    if (command === "removecmd") {
      if (!hasPerm(message.member, PermissionFlagsBits.ManageGuild)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **إدارة السيرفر**.")] });
      }

      if (!args[0]) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}removecmd <trigger>\``)] });
      }

      const trigger = args[0].toLowerCase();
      if (!guildData.customCommands) guildData.customCommands = [];

      const before = guildData.customCommands.length;
      guildData.customCommands = guildData.customCommands.filter(c => c.trigger !== trigger);

      if (guildData.customCommands.length === before) {
        return message.reply({ embeds: [errorEmbed("الأمر غير موجود.")] });
      }

      saveGuild(message.guild.id, guildData);
      return message.reply({ embeds: [successEmbed(`✅ تم حذف الأمر \`${trigger}\``)] });
    }

    // ═══════════════════════════════════════
    // أمر ListCmds
    // ═══════════════════════════════════════

    if (command === "listcmds" || command === "cmds") {
      if (!guildData.customCommands || guildData.customCommands.length === 0) {
        return message.reply({ embeds: [infoEmbed("⚡ الأوامر المخصصة", "لا توجد أوامر مخصصة.")] });
      }

      const list = guildData.customCommands.map(c => `\`${prefix}${c.trigger}\` → ${c.response.substring(0, 50)}`).join("\n");
      return message.reply({ embeds: [infoEmbed("⚡ الأوامر المخصصة", list)] });
    }

    // ═══════════════════════════════════════
    // أمر AutoRespond
    // ═══════════════════════════════════════

    if (command === "autorespond" || command === "ar") {
      if (!hasPerm(message.member, PermissionFlagsBits.ManageGuild)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **إدارة السيرفر**.")] });
      }

      const sub = args[0] ? args[0].toLowerCase() : null;

      if (!sub || !["add", "remove", "list"].includes(sub)) {
        return message.reply({
          embeds: [errorEmbed(`الاستخدام:\n\`${prefix}autorespond add <كلمة> <الرد>\`\n\`${prefix}autorespond remove <كلمة>\`\n\`${prefix}autorespond list\``)]
        });
      }

      if (sub === "add") {
        if (args.length < 3) {
          return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}autorespond add <كلمة> <الرد>\``)] });
        }
        const trigger = args[1].toLowerCase();
        const response = args.slice(2).join(" ");

        if (!guildData.autoResponders) guildData.autoResponders = [];
        guildData.autoResponders = guildData.autoResponders.filter(ar => ar.trigger !== trigger);
        guildData.autoResponders.push({ trigger, response });
        saveGuild(message.guild.id, guildData);

        return message.reply({ embeds: [successEmbed(`✅ عند ذكر \`${trigger}\` سيرد البوت بـ: ${response}`)] });
      }

      if (sub === "remove") {
        if (!args[1]) return message.reply({ embeds: [errorEmbed("حدد الكلمة.")] });
        const trigger = args[1].toLowerCase();

        if (!guildData.autoResponders) guildData.autoResponders = [];
        guildData.autoResponders = guildData.autoResponders.filter(ar => ar.trigger !== trigger);
        saveGuild(message.guild.id, guildData);

        return message.reply({ embeds: [successEmbed(`✅ تم حذف الرد التلقائي لـ \`${trigger}\``)] });
      }

      if (sub === "list") {
        if (!guildData.autoResponders || guildData.autoResponders.length === 0) {
          return message.reply({ embeds: [infoEmbed("🔄 الردود التلقائية", "لا توجد ردود تلقائية.")] });
        }
        const list = guildData.autoResponders.map(ar => `\`${ar.trigger}\` → ${ar.response.substring(0, 50)}`).join("\n");
        return message.reply({ embeds: [infoEmbed("🔄 الردود التلقائية", list)] });
      }
    }

    // ═══════════════════════════════════════
    // أمر Poll
    // ═══════════════════════════════════════

    if (command === "poll") {
      if (!hasPerm(message.member, PermissionFlagsBits.ManageMessages)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **إدارة الرسائل**.")] });
      }

      // استخراج النصوص بين علامات الاقتباس
      const quoted = message.content.match(/"([^"]+)"/g);
      if (!quoted || quoted.length < 3) {
        return message.reply({
          embeds: [errorEmbed(`الاستخدام: \`${prefix}poll "السؤال" "خيار1" "خيار2" "خيار3"\`\n(2-5 خيارات)`)]
        });
      }

      const question = quoted[0].replace(/"/g, "");
      const options = quoted.slice(1, 6).map(q => q.replace(/"/g, ""));

      if (options.length < 2) {
        return message.reply({ embeds: [errorEmbed("يجب أن يكون هناك خياران على الأقل.")] });
      }

      const pollId = Date.now().toString(36);
      const pollData = {
        id: pollId,
        question: question,
        options: options.map(o => ({ text: o, votes: 0, voters: [] })),
        createdBy: message.author.id,
        endTime: Date.now() + 86400000 // 24 ساعة
      };

      if (!guildData.polls) guildData.polls = [];
      guildData.polls.push(pollData);
      saveGuild(message.guild.id, guildData);

      const pollEmbed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle(`📊 ${question}`)
        .setDescription(
          options.map((o, i) => {
            return `**${i + 1}.** ${o}\n${"░".repeat(20)} 0% (0 صوت)`;
          }).join("\n\n")
        )
        .setFooter({ text: `إجمالي الأصوات: 0 | ينتهي خلال 24 ساعة` })
        .setTimestamp();

      const rows = [];
      const buttonsPerRow = 5;
      for (let i = 0; i < options.length; i += buttonsPerRow) {
        const row = new ActionRowBuilder();
        const chunk = options.slice(i, i + buttonsPerRow);
        for (let j = 0; j < chunk.length; j++) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`poll_${pollId}_${i + j}`)
              .setLabel(`${i + j + 1}. ${chunk[j].substring(0, 50)}`)
              .setStyle(ButtonStyle.Primary)
          );
        }
        rows.push(row);
      }

      await message.channel.send({ embeds: [pollEmbed], components: rows });
      await message.delete().catch(() => {});
    }

    // ═══════════════════════════════════════
    // أمر SetSuggest
    // ═══════════════════════════════════════

    if (command === "setsuggest") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const channel = message.mentions.channels.first();
      if (!channel) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}setsuggest #channel\``)] });
      }

      guildData.suggestChannel = channel.id;
      saveGuild(message.guild.id, guildData);

      return message.reply({ embeds: [successEmbed(`✅ تم تعيين قناة الاقتراحات: <#${channel.id}>`)] });
    }

    // ═══════════════════════════════════════
    // أمر Suggest
    // ═══════════════════════════════════════

    if (command === "suggest") {
      if (!guildData.suggestChannel) {
        return message.reply({ embeds: [errorEmbed("لم يتم إعداد قناة الاقتراحات.")] });
      }

      const suggestion = args.join(" ");
      if (!suggestion) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}suggest <نص الاقتراح>\``)] });
      }

      const sugId = Date.now().toString(36);
      const channel = message.guild.channels.cache.get(guildData.suggestChannel);
      if (!channel) {
        return message.reply({ embeds: [errorEmbed("قناة الاقتراحات غير موجودة.")] });
      }

      const sugEmbed = new EmbedBuilder()
        .setColor(config.colors.warning)
        .setTitle("💡 اقتراح جديد")
        .setDescription(suggestion)
        .addFields(
          { name: "المقترح", value: `<@${message.author.id}>`, inline: true },
          { name: "الحالة", value: "⏳ قيد المراجعة", inline: true },
          { name: "ID", value: sugId, inline: true }
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`suggest_accept_${sugId}`)
          .setLabel("✅ قبول")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`suggest_reject_${sugId}`)
          .setLabel("❌ رفض")
          .setStyle(ButtonStyle.Danger)
      );

      const sent = await channel.send({ embeds: [sugEmbed], components: [row] });
      await sent.react("✅").catch(() => {});
      await sent.react("❌").catch(() => {});

      if (!guildData.suggestions) guildData.suggestions = [];
      guildData.suggestions.push({
        id: sugId,
        content: suggestion,
        userId: message.author.id,
        messageId: sent.id,
        status: "pending"
      });
      saveGuild(message.guild.id, guildData);

      await message.reply({ embeds: [successEmbed(`✅ تم إرسال اقتراحك! (ID: ${sugId})`)] });
      await message.delete().catch(() => {});
    }

    // ═══════════════════════════════════════
    // أمر Accept
    // ═══════════════════════════════════════

    if (command === "accept") {
      if (!hasPerm(message.member, PermissionFlagsBits.ManageMessages)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **إدارة الرسائل**.")] });
      }

      const sugId = args[0];
      const comment = args.slice(1).join(" ") || "لا يوجد تعليق";

      if (!sugId) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}accept <ID> [تعليق]\``)] });
      }

      if (!guildData.suggestions) guildData.suggestions = [];
      const sug = guildData.suggestions.find(s => s.id === sugId);

      if (!sug) {
        return message.reply({ embeds: [errorEmbed("الاقتراح غير موجود.")] });
      }

      sug.status = "accepted";
      sug.reviewedBy = message.author.id;
      sug.comment = comment;
      saveGuild(message.guild.id, guildData);

      // تحديث الرسالة في القناة
      if (guildData.suggestChannel) {
        const channel = message.guild.channels.cache.get(guildData.suggestChannel);
        if (channel) {
          try {
            const msg = await channel.messages.fetch(sug.messageId).catch(() => null);
            if (msg) {
              const updatedEmbed = new EmbedBuilder()
                .setColor(config.colors.success)
                .setTitle("💡 اقتراح — ✅ مقبول")
                .setDescription(sug.content)
                .addFields(
                  { name: "المقترح", value: `<@${sug.userId}>`, inline: true },
                  { name: "الحالة", value: "✅ مقبول", inline: true },
                  { name: "تمت المراجعة بواسطة", value: `<@${message.author.id}>`, inline: true },
                  { name: "تعليق", value: comment }
                )
                .setTimestamp();
              await msg.edit({ embeds: [updatedEmbed], components: [] }).catch(() => {});
            }
          } catch (e) { }
        }
      }

      return message.reply({ embeds: [successEmbed(`✅ تم قبول الاقتراح ${sugId}`)] });
    }

    // ═══════════════════════════════════════
    // أمر Reject
    // ═══════════════════════════════════════

    if (command === "reject") {
      if (!hasPerm(message.member, PermissionFlagsBits.ManageMessages)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **إدارة الرسائل**.")] });
      }

      const sugId = args[0];
      const comment = args.slice(1).join(" ") || "لا يوجد تعليق";

      if (!sugId) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}reject <ID> [تعليق]\``)] });
      }

      if (!guildData.suggestions) guildData.suggestions = [];
      const sug = guildData.suggestions.find(s => s.id === sugId);

      if (!sug) {
        return message.reply({ embeds: [errorEmbed("الاقتراح غير موجود.")] });
      }

      sug.status = "rejected";
      sug.reviewedBy = message.author.id;
      sug.comment = comment;
      saveGuild(message.guild.id, guildData);

      if (guildData.suggestChannel) {
        const channel = message.guild.channels.cache.get(guildData.suggestChannel);
        if (channel) {
          try {
            const msg = await channel.messages.fetch(sug.messageId).catch(() => null);
            if (msg) {
              const updatedEmbed = new EmbedBuilder()
                .setColor(config.colors.error)
                .setTitle("💡 اقتراح — ❌ مرفوض")
                .setDescription(sug.content)
                .addFields(
                  { name: "المقترح", value: `<@${sug.userId}>`, inline: true },
                  { name: "الحالة", value: "❌ مرفوض", inline: true },
                  { name: "تمت المراجعة بواسطة", value: `<@${message.author.id}>`, inline: true },
                  { name: "تعليق", value: comment }
                )
                .setTimestamp();
              await msg.edit({ embeds: [updatedEmbed], components: [] }).catch(() => {});
            }
          } catch (e) { }
        }
      }

      return message.reply({ embeds: [successEmbed(`❌ تم رفض الاقتراح ${sugId}`)] });
    }

    // ═══════════════════════════════════════
    // أمر SetVerify
    // ═══════════════════════════════════════

    if (command === "setverify") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const channel = message.mentions.channels.first();
      const role = message.mentions.roles.first();
      const type = args[2] ? args[2].toLowerCase() : "button";

      if (!channel || !role) {
        return message.reply({
          embeds: [errorEmbed(`الاستخدام: \`${prefix}setverify #channel @role [button/captcha]\``)]
        });
      }

      if (!["button", "captcha"].includes(type)) {
        return message.reply({ embeds: [errorEmbed("النوع يجب أن يكون `button` أو `captcha`.")] });
      }

      guildData.verifyChannel = channel.id;
      guildData.verifyRole = role.id;
      guildData.verifyType = type;
      saveGuild(message.guild.id, guildData);

      // إرسال embed التحقق في القناة
      const verifyEmbed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle("🔐 التحقق")
        .setDescription(
          type === "button"
            ? "اضغط الزر أدناه للتحقق والحصول على الوصول للسيرفر."
            : "اضغط الزر أدناه لاستلام رمز التحقق في رسائلك الخاصة، ثم اكتبه هنا."
        )
        .setTimestamp();

      const verifyButton = new ButtonBuilder()
        .setCustomId("verify_button")
        .setLabel(type === "button" ? "✅ أنا لست روبوتاً" : "🔐 استلام رمز التحقق")
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(verifyButton);

      await channel.send({ embeds: [verifyEmbed], components: [row] });

      return message.reply({
        embeds: [successEmbed(`✅ تم إعداد التحقق في <#${channel.id}>\nالنوع: **${type}**\nالرول: <@&${role.id}>`)]
      });
    }

    // ═══════════════════════════════════════
    // أمر ServerStats
    // ═══════════════════════════════════════

    if (command === "serverstats" || command === "serverinfo") {
      const guild = message.guild;
      const members = await guild.members.fetch().catch(() => guild.members.cache);

      const online = members.filter(m => m.presence && m.presence.status !== "offline").size;
      const bots = members.filter(m => m.user.bot).size;
      const humans = guild.memberCount - bots;

      const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
      const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
      const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;

      const embed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle(`📈 إحصائيات ${guild.name}`)
        .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: "👑 المالك", value: `<@${guild.ownerId}>`, inline: true },
          { name: "📅 تاريخ الإنشاء", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
          { name: "🔢 ID", value: guild.id, inline: true },
          { name: "👥 الأعضاء", value: `الكل: **${guild.memberCount}**\nبشر: **${humans}**\nبوتات: **${bots}**\nأونلاين: **${online}**`, inline: true },
          { name: "📂 القنوات", value: `نصية: **${textChannels}**\nصوتية: **${voiceChannels}**\nتصنيفات: **${categories}**\nالكل: **${guild.channels.cache.size}**`, inline: true },
          { name: "🏷 الرولات", value: `**${guild.roles.cache.size}**`, inline: true },
          { name: "😀 الإيموجي", value: `**${guild.emojis.cache.size}**`, inline: true },
          { name: "🔒 مستوى التحقق", value: `${guild.verificationLevel}`, inline: true },
          { name: "🚀 البوستات", value: `**${guild.premiumSubscriptionCount || 0}** (مستوى ${guild.premiumTier})`, inline: true }
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // ═══════════════════════════════════════
    // أمر StatsChannel
    // ═══════════════════════════════════════

    if (command === "statschannel") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const type = args[0] ? args[0].toLowerCase() : null;
      const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);

      if (!type || !["members", "online", "bots"].includes(type)) {
        return message.reply({
          embeds: [errorEmbed(`الاستخدام: \`${prefix}statschannel <members/online/bots> #voice-channel\`\nأو \`${prefix}statschannel <members/online/bots> disable\``)]
        });
      }

      if (args[1] === "disable") {
        guildData.statsChannels[type] = null;
        saveGuild(message.guild.id, guildData);
        return message.reply({ embeds: [successEmbed(`✅ تم تعطيل قناة إحصائيات ${type}.`)] });
      }

      if (!channel) {
        return message.reply({ embeds: [errorEmbed("حدد قناة صوتية.")] });
      }

      guildData.statsChannels[type] = channel.id;
      saveGuild(message.guild.id, guildData);

      return message.reply({
        embeds: [successEmbed(`✅ تم تعيين قناة إحصائيات **${type}**: <#${channel.id}>\nسيتم التحديث كل 10 دقائق.`)]
      });
    }

    // ═══════════════════════════════════════
    // أمر Prefix
    // ═══════════════════════════════════════

    if (command === "prefix") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const newPrefix = args[0];
      if (!newPrefix) {
        return message.reply({ embeds: [infoEmbed("📌 البريفكس", `البريفكس الحالي: \`${prefix}\`\nلتغييره: \`${prefix}prefix <بريفكس جديد>\``)] });
      }

      if (newPrefix.length > 5) {
        return message.reply({ embeds: [errorEmbed("البريفكس يجب أن يكون أقل من 5 أحرف.")] });
      }

      guildData.prefix = newPrefix;
      saveGuild(message.guild.id, guildData);

      return message.reply({ embeds: [successEmbed(`✅ تم تغيير البريفكس إلى \`${newPrefix}\``)] });
    }

    // ═══════════════════════════════════════
    // أمر Settings
    // ═══════════════════════════════════════

    if (command === "settings") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle(`⚙️ إعدادات ${message.guild.name}`)
        .addFields(
          { name: "📌 البريفكس", value: `\`${guildData.prefix}\``, inline: true },
          { name: "📝 قناة اللوقز", value: guildData.logChannel ? `<#${guildData.logChannel}>` : "❌ غير مُعد", inline: true },
          { name: "👋 قناة الترحيب", value: guildData.welcomeChannel ? `<#${guildData.welcomeChannel}>` : "❌ غير مُعد", inline: true },
          { name: "📤 قناة التوديع", value: guildData.leaveChannel ? `<#${guildData.leaveChannel}>` : "❌ غير مُعد", inline: true },
          { name: "🏷 الرول التلقائي", value: guildData.autoRole ? `<@&${guildData.autoRole}>` : "❌ غير مُعد", inline: true },
          { name: "🔐 قناة التحقق", value: guildData.verifyChannel ? `<#${guildData.verifyChannel}> (${guildData.verifyType})` : "❌ غير مُعد", inline: true },
          { name: "💡 قناة الاقتراحات", value: guildData.suggestChannel ? `<#${guildData.suggestChannel}>` : "❌ غير مُعد", inline: true },
          { name: "📊 قناة الليفلينق", value: guildData.levelChannel ? `<#${guildData.levelChannel}>` : "❌ غير مُعد (نفس القناة)", inline: true },
          {
            name: "🤖 الأوتو مود",
            value: `الحالة: ${guildData.automod.enabled ? "✅" : "❌"}\nAnti-Spam: ${guildData.automod.antiSpam ? "✅" : "❌"}\nAnti-Links: ${guildData.automod.antiLinks ? "✅" : "❌"}\nAnti-Raid: ${guildData.automod.antiRaid ? "✅" : "❌"}\nMax Warns: ${guildData.automod.maxWarns}\nAction: ${guildData.automod.warnAction}`,
            inline: false
          },
          { name: "🏷 الرولات التلقائية", value: guildData.autoRoles && guildData.autoRoles.length > 0 ? guildData.autoRoles.map(r => `<@&${r}>`).join(", ") : "لا يوجد", inline: false },
          { name: "📊 رولات المستويات", value: guildData.levelRoles && guildData.levelRoles.length > 0 ? guildData.levelRoles.map(lr => `مستوى ${lr.level} → <@&${lr.roleId}>`).join(", ") : "لا يوجد", inline: false },
          { name: "⚡ أوامر مخصصة", value: `${guildData.customCommands ? guildData.customCommands.length : 0}`, inline: true },
          { name: "🔄 ردود تلقائية", value: `${guildData.autoResponders ? guildData.autoResponders.length : 0}`, inline: true }
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // ═══════════════════════════════════════
    // أمر Setup
    // ═══════════════════════════════════════

    if (command === "setup") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const setupEmbed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle("🛠 معالج الإعداد")
        .setDescription("اضغط على الأزرار أدناه لإعداد كل جزء من البوت.\nسيظهر لك الأمر المطلوب وطريقة الاستخدام.")
        .addFields(
          { name: "📝 اللوقز", value: "تسجيل جميع الأحداث", inline: true },
          { name: "👋 الترحيب", value: "رسائل الترحيب والتوديع", inline: true },
          { name: "🏷 رول تلقائي", value: "رول عند الانضمام", inline: true },
          { name: "🤖 أوتو مود", value: "حماية السيرفر", inline: true },
          { name: "🔐 التحقق", value: "نظام التحقق", inline: true },
          { name: "📊 الليفلينق", value: "نظام المستويات", inline: true }
        )
        .setTimestamp();

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("setup_logs").setLabel("📝 اللوقز").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("setup_welcome").setLabel("👋 الترحيب").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("setup_autorole").setLabel("🏷 رول تلقائي").setStyle(ButtonStyle.Secondary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("setup_automod").setLabel("🤖 أوتو مود").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("setup_verify").setLabel("🔐 التحقق").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("setup_levels").setLabel("📊 الليفلينق").setStyle(ButtonStyle.Secondary)
      );

      return message.reply({ embeds: [setupEmbed], components: [row1, row2] });
    }

    // ═══════════════════════════════════════
    // أمر Lockdown
    // ═══════════════════════════════════════

    if (command === "lockdown" || command === "lock") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const channel = message.mentions.channels.first() || message.channel;

      try {
        await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
          SendMessages: false
        });

        await message.reply({
          embeds: [successEmbed(`🔒 تم قفل <#${channel.id}>`)]
        });

        const logEmbed = new EmbedBuilder()
          .setColor(config.colors.error)
          .setTitle("🔒 قفل قناة")
          .addFields(
            { name: "القناة", value: `<#${channel.id}>`, inline: true },
            { name: "بواسطة", value: message.author.tag, inline: true }
          )
          .setTimestamp();
        await sendLog(message.guild, logEmbed);
      } catch (e) {
        return message.reply({ embeds: [errorEmbed(`حدث خطأ: ${e.message}`)] });
      }
    }

    // ═══════════════════════════════════════
    // أمر Unlock
    // ═══════════════════════════════════════

    if (command === "unlock") {
      if (!hasPerm(message.member, PermissionFlagsBits.Administrator)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **المدير**.")] });
      }

      const channel = message.mentions.channels.first() || message.channel;

      try {
        await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
          SendMessages: null
        });

        await message.reply({
          embeds: [successEmbed(`🔓 تم فتح <#${channel.id}>`)]
        });

        const logEmbed = new EmbedBuilder()
          .setColor(config.colors.success)
          .setTitle("🔓 فتح قناة")
          .addFields(
            { name: "القناة", value: `<#${channel.id}>`, inline: true },
            { name: "بواسطة", value: message.author.tag, inline: true }
          )
          .setTimestamp();
        await sendLog(message.guild, logEmbed);
      } catch (e) {
        return message.reply({ embeds: [errorEmbed(`حدث خطأ: ${e.message}`)] });
      }
    }

    // ═══════════════════════════════════════
    // أمر UserInfo
    // ═══════════════════════════════════════

    if (command === "userinfo" || command === "whois") {
      const target = message.mentions.members.first() || message.member;

      const embed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle(`👤 معلومات ${target.user.tag}`)
        .setThumbnail(target.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: "🏷 الاسم", value: target.user.tag, inline: true },
          { name: "🔢 ID", value: target.id, inline: true },
          { name: "🤖 بوت", value: target.user.bot ? "✅" : "❌", inline: true },
          { name: "📅 أُنشئ الحساب", value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: "📥 انضم للسيرفر", value: target.joinedAt ? `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>` : "غير معروف", inline: true },
          { name: "🏷 أعلى رول", value: `${target.roles.highest}`, inline: true },
          { name: "🏷 الرولات", value: target.roles.cache.filter(r => r.name !== "@everyone").map(r => `${r}`).join(", ").substring(0, 1024) || "لا رولات" }
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // ═══════════════════════════════════════
    // أمر Avatar
    // ═══════════════════════════════════════

    if (command === "avatar" || command === "av") {
      const target = message.mentions.users.first() || message.author;

      const embed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle(`🖼 صورة ${target.tag}`)
        .setImage(target.displayAvatarURL({ dynamic: true, size: 4096 }))
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // ═══════════════════════════════════════
    // أمر Ping
    // ═══════════════════════════════════════

    if (command === "ping") {
      const sent = await message.reply({
        embeds: [infoEmbed("🏓 Ping", "جاري القياس...")]
      });

      const latency = sent.createdTimestamp - message.createdTimestamp;

      const embed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle("🏓 Pong!")
        .addFields(
          { name: "📡 التأخير", value: `${latency}ms`, inline: true },
          { name: "💓 API", value: `${Math.round(client.ws.ping)}ms`, inline: true }
        )
        .setTimestamp();

      await sent.edit({ embeds: [embed] });
    }

    // ═══════════════════════════════════════
    // أمر Uptime
    // ═══════════════════════════════════════

    if (command === "uptime") {
      const embed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle("⏰ مدة التشغيل")
        .setDescription(`البوت شغّال من: **${formatTime(client.uptime)}**`)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // ═══════════════════════════════════════
    // أمر Invite
    // ═══════════════════════════════════════

    if (command === "invite" || command === "botinvite") {
      const embed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle("🔗 رابط الدعوة")
        .setDescription(`[اضغط هنا لدعوة البوت](https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands)`)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // ═══════════════════════════════════════
    // أمر BotInfo
    // ═══════════════════════════════════════

    if (command === "botinfo") {
      const embed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle(`🤖 معلومات ${client.user.tag}`)
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: "📡 السيرفرات", value: `${client.guilds.cache.size}`, inline: true },
          { name: "👥 الأعضاء", value: `${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0).toLocaleString()}`, inline: true },
          { name: "📂 القنوات", value: `${client.channels.cache.size}`, inline: true },
          { name: "⏰ مدة التشغيل", value: formatTime(client.uptime), inline: true },
          { name: "🏓 Ping", value: `${Math.round(client.ws.ping)}ms`, inline: true },
          { name: "📦 discord.js", value: `v14`, inline: true },
          { name: "💻 Node.js", value: process.version, inline: true },
          { name: "💾 الذاكرة", value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true }
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // ═══════════════════════════════════════
    // أمر Slowmode
    // ═══════════════════════════════════════

    if (command === "slowmode") {
      if (!hasPerm(message.member, PermissionFlagsBits.ManageChannels)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **إدارة القنوات**.")] });
      }

      const seconds = parseInt(args[0]);
      if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}slowmode <ثواني 0-21600>\``)] });
      }

      try {
        await message.channel.setRateLimitPerUser(seconds);
        if (seconds === 0) {
          return message.reply({ embeds: [successEmbed("✅ تم تعطيل السلو مود.")] });
        }
        return message.reply({ embeds: [successEmbed(`✅ تم تعيين السلو مود إلى **${seconds}** ثانية.`)] });
      } catch (e) {
        return message.reply({ embeds: [errorEmbed(`حدث خطأ: ${e.message}`)] });
      }
    }

    // ═══════════════════════════════════════
    // أمر Nickname
    // ═══════════════════════════════════════

    if (command === "nick" || command === "nickname") {
      if (!hasPerm(message.member, PermissionFlagsBits.ManageNicknames)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **إدارة الأسماء**.")] });
      }

      const target = message.mentions.members.first();
      if (!target) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}nick @user <اسم جديد>\` أو \`${prefix}nick @user\` لإعادة التعيين`)] });
      }

      const newNick = args.slice(1).join(" ") || null;

      try {
        await target.setNickname(newNick);
        if (newNick) {
          return message.reply({ embeds: [successEmbed(`✅ تم تغيير اسم **${target.user.tag}** إلى **${newNick}**`)] });
        } else {
          return message.reply({ embeds: [successEmbed(`✅ تم إعادة تعيين اسم **${target.user.tag}**`)] });
        }
      } catch (e) {
        return message.reply({ embeds: [errorEmbed(`حدث خطأ: ${e.message}`)] });
      }
    }

    // ═══════════════════════════════════════
    // أمر Role
    // ═══════════════════════════════════════

    if (command === "role") {
      if (!hasPerm(message.member, PermissionFlagsBits.ManageRoles)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **إدارة الرولات**.")] });
      }

      const target = message.mentions.members.first();
      const role = message.mentions.roles.first();

      if (!target || !role) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}role @user @role\``)] });
      }

      try {
        if (target.roles.cache.has(role.id)) {
          await target.roles.remove(role);
          return message.reply({ embeds: [successEmbed(`✅ تم إزالة <@&${role.id}> من **${target.user.tag}**`)] });
        } else {
          await target.roles.add(role);
          return message.reply({ embeds: [successEmbed(`✅ تم إعطاء <@&${role.id}> لـ **${target.user.tag}**`)] });
        }
      } catch (e) {
        return message.reply({ embeds: [errorEmbed(`حدث خطأ: ${e.message}`)] });
      }
    }

    // ═══════════════════════════════════════
    // أمر Announce
    // ═══════════════════════════════════════

    if (command === "announce" || command === "say") {
      if (!hasPerm(message.member, PermissionFlagsBits.ManageMessages)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **إدارة الرسائل**.")] });
      }

      const text = args.join(" ");
      if (!text) {
        return message.reply({ embeds: [errorEmbed(`الاستخدام: \`${prefix}announce <النص>\``)] });
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setDescription(text)
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
      await message.delete().catch(() => {});
    }

    // ═══════════════════════════════════════
    // أمر Embed
    // ═══════════════════════════════════════

    if (command === "embed") {
      if (!hasPerm(message.member, PermissionFlagsBits.ManageMessages)) {
        return message.reply({ embeds: [errorEmbed("تحتاج صلاحية **إدارة الرسائل**.")] });
      }

      // استخراج العنوان والوصف بين علامات الاقتباس
      const quoted = message.content.match(/"([^"]+)"/g);

      if (!quoted || quoted.length < 2) {
        return message.reply({
          embeds: [errorEmbed(`الاستخدام: \`${prefix}embed "العنوان" "الوصف"\``)]
        });
      }

      const title = quoted[0].replace(/"/g, "");
      const description = quoted[1].replace(/"/g, "");

      const embed = new EmbedBuilder()
        .setColor(config.colors.main)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
      await message.delete().catch(() => {});
    }

  } catch (e) {
    console.error("خطأ في معالجة الأمر:", e);
    try {
      await message.reply({
        embeds: [errorEmbed(`حدث خطأ غير متوقع: ${e.message}`)]
      });
    } catch (e2) {
      // تجاهل
    }
  }
});

// ═══════════════════════════════════════
// معالجة الأخطاء العامة
// ═══════════════════════════════════════

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

client.on("error", (error) => {
  console.error("Client Error:", error);
});

client.on("warn", (info) => {
  console.warn("Client Warning:", info);
});

// ═══════════════════════════════════════
// تسجيل الدخول
// ═══════════════════════════════════════

client.login(config.token);

// ═══ نهاية الكود ═══
// التشغيل: node index.js
// المتطلبات: npm install discord.js
