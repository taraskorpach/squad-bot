// The chat lives on Kyiv time: the one place the zone is named. SQLite can't do this itself:
// its `localtime` is the host's UTC, and it knows no IANA zones.
const KYIV = 'Europe/Kyiv';

/** A time of day as a person types it, `21:00`. */
export interface WallTime {
	hour: number;
	minute: number;
}

export interface Occurrences {
	yesterday: number;
	today: number;
	tomorrow: number;
}

/**
 * The instants `time` names on the Kyiv dates of yesterday, today and tomorrow around `ms`.
 * Temporal's compatible rule: a time in the spring-forward gap moves later by the gap
 * (03:30 becomes 04:30), and in the repeated autumn hour the earlier one counts.
 */
export function occurrencesAround(time: WallTime, ms: number): Occurrences {
	const today = inKyiv(ms).toPlainDate();
	const on = (days: number): number => {
		const { year, month, day } = today.add({ days });
		return Temporal.ZonedDateTime.from(
			{ timeZone: KYIV, year, month, day, hour: time.hour, minute: time.minute },
			{ disambiguation: 'compatible' },
		).epochMilliseconds;
	};
	return { yesterday: on(-1), today: on(0), tomorrow: on(1) };
}

/** The next 00:00 on the Kyiv clock: when сьогодні and завтра change their meaning. */
export function nextMidnight(ms: number): number {
	return startOfDay(inKyiv(ms).toPlainDate().add({ days: 1 }));
}

/** The full hours still ahead on `ms`'s Kyiv date: at 18:40, 19 to 23; after 23:00, none. */
export function upcomingHours(ms: number): number[] {
	const { hour } = inKyiv(ms);
	return Array.from({ length: 23 - hour }, (_, index) => hour + 1 + index);
}

/** Kyiv calendar days from `now`'s date to `ms`'s: 0 the same day, 1 the next, -1 the one before. */
export function daysFrom(now: number, ms: number): number {
	return inKyiv(now).toPlainDate().until(inKyiv(ms).toPlainDate(), { largestUnit: 'days' }).days;
}

/** `21:00` on the Kyiv clock. */
export function clockTime(ms: number): string {
	const { hour, minute } = inKyiv(ms);
	return `${twoDigits(hour)}:${twoDigits(minute)}`;
}

/** `16.11` on the Kyiv calendar. */
export function dayAndMonth(ms: number): string {
	const { day, month } = inKyiv(ms);
	return `${twoDigits(day)}.${twoDigits(month)}`;
}

function inKyiv(ms: number): Temporal.ZonedDateTime {
	return Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(KYIV);
}

function startOfDay(date: Temporal.PlainDate): number {
	return date.toZonedDateTime(KYIV).epochMilliseconds;
}

function twoDigits(value: number): string {
	return String(value).padStart(2, '0');
}
