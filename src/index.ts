import { log } from 'console';
import { Context, Logger, Schema } from 'koishi'
import { } from "koishi-plugin-cron"

export const name = 'zan-pro'

export const useage = `本插件是[https://github.com/xiaozhu2007/koishi-plugin-zanwo](https://github.com/xiaozhu2007/koishi-plugin-zanwo)的升级版, 可以设置每日定时点赞`;

export const inject = ['database', 'cron']

let globalConfig: Config
let logger = new Logger(name)

export interface Config {
  debug: boolean
}

declare module 'koishi' {
  interface Tables {
    zanwopro: ZanwoPro
  }
}

export interface ZanwoPro {
  uid: string
}

export const Config: Schema<Config> = Schema.object({
  debug: Schema
    .boolean()
    .default(false)
    .description('是否开启调试模式')
    .experimental(),
})

export function apply(ctx: Context, config: Config) {
  // write your plugin here
  let globalConfig = config
  ctx.i18n.define('zh', require('./locales/zh_CN.yml'))

  ctx.model.extend(
    'zanwopro',
    { uid: 'string' },
    { primary: 'uid' },
  )

  ctx.command('每日赞我')
    .action(async ({ session }) => {
      if (globalConfig.debug) {
        logger.info(`收到每日赞我指令`)
      }
      let time = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
      let uid = session.userId
      logger.info(`当前时间: ${time}, uid: ${uid}`)
      let data = await ctx.database.get('zanwopro', { uid: uid })
      logger.info(data)
      if (data && data.length > 0) {
        return session.text('.already')
      }

      await ctx.database.create('zanwopro', { uid: uid })
      if (globalConfig.debug) {
        logger.info(`为${uid}设置每日赞我成功`)
      }
      return session.text('.success')
    })


  ctx.inject(['cron'], (ctx) => {
    ctx.cron('30 0 * * *', async () => {
      let now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
      logger.info(`定时任务： 当前时间: ${now}`)
      let currentBots = ctx.bots
      for (let bot of currentBots) {
        let botuid = bot.userId
        logger.info(`定时任务： 当前时间: ${now}, botuid: ${botuid}`)
        let data = await ctx.database.get('zanwopro', {})
        if (data) {
          let num = 0
          try {
            for (let i = 0; i < data.length; i++) {
              let uid = data[i].uid
              uid = uid.match(/\d+/)?.[0]
              if (uid) {
                if (globalConfig.debug)
                  logger.info(`定时任务： 从${data[i].uid}中提取到uid: ${uid}`)
                for (let i = 0; i < 5; i++) {
                  await bot.internal.sendLike(uid, 10)
                  num += 1
                  if (globalConfig.debug) {
                    logger.info(`定时任务： 为${uid}的第${i + 1}次点赞成功`)
                  }
                }
              }
              logger.info(`定时任务：当前时间: ${now}, uid: ${uid}`)
            }
          } catch (e) {
            if (num > 0) {
              logger.info(`定时任务： 每日点赞成功`)
            } else {
              logger.error(`定时任务： 每日点赞失败: ${e}`)
            }
          }
        }
      }
    })
  })


  ctx.command('zanall')
    .alias('赞全体人员')
    .action(async ({ session }) => {
      let goup_id = session.event.guild;
      if (globalConfig.debug)
        logger.info(`群组id: ${goup_id.id}, 群组名: ${goup_id.name}`);

      if (!goup_id || !goup_id.id) {
        if (globalConfig.debug) {
          logger.error(`群组id为空`);
        }
        return session.text('.failure');
      }

      try {
        let response = await session.bot.getGuildMemberList(goup_id.id);
        if (!response || !response.data || !Array.isArray(response.data)) {
          if (globalConfig.debug)
            logger.error(`获取群组成员列表失败，返回值不符合预期: ${JSON.stringify(response)}`);
          return session.text('.failure');
        }

        let allUsers = response.data;
        let successPerson = 0, failPerson = 0;

        for (let user of allUsers) {
          if (user.user && user.user.id !== undefined) {
            let uid = user.user.id;
            if (uid === session.bot.userId)
              continue
            if (globalConfig.debug) {
              logger.info(`群组id: ${goup_id.id}, 群组名: ${goup_id.name}, 群组成员id: ${uid}`);
            }
            let num = 0;
            try {
              for (let i = 0; i < 5; i++) {
                await session.bot.internal.sendLike(uid, 10);
                num += 1;
                if (globalConfig.debug) {
                  logger.info(`为${uid}的第${i + 1}次点赞成功`);
                }
              }
            } catch (e) {
              if (num > 0) {
                if (globalConfig.debug)
                  logger.info(`为${uid}点赞部分成功`);
              } else {
                if (globalConfig.debug)
                  logger.error(`为${uid}点赞失败: ${e}`);
              }
            }
            if (num > 0) {
              successPerson += 1;
            } else {
              failPerson += 1;
            }
          } else {
            if (globalConfig.debug) {
              logger.warn(`用户对象中缺少 user 或 user.id 属性: ${JSON.stringify(user)}`);
            }
          }
        }
        session.send(`赞全体人员成功, 成功人数: ${successPerson}, 失败人数: ${failPerson}`);
      } catch (e) {
        if (globalConfig.debug)
          logger.error(`获取群组成员列表时发生错误: ${e}`);
        return session.text('.failure');
      }
    });


  ctx.command('zanwo')
    .alias('赞我')
    .action(async ({ session }) => {
      let num = 0
      try {
        for (let i = 0; i < 5; i++) {
          await session.bot.internal.sendLike(session.userId, 10)
          num += 1
          if (globalConfig.debug) {
            logger.info(`为${session.userId}的第${i + 1}次点赞成功`)
          }
          return session.text('.success')
        }
      } catch (e) {
        if (num > 0) return session.text('.success')
        return session.text('.failure')
      }
    })

  ctx.command('zan <who:text>')
    .action(async ({ session }, who) => {
      // 如果没有参数
      if (!who || who.trim() === '' || who.split(/\s+/).filter(Boolean).length > 1)
        return session.text('.noarg')
      let uid = who.match(/\d+/)?.[0]
      if (!uid) return session.text('.noarg')
      if (globalConfig.debug) {
        logger.info(`从${who}中提取到uid: ${uid}`)
        let num = 0
        try {
          for (let i = 0; i < 5; i++) {
            await session.bot.internal.sendLike(uid, 10)
            num += 1
            if (globalConfig.debug) {
              logger.info(`为${uid}的第${i + 1}次点赞成功`)
            }
            return session.text('.success')
          }
        } catch (e) {
          if (num > 0) return session.text('.success')
          if (globalConfig.debug)
            logger.error(`为${uid}点赞失败: ${e}`)
          return session.text('.failure')
        }
      }
    })



}
