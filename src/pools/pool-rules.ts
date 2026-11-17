// Who plays, who waits and who passed, decided without storage or Telegram: the actions apply it.

export type Choice = 'play' | 'pass';

export interface Answer {
	userId: number;
	choice: Choice;
	/** Place in line among plays: the lower, the sooner seated. A pass keeps its last one. */
	rank: number;
	answeredAt: number;
}

export interface Lineup {
	players: number[];
	bench: number[];
	passed: number[];
	unanswered: number[];
}

export type Outcome = 'squad' | 'bench' | 'passed' | 'already-in' | 'already-passed';

export interface AnswerDecision {
	/** The person's new answer, or none when it repeats the one they gave. */
	write?: Answer;
	outcome: Outcome;
	/** Where on the bench, counting from 1, for `bench`. */
	benchPlace?: number;
	/** Who moved from the bench into the squad, the person who answered left out. */
	movedUp: number[];
	/** The squad just reached its size and was never announced: announce it, once. */
	squadCompleted: boolean;
}

export interface Seats {
	size: number;
	squadAnnounced: boolean;
}

/** A pool closes by itself this long after its start, or after it opened for a pool now. */
const LIFETIME_MS = 3 * 60 * 60 * 1000;

export function closingTime(openedAt: number, startsAt: number | undefined): number {
	return (startsAt ?? openedAt) + LIFETIME_MS;
}

/**
 * Plays in rank order: the first `size` are the squad, the rest wait on the bench. Passes in the
 * order they came. The unanswered are the members in the chat who haven't answered.
 */
export function lineupOf(
	size: number,
	answers: readonly Answer[],
	inChat: readonly number[],
): Lineup {
	const plays = answers
		.filter((given) => given.choice === 'play')
		.sort((a, b) => a.rank - b.rank)
		.map((given) => given.userId);
	const passed = answers
		.filter((given) => given.choice === 'pass')
		.sort((a, b) => a.answeredAt - b.answeredAt)
		.map((given) => given.userId);
	const answered = new Set(answers.map((given) => given.userId));
	return {
		players: plays.slice(0, size),
		bench: plays.slice(size),
		passed,
		unanswered: inChat.filter((id) => !answered.has(id)),
	};
}

/**
 * A person's Граю or Пас. Граю from anyone not playing goes to the end of the line; Пас takes them
 * out of it, and the bench head takes a freed seat. The same answer twice changes nothing.
 */
export function answer(
	seats: Seats,
	answers: readonly Answer[],
	userId: number,
	choice: Choice,
	now: number,
): AnswerDecision {
	const current = answers.find((given) => given.userId === userId);
	if (current?.choice === choice) {
		const outcome = choice === 'play' ? 'already-in' : 'already-passed';
		return { outcome, movedUp: [], squadCompleted: false };
	}
	const rank = choice === 'play' ? nextRank(answers) : (current?.rank ?? 0);
	const write: Answer = { userId, choice, rank, answeredAt: now };
	const before = lineupOf(seats.size, answers, []);
	const others = answers.filter((given) => given.userId !== userId);
	const after = lineupOf(seats.size, [...others, write], []);
	const reachedSize = before.players.length < seats.size && after.players.length === seats.size;
	return {
		write,
		...placeOf(choice, userId, after),
		movedUp: after.players.filter((id) => id !== userId && !before.players.includes(id)),
		squadCompleted: reachedSize && !seats.squadAnnounced,
	};
}

function placeOf(choice: Choice, userId: number, after: Lineup) {
	if (choice === 'pass') return { outcome: 'passed' as const };
	const benchIndex = after.bench.indexOf(userId);
	if (benchIndex === -1) return { outcome: 'squad' as const };
	return { outcome: 'bench' as const, benchPlace: benchIndex + 1 };
}

function nextRank(answers: readonly Answer[]): number {
	return Math.max(0, ...answers.map((given) => given.rank)) + 1;
}
