import { Alliance, AllianceCoin } from "@prisma/client";
import prisma from "../prisma_client";
import { Keyboard, KeyboardBuilder } from "vk-io";
import { answerTimeLimit, timer_text } from "../../../..";
import { Confirm_User_Success, Keyboard_Index, Logger } from "../../../core/helper";
import { Person_Get } from "../person/person";

//контроллер управления валютами альянса
async function Alliance_Coin_Get(cursor: number, alliance: Alliance) {
    const batchSize = 5;
    let counter = 0
    let limiter = 0
    let res: AllianceCoin[] = []
    for (const allicoin of await prisma.allianceCoin.findMany({ where: { id_alliance: alliance.id } })) {
        if ((cursor <= counter && batchSize+cursor >= counter) && limiter < batchSize) {
            res.push(allicoin)
            limiter++
        }
        counter++
    }
    
   return res
}

export async function Alliance_Coin_Converter_Editor_Printer(context: any) {
    const user = await Person_Get(context)
    const alliance = await prisma.alliance.findFirst({ where: { id: Number(user?.id_alliance) } })
    if (!alliance) { return }
    if (!user) { return }
    let allicoin_tr = false
    let cursor = 0
    while (!allicoin_tr) {
        const keyboard = new KeyboardBuilder()
        let event_logger = ``
        for await (const alliance_coin of await Alliance_Coin_Get(cursor, alliance!)) {
            keyboard.textButton({ label: `✏ ${alliance_coin.id}-${alliance_coin.name.slice(0,30)}`, payload: { command: 'alliance_coin_edit', cursor: cursor, id_alliance_coin: alliance_coin.id }, color: 'secondary' }).row()
            //.textButton({ label: `⛔`, payload: { command: 'alliance_coin_delete', cursor: cursor, id_alliance_coin: alliance_coin.id }, color: 'secondary' }).row()
            //.callbackButton({ label: '👀', payload: { command: 'builder_controller', command_sub: 'builder_open', office_current: i, target: builder.id }, color: 'secondary' })
            event_logger += `${alliance_coin.smile} ${alliance_coin.name}: id${alliance_coin.id}\nРейтинговая валюта: ${alliance_coin?.point == true ? "✅" : "⛔"}\n⚖ Курс конвертации: ${alliance_coin.course_medal}🔘 --> ${alliance_coin.course_coin}${alliance_coin.smile}\n\n`
        }
        if (cursor >= 5) { keyboard.textButton({ label: `←`, payload: { command: 'alliance_coin_back', cursor: cursor }, color: 'secondary' }) }
        const alliance_coin_counter = await prisma.allianceCoin.count({ where: { id_alliance: alliance!.id! } })
        if (5+cursor < alliance_coin_counter) { keyboard.textButton({ label: `→`, payload: { command: 'alliance_coin_next', cursor: cursor }, color: 'secondary' }) }
        //keyboard.textButton({ label: `➕`, payload: { command: 'alliance_coin_create', cursor: cursor }, color: 'secondary' }).row()
        keyboard.textButton({ label: `🚫`, payload: { command: 'alliance_coin_return', cursor: cursor }, color: 'secondary' }).oneTime()
        event_logger += `\n ${1+cursor} из ${alliance_coin_counter}`
        const allicoin_bt = await context.question(`🧷 Выберите валюту ${alliance?.name} для изменения курса:\n\n ${event_logger}`,
            {	
                keyboard: keyboard, answerTimeLimit
            }
        )
        if (allicoin_bt.isTimeout) { return await context.send(`⏰ Время ожидания выбора валюты ${alliance?.name} истекло!`) }
        const config: any = {
            'alliance_coin_edit': Alliance_Coin_Edit,
            'alliance_coin_next': Alliance_Coin_Next,
            'alliance_coin_back': Alliance_Coin_Back,
            'alliance_coin_return': Alliance_Coin_Return,
        }
        if (allicoin_bt?.payload?.command in config) {
            const commandHandler = config[allicoin_bt.payload.command];
            const ans = await commandHandler(context, allicoin_bt.payload, alliance)
            cursor = ans?.cursor || ans?.cursor == 0 ? ans.cursor : cursor
            allicoin_tr = ans.stop ? ans.stop : false
        } else {
            await context.send(`💡 Жмите только по кнопкам с иконками!`)
        }
    }
    await Keyboard_Index(context, '💡 Нужно построить зиккурат!')
}

async function Alliance_Coin_Return(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor, stop: true }
    await context.send(`Вы отменили меню управления курсами конвертации валют ролевого проекта ${alliance.id}-${alliance.name}`)
    return res
}

async function Alliance_Coin_Edit(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor }
    let spec_check = false
    let name_loc = null
    const alliance_coin_check = await prisma.allianceCoin.findFirst({ where: { id: data.id_alliance_coin } })
    const course_change = { course_medal: 1, course_coin: 1 }
	while (spec_check == false) {
		const name = await context.question( `🧷 Вы редактируете курс валюты: ${alliance_coin_check?.name}. Сейчас установлена ценность жетонов ${alliance_coin_check?.course_medal}🔘, введите новую:`,
            {   
                keyboard: Keyboard.builder()
                .textButton({ label: '🚫Отмена', payload: { command: 'limited' }, color: 'secondary' })
                .oneTime().inline(),
                timer_text
            }
        )
		if (name.isTimeout) { return await context.send(`⏰ Время ожидания ввода для нового курса валюты ${alliance_coin_check?.name} по жетонам истекло!`) }
		if (/^(0|-?[1-9]\d{0,5})$/.test(name.text)) {
            course_change.course_medal = Number(name.text)
            spec_check = true
        } else {
            if (name.text == "🚫Отмена") { 
                await context.send(`💡 Редактирование курса прерваны пользователем!`) 
                return res
            }
            await context.send(`💡 Необходимо ввести корректное число для нового курса!`)
        }
	}
    let coin_course_checker = false
    while (coin_course_checker == false) {
		const name = await context.question( `🧷 Вы редактируете курс валюты: ${alliance_coin_check?.name}. Сейчас установлена ценность ролевой валюты ${alliance_coin_check?.course_coin}${alliance_coin_check?.smile}, введите новую:`,
            {   
                keyboard: Keyboard.builder()
                .textButton({ label: '🚫Отмена', payload: { command: 'limited' }, color: 'secondary' })
                .oneTime().inline(),
                timer_text
            }
        )
		if (name.isTimeout) { return await context.send(`⏰ Время ожидания ввода для нового курса валюты ${alliance_coin_check?.name} по ролевой валюте истекло!`) }
		if (/^(0|-?[1-9]\d{0,5})$/.test(name.text)) {
            course_change.course_coin = Number(name.text)
            coin_course_checker = true
        } else {
            if (name.text == "🚫Отмена") { 
                await context.send(`💡 Редактирование курса прерваны пользователем!`) 
                return res
            }
            await context.send(`💡 Необходимо ввести корректное число для нового курса!`)
        }
	}
	const rank_check: { status: boolean, text: String } = await Confirm_User_Success(context, `изменить курс жетонов:\n🔘 ${alliance_coin_check?.course_medal} --> ${course_change.course_medal}\n изменить курс валюты ${alliance_coin_check?.name}:\n${alliance_coin_check?.smile} ${alliance_coin_check?.course_coin} --> ${course_change.course_coin}?`)
    await context.send(`${rank_check.text}`)
    if (rank_check.status) {
        const quest_up = await prisma.allianceCoin.update({ where: { id: alliance_coin_check?.id }, data: { course_medal: course_change.course_medal, course_coin: course_change.course_coin } })
        if (quest_up) {
            await Logger(`In database, updated course alliance coin: ${quest_up.id}-${quest_up.name} by admin ${context.senderId}`)
            await context.send(`⚙ Вы скорректировали курс валюты:\n Название: ${alliance_coin_check?.id}-${alliance_coin_check?.name}\n⛔ ${alliance_coin_check?.course_medal}🔘 --> ${alliance_coin_check?.course_coin}${alliance_coin_check?.smile}\n✅ ${quest_up?.course_medal}🔘 --> ${quest_up?.course_coin}${quest_up?.smile}`)
        }
    }
    return res
}

async function Alliance_Coin_Next(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor+5 }
    return res
}

async function Alliance_Coin_Back(context: any, data: any, alliance: Alliance) {
    const res = { cursor: data.cursor-5 }
    return res
}