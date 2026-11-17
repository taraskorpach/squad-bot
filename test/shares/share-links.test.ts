import { describe, expect, it } from 'vitest';
import { postOf, postRefs } from '../../src/shares/share-links';

describe('postOf', () => {
	describe('Instagram', () => {
		it.each([
			['https://www.instagram.com/reel/DezXNvMGxHM/?vrfl=MXNoaW1lajB2ZXFtNw==', 'DezXNvMGxHM'],
			['instagram.com/reels/DezXNvMGxHM', 'DezXNvMGxHM'],
			['https://www.instagram.com/p/DezXNvMGxHM/', 'DezXNvMGxHM'],
			['https://www.instagram.com/oleg/reel/DezXNvMGxHM/', 'DezXNvMGxHM'],
			['https://m.instagram.com/p/C1a2b3c4d5e/?igsh=MTc4MmM1YmI2Ng==', 'C1a2b3c4d5e'],
			['https://www.instagram.com/tv/C1a2b3c4d5e/', 'C1a2b3c4d5e'],
			['https://www.ddinstagram.com/reel/DezXNvMGxHM/', 'DezXNvMGxHM'],
			['https://kkinstagram.com/reel/DezXNvMGxHM/', 'DezXNvMGxHM'],
			['https://www.instagram.com/share/reel/BAdGk2x9Qp/', 'BAdGk2x9Qp'],
			['https://www.instagram.com/share/BAdGk2x9Qp', 'BAdGk2x9Qp'],
			['https://instagr.am/p/C1a2b3c4d5e/', 'C1a2b3c4d5e'],
			['HTTPS://WWW.INSTAGRAM.COM/reel/DezXNvMGxHM/', 'DezXNvMGxHM'],
		])('reads %s as the post %s', (link, id) => {
			expect(postOf(link)).toEqual({ platform: 'instagram', id });
		});
	});

	describe('Threads', () => {
		it.each([
			['https://www.threads.com/@oleg/post/DFp3Kx2tQ9a?xmt=AQGzKh9', 'DFp3Kx2tQ9a'],
			['https://www.threads.net/@oleg/post/DFp3Kx2tQ9a', 'DFp3Kx2tQ9a'],
			['threads.com/@oleg/post/DFp3Kx2tQ9a/media', 'DFp3Kx2tQ9a'],
		])('reads %s as the post %s', (link, id) => {
			expect(postOf(link)).toEqual({ platform: 'threads', id });
		});
	});

	describe('TikTok', () => {
		it.each([
			['https://www.tiktok.com/@oleg/video/7312345678901234567', '7312345678901234567'],
			['https://www.tiktok.com/@oleg/photo/7312345678901234568', '7312345678901234568'],
			[
				'https://m.tiktok.com/@oleg/video/7312345678901234567?is_from_webapp=1',
				'7312345678901234567',
			],
			['https://vm.tiktok.com/ZMhvqJ8Fx/', 'ZMhvqJ8Fx'],
			['https://vt.tiktok.com/ZSjAb12Cd/', 'ZSjAb12Cd'],
			['https://www.tiktok.com/t/ZTRk9LmNp/', 'ZTRk9LmNp'],
		])('reads %s as the post %s', (link, id) => {
			expect(postOf(link)).toEqual({ platform: 'tiktok', id });
		});
	});

	describe('YouTube', () => {
		it.each([
			['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'dQw4w9WgXcQ'],
			['https://youtu.be/dQw4w9WgXcQ?si=Kq3vXbT0aLmN2pQr', 'dQw4w9WgXcQ'],
			['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
			['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
			['https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ', 'dQw4w9WgXcQ'],
			['https://www.youtube.com/live/dQw4w9WgXcQ?feature=share', 'dQw4w9WgXcQ'],
			['youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
		])('reads %s as the video %s', (link, id) => {
			expect(postOf(link)).toEqual({ platform: 'youtube', id });
		});
	});

	it.each([
		['https://www.tiktok.com/@oleg', 'a profile on TikTok'],
		['https://www.tiktok.com/music/original-sound-7312345678901234569', 'a sound on TikTok'],
		['https://vm.tiktok.com/', 'a short link with no code'],
		['https://www.youtube.com/@oleg', 'a channel'],
		['https://www.youtube.com/playlist?list=PL0123456789', 'a playlist'],
		['https://www.youtube.com/results?search_query=cs2', 'a search'],
		['https://www.youtube.com/watch?v=too-short', 'an id of the wrong length'],
		['https://www.instagram.com/stories/oleg/3141592653/', 'a story'],
		['https://www.instagram.com/oleg/', 'a profile'],
		['https://www.instagram.com/reels/audio/123456789/', "a sound's page"],
		['https://www.instagram.com/reels/', 'the reels tab'],
		['https://www.threads.com/@oleg', 'a profile on Threads'],
		['https://notthreads.com/@oleg/post/DFp3Kx2tQ9a', 'a site named like Threads'],
		['https://x.com/oleg/status/1859000000000000000', 'another site'],
		['ftp://www.instagram.com/reel/DezXNvMGxHM/', 'no web page'],
		['дивись', 'no link at all'],
	])('reads %s as no post: %s', (link) => {
		expect(postOf(link)).toBeUndefined();
	});
});

describe('postRefs', () => {
	it('names each post of a message once, by platform and id, in the order the links come', () => {
		expect(
			postRefs([
				'https://vm.tiktok.com/ZMhvqJ8Fx/',
				'https://youtu.be/dQw4w9WgXcQ',
				'https://example.com/',
				'https://www.youtube.com/shorts/dQw4w9WgXcQ',
				'https://www.instagram.com/reel/DezXNvMGxHM/',
				'https://www.threads.com/@oleg/post/DezXNvMGxHM',
			]),
		).toEqual([
			'tiktok:ZMhvqJ8Fx',
			'youtube:dQw4w9WgXcQ',
			'instagram:DezXNvMGxHM',
			'threads:DezXNvMGxHM',
		]);
	});

	it('names nothing for a message with no post', () => {
		expect(postRefs(['https://example.com/', 'https://www.instagram.com/oleg/'])).toEqual([]);
	});
});
