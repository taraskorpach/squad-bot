import { describe, expect, it } from 'vitest';
import { tagAll } from '../../src/members/all-handlers';
import { trackShares } from '../../src/shares/share-handlers';
import { captionMessage, hiddenLinkMessage, linkMessage, withLinks } from '../helpers/links';
import { freshRoom, type RoomStub, roomWith, rows } from '../helpers/rooms';
import { telegram } from '../helpers/telegram';
import { CHAT_ID, command, textMessage, users } from '../helpers/updates';

const MINUTE = 60 * 1000;

const { taras, oleg, maks, otherBot } = users;

function shares(stub: RoomStub) {
	return rows(
		stub,
		"SELECT user_id, ref, message_id, at FROM events WHERE kind = 'share' ORDER BY id",
	);
}

function refsOf(stub: RoomStub) {
	return shares(stub).then((found) => found.map((share) => share.ref));
}

describe('a message with posts', () => {
	it('records each post for its sender, when it was sent and in which message, and writes nothing', async () => {
		const stub = await roomWith([trackShares]);
		const message = linkMessage(
			'глянь https://www.instagram.com/reel/DezXNvMGxHM/?vrfl=MXNoaW1lajB2ZXFtNw== і https://youtu.be/dQw4w9WgXcQ',
			{ from: oleg },
		);

		await stub.handleUpdate(message);

		const sent = {
			user_id: oleg.id,
			message_id: message.message?.message_id,
			at: (message.message?.date ?? 0) * 1000,
		};
		expect(await shares(stub)).toEqual([
			{ ...sent, ref: 'instagram:DezXNvMGxHM' },
			{ ...sent, ref: 'youtube:dQw4w9WgXcQ' },
		]);
		expect(telegram.callsTo('sendMessage')).toEqual([]);
	});

	it('finds posts in a photo caption and behind a hidden link', async () => {
		const stub = await roomWith([trackShares]);

		await stub.handleUpdate(captionMessage('😂 https://vm.tiktok.com/ZMhvqJ8Fx/', { from: maks }));
		await stub.handleUpdate(
			hiddenLinkMessage('дивись', 'https://www.threads.com/@oleg/post/DFp3Kx2tQ9a', { from: maks }),
		);

		expect(await refsOf(stub)).toEqual(['tiktok:ZMhvqJ8Fx', 'threads:DFp3Kx2tQ9a']);
	});

	it('records one post that a message links twice, as a Short and its watch link', async () => {
		const stub = await roomWith([trackShares]);

		await stub.handleUpdate(
			linkMessage(
				'https://www.youtube.com/shorts/dQw4w9WgXcQ https://www.youtube.com/watch?v=dQw4w9WgXcQ',
			),
		);

		expect(await refsOf(stub)).toEqual(['youtube:dQw4w9WgXcQ']);
	});

	it('records a repeat again, for the board to count each post once', async () => {
		const stub = await roomWith([trackShares]);

		await stub.handleUpdate(linkMessage('https://youtu.be/dQw4w9WgXcQ', { from: maks }));
		await stub.handleUpdate(linkMessage('https://youtu.be/dQw4w9WgXcQ', { from: maks }));

		expect(await refsOf(stub)).toEqual(['youtube:dQw4w9WgXcQ', 'youtube:dQw4w9WgXcQ']);
	});

	it('leaves links to anything else, and messages with no link, alone', async () => {
		const stub = await roomWith([trackShares]);

		await stub.handleUpdate(linkMessage('https://example.com/ і https://www.instagram.com/oleg/'));
		await stub.handleUpdate(textMessage('instagram.com/reel/DezXNvMGxHM, але без посилання'));

		expect(await shares(stub)).toEqual([]);
	});

	it('is counted once per update, even when Telegram delivers one twice', async () => {
		const stub = await roomWith([trackShares]);
		const message = linkMessage('https://youtu.be/dQw4w9WgXcQ');

		await stub.handleUpdate(message);
		await stub.handleUpdate(message);

		expect(await shares(stub)).toHaveLength(1);
	});

	it('is still counted when it reaches the bot over 10 minutes late', async () => {
		const now = Date.now();
		const stub = await roomWith([trackShares], { clock: () => now });
		const date = Math.floor((now - 11 * MINUTE) / 1000);

		await stub.handleUpdate(linkMessage('https://youtu.be/dQw4w9WgXcQ', { date }));

		expect(await shares(stub)).toEqual([expect.objectContaining({ at: date * 1000 })]);
	});

	it("leaves a bot's posts uncounted", async () => {
		const stub = await roomWith([trackShares]);

		await stub.handleUpdate(linkMessage('https://youtu.be/dQw4w9WgXcQ', { from: otherBot }));

		expect(await shares(stub)).toEqual([]);
	});

	it("counts a post in a command's message after the command has run", async () => {
		const stub = await roomWith([trackShares, tagAll]);

		await stub.handleUpdate(
			withLinks(command('/all глянь https://youtu.be/dQw4w9WgXcQ', { from: taras })),
		);

		expect(await rows(stub, 'SELECT kind, ref FROM events ORDER BY id')).toEqual([
			{ kind: 'all', ref: null },
			{ kind: 'share', ref: 'youtube:dQw4w9WgXcQ' },
		]);
	});

	it("is one of the bot's features, ahead of its commands", async () => {
		const stub = freshRoom();

		await stub.handleUpdate(
			withLinks(command('/all глянь https://youtu.be/dQw4w9WgXcQ', { from: taras })),
		);

		expect(await rows(stub, 'SELECT kind FROM events ORDER BY id')).toEqual([
			{ kind: 'all' },
			{ kind: 'share' },
		]);
	});
});

describe('a post the chat has seen', () => {
	// 17.11.2026 at 21:40 in Kyiv, two hours ahead of UTC in winter.
	const NOW = Date.UTC(2026, 10, 17, 19, 40);
	const seconds = (ms: number) => Math.floor(ms / 1000);
	const DAY = 24 * 60 * MINUTE;

	/** A room on a fixed clock, where Олег sent the Short at 21:40 yesterday. */
	async function roomWithFirstShare() {
		const stub = await roomWith([trackShares], { clock: () => NOW });
		const first = linkMessage('https://www.youtube.com/shorts/dQw4w9WgXcQ', {
			from: oleg,
			date: seconds(NOW - DAY),
		});
		await stub.handleUpdate(first);
		telegram.reset();
		return { stub, firstId: first.message?.message_id };
	}

	it('gets the баян in reply: who sent it first, when, and a link to their message', async () => {
		const { stub, firstId } = await roomWithFirstShare();
		const repeat = linkMessage('https://youtu.be/dQw4w9WgXcQ', { from: maks, date: seconds(NOW) });

		await stub.handleUpdate(repeat);

		expect(telegram.callsTo('sendMessage')).toEqual([
			{
				chat_id: CHAT_ID,
				text: `🪗 Баян! Уже було — Олег, вчора о 21:40 → <a href="https://t.me/c/1234567890/${firstId}">оригінал</a>`,
				parse_mode: 'HTML',
				link_preview_options: { is_disabled: true },
				reply_parameters: {
					message_id: repeat.message?.message_id,
					allow_sending_without_reply: true,
				},
			},
		]);
		expect(await refsOf(stub)).toEqual(['youtube:dQw4w9WgXcQ', 'youtube:dQw4w9WgXcQ']);
	});

	it("names the sender themselves for their own repeat, and records it for the board's once-per-post count", async () => {
		const { stub } = await roomWithFirstShare();

		await stub.handleUpdate(
			linkMessage('https://youtu.be/dQw4w9WgXcQ', { from: oleg, date: seconds(NOW) }),
		);

		const [reply] = telegram.callsTo('sendMessage');
		expect(String(reply?.text)).toMatch(/^🪗 Баян! Уже було — Олег, вчора о 21:40 → /);
		expect(await shares(stub)).toHaveLength(2);
	});

	it('answers a message with two posts the chat has seen in one reply, a line each', async () => {
		const { stub } = await roomWithFirstShare();
		await stub.handleUpdate(
			linkMessage('https://vm.tiktok.com/ZMhvqJ8Fx/', { from: taras, date: seconds(NOW - DAY) }),
		);
		telegram.reset();

		await stub.handleUpdate(
			linkMessage('https://youtu.be/dQw4w9WgXcQ https://vm.tiktok.com/ZMhvqJ8Fx/', {
				from: maks,
				date: seconds(NOW),
			}),
		);

		const replies = telegram.callsTo('sendMessage');
		expect(replies).toHaveLength(1);
		expect(String(replies[0]?.text).split('\n')).toEqual([
			expect.stringMatching(/^🪗 Баян! Уже було — Олег, вчора о 21:40 → /),
			expect.stringMatching(/^🪗 Баян! Уже було — Тарас, вчора о 21:40 → /),
		]);
	});

	it('gets no 👀: the баян is its answer', async () => {
		const { stub } = await roomWithFirstShare();

		await stub.handleUpdate(
			linkMessage('https://youtu.be/dQw4w9WgXcQ', { from: maks, date: seconds(NOW) }),
		);

		expect(telegram.callsTo('setMessageReaction')).toEqual([]);
	});

	it('beside a post new to the chat, gets the баян and the 👀 both', async () => {
		const { stub } = await roomWithFirstShare();

		await stub.handleUpdate(
			linkMessage('https://youtu.be/dQw4w9WgXcQ https://vm.tiktok.com/ZMhvqJ8Fx/', {
				from: maks,
				date: seconds(NOW),
			}),
		);

		expect(telegram.callsTo('setMessageReaction')).toHaveLength(1);
		expect(telegram.callsTo('sendMessage')).toHaveLength(1);
	});

	it('gets neither the баян nor the 👀 when it reaches the bot over 10 minutes late, and still counts', async () => {
		const { stub } = await roomWithFirstShare();

		await stub.handleUpdate(
			linkMessage('https://youtu.be/dQw4w9WgXcQ https://vm.tiktok.com/ZMhvqJ8Fx/', {
				from: maks,
				date: seconds(NOW - 11 * MINUTE),
			}),
		);

		expect(telegram.calls()).toEqual([]);
		expect(await shares(stub)).toHaveLength(3);
	});

	it('keeps its count when the 👀 and the баян both fail', async () => {
		const { stub } = await roomWithFirstShare();
		telegram.fail('setMessageReaction', { status: 400, description: 'REACTION_INVALID' });
		telegram.fail('sendMessage', { status: 400 });

		await stub.handleUpdate(
			linkMessage('https://youtu.be/dQw4w9WgXcQ https://vm.tiktok.com/ZMhvqJ8Fx/', {
				from: maks,
				date: seconds(NOW),
			}),
		);

		expect(await shares(stub)).toHaveLength(3);
		expect(await rows(stub, 'SELECT update_id FROM failed_updates')).toEqual([]);
	});
});

describe('a post new to the chat', () => {
	it('gets 👀 on its message, and no reply', async () => {
		const stub = await roomWith([trackShares]);
		const message = linkMessage('https://youtu.be/dQw4w9WgXcQ', { from: oleg });

		await stub.handleUpdate(message);

		expect(telegram.callsTo('setMessageReaction')).toEqual([
			{
				chat_id: CHAT_ID,
				message_id: message.message?.message_id,
				reaction: [{ type: 'emoji', emoji: '👀' }],
			},
		]);
		expect(telegram.callsTo('sendMessage')).toEqual([]);
	});
});
