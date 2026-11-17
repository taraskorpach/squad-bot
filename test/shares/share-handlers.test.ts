import { describe, expect, it } from 'vitest';
import { tagAll } from '../../src/members/all-handlers';
import { trackShares } from '../../src/shares/share-handlers';
import { captionMessage, hiddenLinkMessage, linkMessage, withLinks } from '../helpers/links';
import { freshRoom, type RoomStub, roomWith, rows } from '../helpers/rooms';
import { telegram } from '../helpers/telegram';
import { command, textMessage, users } from '../helpers/updates';

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
	it('records each post for its sender, when it was sent and in which message, and says nothing', async () => {
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
		expect(telegram.calls()).toEqual([]);
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
