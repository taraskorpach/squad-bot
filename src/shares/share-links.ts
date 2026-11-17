// What counts as a post sent to the chat: a link to Instagram or Threads, read as the platform's
// own id for the post. Pure: the feature hands it a message's links.

export type Platform = 'instagram' | 'threads';

/** A post as its platform knows it: two links with the same id lead to one post. */
export interface Post {
	platform: Platform;
	id: string;
}

/** How one platform's links name a post. */
interface PostReader {
	platform: Platform;
	serves: (host: string) => boolean;
	/** The post's id in a link on this platform, or nothing for any other page. */
	idIn: (url: URL) => string | undefined;
}

/** An Instagram or Threads id, and the own code of an Instagram share link. */
const CODE = /^[A-Za-z0-9_-]+$/;

/** The Instagram pages a post's id follows: `/reel/{id}`, `/oleg/reel/{id}`, `/p/{id}`… */
const INSTAGRAM_PAGES = new Set(['reel', 'reels', 'p', 'tv']);

const instagram: PostReader = {
	platform: 'instagram',
	// The look-alike preview hosts, ddinstagram.com and kkinstagram.com, end in it too.
	serves: (host) => host === 'instagr.am' || host.endsWith('instagram.com'),
	idIn: (url) => matching(CODE, instagramId(segmentsOf(url))),
};

const threads: PostReader = {
	platform: 'threads',
	serves: (host) => isOn(host, 'threads.com') || isOn(host, 'threads.net'),
	idIn: (url) => {
		const [profile, page, id] = segmentsOf(url);
		return profile?.startsWith('@') && page === 'post' ? matching(CODE, id) : undefined;
	},
};

const READERS: readonly PostReader[] = [instagram, threads];

/** The post a link leads to, or nothing for any other link. */
export function postOf(link: string): Post | undefined {
	const url = webUrlOf(link);
	if (!url) return undefined;
	const reader = READERS.find((candidate) => candidate.serves(url.hostname));
	const id = reader?.idIn(url);
	return reader && id ? { platform: reader.platform, id } : undefined;
}

/** A share link's own code, or the id after the page that names a post; a sound's page has none. */
function instagramId(path: readonly string[]): string | undefined {
	if (path[0] === 'share') return ['reel', 'p'].includes(path[1] ?? '') ? path[2] : path[1];
	const page = path.findIndex((segment) => INSTAGRAM_PAGES.has(segment));
	const id = page === -1 ? undefined : path[page + 1];
	return id === 'audio' ? undefined : id;
}

/** A link as a web page's URL. Telegram also links `instagram.com/…` with no scheme. */
function webUrlOf(link: string): URL | undefined {
	if (/^https?:\/\//i.test(link)) return URL.parse(link) ?? undefined;
	if (link.includes('://')) return undefined;
	return URL.parse(`https://${link}`) ?? undefined;
}

function segmentsOf(url: URL): string[] {
	return url.pathname.split('/').filter((segment) => segment !== '');
}

/** The domain itself or any of its subdomains. */
function isOn(host: string, domain: string): boolean {
	return host === domain || host.endsWith(`.${domain}`);
}

function matching(pattern: RegExp, id: string | undefined): string | undefined {
	return id !== undefined && pattern.test(id) ? id : undefined;
}
