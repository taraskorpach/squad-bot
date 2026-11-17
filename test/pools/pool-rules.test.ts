import { describe, expect, it } from 'vitest';
import {
	type Answer,
	answer,
	closingTime,
	draw,
	drawRefusal,
	joinTarget,
	lineupOf,
} from '../../src/pools/pool-rules';

describe('draw', () => {
	const plays = [1, 2, 3, 4, 5, 6].map((userId) => ({
		userId,
		choice: 'play' as const,
		rank: userId,
		answeredAt: userId,
	}));

	it('keeps the line as it was when every pick takes the first in line', () => {
		expect(draw(5, plays, () => 0)).toMatchObject({ squad: [1, 2, 3, 4, 5], bench: [6] });
	});

	it('puts the drawn first and the rest after, each in the order they joined', () => {
		const result = draw(5, plays, () => 0.99);

		expect(result.squad).toEqual([2, 3, 4, 5, 6]);
		expect(result.bench).toEqual([1]);
		expect(result.answers.map(({ userId, rank }) => [userId, rank])).toEqual([
			[2, 1],
			[3, 2],
			[4, 3],
			[5, 4],
			[6, 5],
			[1, 6],
		]);
	});

	it('draws among plays only, and leaves passes as they were', () => {
		const answers = [
			...plays.slice(0, 3),
			{ userId: 9, choice: 'pass' as const, rank: 0, answeredAt: 9 },
		];

		expect(draw(2, answers, () => 0).answers.map(({ userId }) => userId)).toEqual([1, 2, 3]);
	});
});

describe('drawRefusal', () => {
	const lineup = { players: [1, 2], bench: [3], passed: [4], unanswered: [5] };

	it.each([
		['used, once the draw happened', true, lineup, 1, 'used'],
		['not playing, for someone who passed', false, lineup, 4, 'not-playing'],
		['not playing, for someone who never answered', false, lineup, 5, 'not-playing'],
		['bench-empty, with nobody to swap', false, { ...lineup, bench: [] }, 1, 'bench-empty'],
		['none, for a player while the bench waits', false, lineup, 3, undefined],
	] as const)('is %s', (_case, drawn, shown, userId, refusal) => {
		expect(drawRefusal(drawn, shown, userId)).toBe(refusal);
	});
});

describe('joinTarget', () => {
	it.each([
		[
			'the open pool a reply points at',
			{ id: 3, status: 'open' },
			{ id: 9 },
			{ kind: 'pool', poolId: 3 },
		],
		[
			'nothing, for a reply to a closed pool',
			{ id: 3, status: 'closed' },
			{ id: 9 },
			{ kind: 'closed' },
		],
		['the newest open pool without a reply', undefined, { id: 9 }, { kind: 'pool', poolId: 9 }],
		['no pool when none is open', undefined, undefined, { kind: 'none' }],
	] as const)('is %s', (_case, replied, newestOpen, target) => {
		expect(joinTarget(replied, newestOpen)).toEqual(target);
	});
});

describe('closingTime', () => {
	const HOUR = 60 * 60 * 1000;

	it('is three hours after the start, or after the opening for a pool now', () => {
		expect(closingTime(1_000, 5 * HOUR)).toBe(8 * HOUR);
		expect(closingTime(1_000, undefined)).toBe(1_000 + 3 * HOUR);
	});
});

const play = (userId: number, rank: number, answeredAt = rank): Answer => ({
	userId,
	choice: 'play',
	rank,
	answeredAt,
});
const pass = (userId: number, answeredAt: number, rank = 0): Answer => ({
	userId,
	choice: 'pass',
	rank,
	answeredAt,
});

describe('lineupOf', () => {
	it('seats plays by rank, benches the rest, lists passes by when they came and the silent', () => {
		const answers = [play(3, 5), play(1, 1), pass(7, 20), play(2, 2), pass(6, 10), play(4, 9)];

		expect(lineupOf(3, answers, [1, 2, 3, 4, 5, 6, 7, 8])).toEqual({
			players: [1, 2, 3],
			bench: [4],
			passed: [6, 7],
			unanswered: [5, 8],
		});
	});

	it('leaves the bench empty while seats are free', () => {
		expect(lineupOf(5, [play(1, 1)], [1, 2])).toEqual({
			players: [1],
			bench: [],
			passed: [],
			unanswered: [2],
		});
	});
});

describe('answer', () => {
	const pool = { size: 2, squadAnnounced: false };

	it('seats a newcomer at the end of the line while a seat is free', () => {
		expect(answer(pool, [play(1, 1)], 2, 'play', 50)).toEqual({
			write: play(2, 2, 50),
			outcome: 'squad',
			movedUp: [],
			squadCompleted: true,
		});
	});

	it('benches a newcomer once the squad is full, and says where on the bench', () => {
		const full = { size: 2, squadAnnounced: true };

		expect(answer(full, [play(1, 1), play(2, 2), play(3, 3)], 4, 'play', 60)).toEqual({
			write: play(4, 4, 60),
			outcome: 'bench',
			benchPlace: 2,
			movedUp: [],
			squadCompleted: false,
		});
	});

	it('sends someone who passed and comes back to the end of the line', () => {
		const answers = [play(1, 1), pass(2, 5, 2), play(3, 3)];

		expect(answer(pool, answers, 2, 'play', 70)).toMatchObject({
			write: play(2, 4, 70),
			outcome: 'bench',
			benchPlace: 1,
		});
	});

	it('changes nothing for the same answer twice', () => {
		expect(answer(pool, [play(1, 1)], 1, 'play', 80)).toEqual({
			outcome: 'already-in',
			movedUp: [],
			squadCompleted: false,
		});
		expect(answer(pool, [pass(2, 5)], 2, 'pass', 80)).toEqual({
			outcome: 'already-passed',
			movedUp: [],
			squadCompleted: false,
		});
	});

	it('moves the bench head up when a player passes, and leaves the passer out of it', () => {
		const full = { size: 2, squadAnnounced: true };
		const answers = [play(1, 1), play(2, 2), play(3, 3), play(4, 4)];

		expect(answer(full, answers, 1, 'pass', 90)).toEqual({
			write: pass(1, 90, 1),
			outcome: 'passed',
			movedUp: [3],
			squadCompleted: false,
		});
	});

	it('moves nobody when a bench member passes', () => {
		const full = { size: 2, squadAnnounced: true };
		const answers = [play(1, 1), play(2, 2), play(3, 3), play(4, 4)];

		expect(answer(full, answers, 3, 'pass', 90).movedUp).toEqual([]);
	});

	it('takes a pass from someone who never answered', () => {
		expect(answer(pool, [play(1, 1)], 5, 'pass', 95)).toEqual({
			write: pass(5, 95),
			outcome: 'passed',
			movedUp: [],
			squadCompleted: false,
		});
	});

	it('completes the squad only the first time it fills', () => {
		const refilled = { size: 2, squadAnnounced: true };

		expect(answer(pool, [play(1, 1)], 2, 'play', 99).squadCompleted).toBe(true);
		expect(answer(refilled, [play(1, 1), pass(2, 5, 2)], 3, 'play', 99).squadCompleted).toBe(false);
	});
});
