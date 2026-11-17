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

/** Where an answer left the person; on the bench, also where in its line, counting from 1. */
export type Placement =
	| { outcome: 'squad' | 'passed' | 'already-in' | 'already-passed' }
	| { outcome: 'bench'; benchPlace: number };

export type AnswerDecision = Placement & {
	/** The person's new answer, or none when it repeats the one they gave. */
	write?: Answer;
	/** Who moved from the bench into the squad, the person who answered left out. */
	movedUp: number[];
	/** The squad just reached its size and was never announced: announce it, once. */
	squadCompleted: boolean;
};

export interface DrawResult {
	/** Every play renumbered: the drawn squad first, then the rest, each in the order they joined. */
	answers: Answer[];
	squad: number[];
	bench: number[];
}

/** Why 🎲 changes nothing: it was used, the one pressing isn't playing, or nobody sits out. */
export type DrawRefusal = 'used' | 'not-playing' | 'bench-empty';

/** What `/join` joins: the pool its reply points at, or else the newest open one. */
export type JoinTarget = { kind: 'pool'; poolId: number } | { kind: 'closed' } | { kind: 'none' };

export interface Seats {
	/** None for a pool without a seat limit: everyone who says Граю plays. */
	size?: number;
	squadAnnounced: boolean;
}

/** A pool closes by itself this long after its start, or after it opened for a pool now. */
const LIFETIME_MS = 3 * 60 * 60 * 1000;

export function closingTime(openedAt: number, startsAt: number | undefined): number {
	return (startsAt ?? openedAt) + LIFETIME_MS;
}

/**
 * Plays in rank order: the first `size` are the squad, the rest wait on the bench; with no size,
 * every play is in the squad. Passes in the order they came. The unanswered are the members in
 * the chat who haven't answered.
 */
export function lineupOf(
	size: number | undefined,
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
	const seats = size ?? plays.length;
	return {
		players: plays.slice(0, seats),
		bench: plays.slice(seats),
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
	const { size } = seats;
	const reachedSize =
		size !== undefined && before.players.length < size && after.players.length === size;
	return {
		write,
		...placeOf(choice, userId, after),
		movedUp: after.players.filter((id) => id !== userId && !before.players.includes(id)),
		squadCompleted: reachedSize && !seats.squadAnnounced,
	};
}

/**
 * A reply names its pool through any message the bot posted for it: an open pool is joined, a
 * closed one gets the closed reply. No reply, or a reply to anything else, joins the newest.
 */
export function joinTarget(
	replied: { id: number; status: 'open' | 'closed' } | undefined,
	newestOpen: { id: number } | undefined,
): JoinTarget {
	if (replied)
		return replied.status === 'open' ? { kind: 'pool', poolId: replied.id } : { kind: 'closed' };
	return newestOpen ? { kind: 'pool', poolId: newestOpen.id } : { kind: 'none' };
}

/**
 * The one-time draw: `size` players picked uniformly at random from everyone playing, with
 * `random` in [0, 1); with no size, everyone. A draw of 6 for 5 keeps the same squad 1 time in 6.
 */
export function draw(
	size: number | undefined,
	answers: readonly Answer[],
	random: () => number,
): DrawResult {
	const plays = answers.filter((given) => given.choice === 'play').sort((a, b) => a.rank - b.rank);
	const remaining = plays.map((given) => given.userId);
	const seats = size ?? plays.length;
	const picked = new Set<number>();
	while (picked.size < seats && remaining.length > 0) {
		const [chosen] = remaining.splice(Math.floor(random() * remaining.length), 1);
		if (chosen !== undefined) picked.add(chosen);
	}
	const squad = plays.filter((given) => picked.has(given.userId));
	const bench = plays.filter((given) => !picked.has(given.userId));
	return {
		answers: [...squad, ...bench].map((given, index) => ({ ...given, rank: index + 1 })),
		squad: squad.map((given) => given.userId),
		bench: bench.map((given) => given.userId),
	};
}

/** Only someone playing may draw, once, and only while someone sits on the bench. */
export function drawRefusal(
	drawn: boolean,
	lineup: { readonly players: readonly number[]; readonly bench: readonly number[] },
	userId: number,
): DrawRefusal | undefined {
	if (drawn) return 'used';
	if (![...lineup.players, ...lineup.bench].includes(userId)) return 'not-playing';
	if (lineup.bench.length === 0) return 'bench-empty';
	return undefined;
}

function placeOf(choice: Choice, userId: number, after: Lineup): Placement {
	if (choice === 'pass') return { outcome: 'passed' };
	const benchIndex = after.bench.indexOf(userId);
	if (benchIndex === -1) return { outcome: 'squad' };
	return { outcome: 'bench', benchPlace: benchIndex + 1 };
}

function nextRank(answers: readonly Answer[]): number {
	return Math.max(0, ...answers.map((given) => given.rank)) + 1;
}
