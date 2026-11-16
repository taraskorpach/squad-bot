import { Api } from 'grammy';
import type { Chat, ChatMemberUpdated, Update } from 'grammy/types';
import { ROOM_NAME } from './chat/chat-room';
import { parseAllowedChatId } from './settings';
import { API_TIMEOUT_SECONDS, chatIdOf, isInChat, WEBHOOK_PATH } from './telegram';

export { ChatRoom } from './chat/chat-room';

const SECRET_HEADER = 'X-Telegram-Bot-Api-Secret-Token';

export default {
	async fetch(request, env): Promise<Response> {
		if (request.method !== 'POST' || new URL(request.url).pathname !== WEBHOOK_PATH) {
			return answer(404);
		}
		if (!carriesSecret(request, env.WEBHOOK_SECRET)) return answer(401);
		const update = await readUpdate(request);
		if (!update) return answer(400);
		return route(update, env);
	},
} satisfies ExportedHandler<Env>;

async function route(update: Update, env: Env): Promise<Response> {
	const chatId = chatIdOf(update);
	if (chatId !== parseAllowedChatId(env.ALLOWED_CHAT_ID)) {
		console.log(`Ignored update ${update.update_id} from chat ${chatId ?? 'none'}`);
		await leaveIfAdded(update.my_chat_member, env.BOT_TOKEN);
		return answer(200);
	}
	logIfMoved(update);
	try {
		await env.CHAT_ROOM.getByName(ROOM_NAME).handleUpdate(update);
		return answer(200);
	} catch (error) {
		// The room rejects only when a redelivery is safe and still worth it.
		console.error(`Update ${update.update_id} failed; Telegram will redeliver it`, error);
		return answer(500);
	}
}

function carriesSecret(request: Request, secret: string): boolean {
	const given = request.headers.get(SECRET_HEADER);
	if (given === null) return false;
	const encoder = new TextEncoder();
	const [a, b] = [encoder.encode(given), encoder.encode(secret)];
	return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}

async function readUpdate(request: Request): Promise<Update | undefined> {
	const body: unknown = await request.json().catch(() => undefined);
	const isUpdate =
		typeof body === 'object' &&
		body !== null &&
		typeof (body as { update_id?: unknown }).update_id === 'number';
	return isUpdate ? (body as Update) : undefined;
}

/** The bot serves one chat: it leaves any other group that adds it. Best effort. */
async function leaveIfAdded(change: ChatMemberUpdated | undefined, token: string): Promise<void> {
	if (!change || !isGroup(change.chat)) return;
	if (isInChat(change.old_chat_member) || !isInChat(change.new_chat_member)) return;
	try {
		await new Api(token, { timeoutSeconds: API_TIMEOUT_SECONDS }).leaveChat(change.chat.id);
	} catch (error) {
		console.error(`Could not leave chat ${change.chat.id}`, error);
	}
}

function isGroup(chat: Chat): boolean {
	return chat.type === 'group' || chat.type === 'supergroup';
}

function logIfMoved(update: Update): void {
	const movedTo = update.message?.migrate_to_chat_id;
	if (movedTo === undefined) return;
	console.error(`The group became a supergroup with id ${movedTo}: set ALLOWED_CHAT_ID to it`);
}

function answer(status: number): Response {
	return new Response(null, { status });
}
