import type { MessageEntity, PhotoSize, Update } from 'grammy/types';
import { type MessageOptions, textMessage } from './updates';

/** What Telegram marks as a link: `https://…`, or a bare `instagram.com/…`. */
const LINK = /(?:https?:\/\/)?(?:[\w-]+\.)+[a-z]{2,}(?:\/\S*)?/gi;

const PHOTO: PhotoSize = { file_id: 'photo', file_unique_id: 'photo', width: 1080, height: 1920 };

/** The `url` entities Telegram adds to the links in a text, at their UTF-16 offsets. */
export function urlEntities(text: string): MessageEntity[] {
	return [...text.matchAll(LINK)].map((match) => ({
		type: 'url',
		offset: match.index,
		length: match[0].length,
	}));
}

/** A text message with its links, and the `url` entities Telegram adds to them. */
export function linkMessage(text: string, options: MessageOptions = {}): Update {
	return withLinks(textMessage(text, options));
}

/** The update's text message with `url` entities for its links, after the ones it has, as a command's. */
export function withLinks(update: Update): Update {
	const { message } = update;
	if (message?.text === undefined) throw new Error('withLinks takes a text message');
	const entities = [...(message.entities ?? []), ...urlEntities(message.text)];
	return { ...update, message: { ...message, entities } };
}

/** A photo whose caption has links, with the `caption_entities` Telegram adds to them. */
export function captionMessage(caption: string, options: MessageOptions = {}): Update {
	const { message, ...update } = textMessage(caption, options);
	if (message === undefined) throw new Error('textMessage gave no message');
	const { text: _text, ...photo } = message;
	return {
		...update,
		message: { ...photo, photo: [PHOTO], caption, caption_entities: urlEntities(caption) },
	};
}

/** A text message whose words, all of them, link to `url`: a `text_link` entity. */
export function hiddenLinkMessage(text: string, url: string, options: MessageOptions = {}): Update {
	const { message, ...update } = textMessage(text, options);
	if (message === undefined) throw new Error('textMessage gave no message');
	const entities: MessageEntity[] = [{ type: 'text_link', offset: 0, length: text.length, url }];
	return { ...update, message: { ...message, entities } };
}
