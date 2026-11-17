import { describe, expect, it } from 'vitest';
import {
	clockTime,
	dayAndMonth,
	daysFrom,
	nextMidnight,
	occurrencesAround,
	upcomingHours,
} from '../src/kyiv-time';

describe('upcomingHours', () => {
	// 16.11.2030 in Kyiv, two hours ahead of UTC in winter.
	const kyiv = (hour: number, minute = 0) => Date.UTC(2030, 10, 16, hour - 2, minute);

	it.each([
		['at 18:40', kyiv(18, 40), [19, 20, 21, 22, 23]],
		['on the hour, which is now rather than ahead', kyiv(18), [19, 20, 21, 22, 23]],
		['after 23:00, none', kyiv(23, 10), []],
		['just after midnight', kyiv(0, 30), Array.from({ length: 23 }, (_, index) => index + 1)],
	])('lists the full hours still ahead today %s', (_case, now, hours) => {
		expect(upcomingHours(now)).toEqual(hours);
	});
});

describe('nextMidnight', () => {
	it('is the next 00:00 on the Kyiv clock', () => {
		// 16.11 at 23:30 in Kyiv → 17.11 at 00:00, which is 22:00 UTC on the 16th.
		expect(nextMidnight(Date.UTC(2026, 10, 16, 21, 30))).toBe(Date.UTC(2026, 10, 16, 22));
	});

	it('moves on a whole day from midnight itself', () => {
		expect(nextMidnight(Date.UTC(2026, 10, 16, 22))).toBe(Date.UTC(2026, 10, 17, 22));
	});

	it('follows the clocks on the night they change', () => {
		// 28.03 at 23:00 in Kyiv (UTC+2) → 29.03 at 00:00, still before the 03:00 jump.
		expect(nextMidnight(Date.UTC(2026, 2, 28, 21))).toBe(Date.UTC(2026, 2, 28, 22));
		// 29.03 midday (UTC+3 by then) → 30.03 at 00:00 summer time.
		expect(nextMidnight(Date.UTC(2026, 2, 29, 9))).toBe(Date.UTC(2026, 2, 29, 21));
	});
});

const utc = (month: number, day: number, hour: number, minute = 0) =>
	Date.UTC(2026, month - 1, day, hour, minute);

describe('occurrencesAround', () => {
	it("is the time on yesterday's, today's and tomorrow's Kyiv date", () => {
		// 16.11 at 15:00 in Kyiv, two hours ahead of UTC in winter.
		expect(occurrencesAround({ hour: 21, minute: 0 }, utc(11, 16, 13))).toEqual({
			yesterday: utc(11, 15, 19),
			today: utc(11, 16, 19),
			tomorrow: utc(11, 17, 19),
		});
	});

	it('counts days by the Kyiv calendar, not by UTC', () => {
		// 00:30 on 17.11 in Kyiv is still the 16th in UTC.
		const { today } = occurrencesAround({ hour: 12, minute: 0 }, utc(11, 16, 22, 30));

		expect(today).toBe(utc(11, 17, 10));
	});

	it('moves a time in the spring-forward gap later by the gap: 03:30 becomes 04:30', () => {
		const { today } = occurrencesAround({ hour: 3, minute: 30 }, utc(3, 29, 10));

		expect(today).toBe(utc(3, 29, 1, 30));
	});

	it('takes the earlier 03:30 of the repeated autumn hour', () => {
		const { today } = occurrencesAround({ hour: 3, minute: 30 }, utc(10, 25, 10));

		expect(today).toBe(utc(10, 25, 0, 30));
	});
});

describe('daysFrom', () => {
	it.each([
		['the same Kyiv day', utc(11, 16, 6), 0],
		['the next Kyiv day, though UTC still says the 16th', utc(11, 16, 22, 30), 1],
		['the day before', utc(11, 15, 20), -1],
	])('is the calendar days to %s', (_case, ms, days) => {
		expect(daysFrom(utc(11, 16, 12), ms)).toBe(days);
	});
});

describe('clockTime and dayAndMonth', () => {
	it('read an instant on the Kyiv clock and calendar', () => {
		expect(clockTime(utc(11, 16, 19))).toBe('21:00');
		expect(clockTime(utc(11, 16, 7, 5))).toBe('09:05');
		expect(dayAndMonth(utc(11, 16, 22, 30))).toBe('17.11');
		expect(dayAndMonth(utc(3, 1, 12))).toBe('01.03');
	});
});
