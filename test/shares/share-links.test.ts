import { describe, expect, it } from 'vitest';
import { postOf } from '../../src/shares/share-links';

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

	it.each([
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
