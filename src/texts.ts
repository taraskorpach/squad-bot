// The bot's Ukrainian: every string it sends, and the language's rules. The setup script imports
// this module, so keep it free of imports. Values a user typed arrive here already escaped.

const HI_BUTTON = '👋 Я тут';

export const texts = {
	/** One message of mentions. */
	tags: (mentions: readonly string[]): string => `📢 ${mentions.join(', ')}`,
	all: {
		nobodyToTag: 'Поки нікого тегати — хай усі напишуть щось у чат.',
	},
	welcome: {
		intro: 'Привіт! Я тегаю всіх (/all), збираю пули на гру (/pool) і веду статистику (/stats).',
		howToBeTagged: `Щоб я міг вас тегати, натисніть «${HI_BUTTON}» або просто напишіть щось у чат.`,
		makeMeAdmin:
			'⚠️ Зробіть мене адміном (вистачить права закріплювати повідомлення), інакше я не бачу частини команд.',
		hiButton: HI_BUTTON,
		hiToast: "Запам'ятав 👌",
	},
	/** Running jokes the bot answers. */
	jokes: {
		alwaysRight: 'Нагадую, Артем Поліченко завжди правий і це не обговорюється.',
	},
	/**
	 * The command menu in group chats, in its order. /domikpisik stays out; /artemisalwaysright is
	 * in it, Taras's call.
	 */
	commandMenu: {
		all: 'Тегнути всіх',
		pool: 'Відкрити пул: /pool [гра] [розмір] [час]',
		join: 'Приєднатися до пулу',
		pools: 'Відкриті пули',
		stats: 'Статистика',
		artemisalwaysright: 'Нагадати, що Артем завжди правий',
	},
	pool: {
		card: {
			header: (game: string, size: number | undefined, when: string): string =>
				`🎮 ${game} · ${seatsText(size)} · ${when}`,
			/** `5 місць`, or `без ліміту` for a pool without a seat limit. */
			seats: (size: number | undefined): string => seatsText(size),
			now: 'зараз',
			today: (time: string): string => `сьогодні о ${time}`,
			tomorrow: (time: string): string => `завтра о ${time}`,
			onDate: (date: string, time: string): string => `${date} о ${time}`,
			author: (name: string): string => `Автор: ${name}`,
			closed: '🔒 закрито',
			closedByAuthor: '🔒 закрито автором',
			players: (count: number, size: number | undefined, names: string): string =>
				`✅ Грають (${size === undefined ? count : `${count}/${size}`}): ${names}`,
			played: (names: string): string => `✅ Грали: ${names}`,
			bench: (names: string): string => `🪑 Лава: ${names}`,
			maybe: (names: string): string => `🤷 Може: ${names}`,
			passed: (names: string): string => `❌ Пас: ${names}`,
			unanswered: (names: string): string => `⏳ Ще не відповіли: ${names}`,
			nobody: '—',
			drawn: '🎲 Склад визначено жеребом',
			playButton: '✅ Граю',
			maybeButton: '🤷 ±',
			passButton: '❌ Пас',
			drawButton: '🎲 Жереб',
			pingButton: '🔔 Нагадати',
			closeButton: '✖️ Закрити',
		},
		/** The messages under a card; each is a reply to it. */
		messages: {
			opening: (author: string, game: string, when: string): string =>
				`📢 ${author} збирає ${game} ${when} — хто грає?`,
			openingNow: 'зараз',
			openingToday: (time: string): string => `на ${time}`,
			openingTomorrow: (time: string): string => `на завтра, ${time}`,
			openingOnDate: (date: string, time: string): string => `на ${date}, ${time}`,
			squadComplete: (game: string, mentions: string): string =>
				`🎮 Склад на ${game} зібрано: ${mentions}.`,
			startsAt: (time: string): string => ` Старт о ${time}.`,
			movedUp: (mention: string, game: string): string =>
				`${mention}, звільнилось місце — ти граєш у ${game}.`,
			drawn: (squad: string, bench: string): string =>
				`🎲 Жереб кинуто. У склад: ${squad}. На лаву: ${bench}.`,
			ping: (mentions: string): string => `🔔 Чекаємо на відповідь: ${mentions}`,
			pingMore: (mentions: string): string => `🔔 ${mentions}`,
			closedByAuthor: (game: string, mentions: string): string =>
				`✖️ Пул на ${game} закрито автором. ${mentions}`,
			closedByAuthorAt: (game: string, time: string, mentions: string): string =>
				`✖️ Пул на ${game} (${time}) закрито автором. ${mentions}`,
			startPing: (game: string, mentions: string): string => `⏰ ${game} — час! ${mentions}`,
			startFill: (players: number, size: number): string => ` (${players}/${size})`,
			startMaybe: (mentions: string): string => `🤷 ${mentions}, ви з нами?`,
		},
		toasts: {
			inSquad: 'Ти в грі ✅',
			onBench: (place: number): string => `Місць немає — ти на лаві, №${place} 🪑`,
			alreadyIn: 'Ти вже в пулі',
			passed: 'Пас ❌',
			alreadyPassed: 'Ти вже пасуєш',
			maybe: 'Може 🤷',
			alreadyMaybe: 'Ти вже на «може»',
			closed: 'Цей пул уже закрито',
			pinged: (count: number): string => `Нагадав: ${count}`,
			pingedJustNow: 'Щойно нагадав — спробуй трохи згодом',
			allAnswered: 'Усі вже відповіли',
			drawn: 'Жереб кинуто 🎲',
			drawNotPlaying: 'Жереб кидають ті, хто в пулі',
			drawUsed: 'Жереб уже кинули',
			benchEmpty: 'Лава порожня — жереб не потрібен',
			closedByYou: 'Пул закрито',
			closeNotAuthor: 'Закрити може лише автор',
		},
		/** The menu a bare /pool opens: the game, the seats, then the time, all with buttons. */
		menu: {
			/** The games on buttons, in order; any other opens by command. */
			games: ['CS2', 'Мафія'],
			pickGame: '🎮 Новий пул — у що граємо?\nІншу гру відкривай командою: /pool назва 5 21:00',
			pickSeats: (game: string): string => `🎮 ${game} — скільки місць?`,
			pickTime: (game: string, seats: string): string => `🎮 ${game} · ${seats} — коли?`,
			pickHour: (game: string, seats: string): string => `🎮 ${game} · ${seats} — о котрій?`,
			pickMinute: (game: string, seats: string, hour: string): string =>
				`🎮 ${game} · ${seats} — о ${hour}:__?`,
			noLimitButton: '∞ Без ліміту',
			nowButton: 'Зараз',
			otherTimeButton: '🕓 Інший час',
			backButton: '← Назад',
			cancelButton: '✖️ Скасувати',
			notYours: 'Це меню не твоє — відкрий своє: /pool',
			hourPassed: 'Ця година вже минула — обери іншу',
			cancelled: 'Скасовано',
			/** The menu in place of itself, when Telegram won't delete it after the pool opened. */
			opened: '✅ Пул відкрито',
		},
		replies: {
			noOpenPool: 'Зараз немає відкритих пулів. Відкрий: /pool',
			closedPool: 'Цей пул уже закрито.',
			badSize: 'Розмір пулу — від 2 до 10. Час пиши як 21:00.',
			badTime: (token: string): string => `Не зрозумів «${token}». Час пиши як 21:00 або 21.00.`,
			badToken: (token: string): string =>
				`Не зрозумів «${token}». Формат: /pool [гра] [розмір] [час], напр. /pool cs2 5 21:00.`,
			openPools: 'Відкриті пули:',
			openPool: (game: string, when: string, fill: string): string =>
				`• ${game} · ${when} · ${fill}`,
			fill: (players: number, size: number | undefined): string =>
				size === undefined ? `${players} у грі` : `${players}/${size}`,
			onBench: (count: number): string => `, +${count} на лаві`,
			cardLink: (url: string): string => ` → <a href="${url}">картка</a>`,
		},
	},
	/** A post sent to the chat that the chat has already seen. */
	shares: {
		bayan: (name: string, when: string, original: string): string =>
			`🪗 Баян! Уже було — ${name}, ${when}${original}`,
		original: (url: string): string => ` → <a href="${url}">оригінал</a>`,
		today: (time: string): string => `сьогодні о ${time}`,
		yesterday: (time: string): string => `вчора о ${time}`,
	},
	/** /stats: a board per joke, each person's count in all. */
	stats: {
		header: '📊 Статистика за весь час',
		all: '📢 /all',
		domikpisik: '🏠 /domikpisik',
		shares: '🍿 Скидає контент',
		joins: (total: number): string => `✅ Граю · разом ${total}`,
		poolsOpened: '🎮 Відкриває пули',
		passes: '❌ Пас',
		row: (place: number, name: string, count: number): string => `${place}. ${name} — ${count}`,
		empty: '— поки порожньо',
	},
} as const;

const UKRAINIAN = new Intl.Collator('uk');
const UKRAINIAN_PLURALS = new Intl.PluralRules('uk');

/** Ukrainian alphabetical order. SQLite sorts by code point, which puts І, Ї, Є and Ґ out of place. */
export function compareNames(a: string, b: string): number {
	return UKRAINIAN.compare(a, b);
}

/** The Ukrainian form for a count: one for 1 and 21, few for 2–4 and 22, many for 5–20 and 25. */
export function plural(count: number, forms: { one: string; few: string; many: string }): string {
	const rule = UKRAINIAN_PLURALS.select(count);
	return rule === 'one' || rule === 'few' ? forms[rule] : forms.many;
}

/** A pool's seats as the card names them: `5 місць`, or `без ліміту`. */
function seatsText(size: number | undefined): string {
	if (size === undefined) return 'без ліміту';
	return `${size} ${plural(size, { one: 'місце', few: 'місця', many: 'місць' })}`;
}
