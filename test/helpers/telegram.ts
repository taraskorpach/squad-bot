import { env } from 'cloudflare:workers';
import { setupNetwork } from '@msw/cloudflare';
import type { Message, UserFromGetMe } from 'grammy/types';
import { HttpResponse, http } from 'msw';

export interface TelegramCall {
	method: string;
	payload: Record<string, unknown>;
}

export type TelegramFailure =
	| { status: 429; retryAfter: number }
	| { status: 500 }
	| { status: 400; description?: string }
	/** The connection drops: grammY throws an HttpError, not a GrammyError. */
	| { status: 'network' };

const METHOD_URL = 'https://api.telegram.org/bot:token/:method';

const recorded: TelegramCall[] = [];
let lastMessageId = 0;

export const network = setupNetwork();

/** Answers every Bot API method with success; `sendMessage` gets a message with a new id. */
export const telegramApi = http.post(METHOD_URL, async ({ request, params }) => {
	const call = await record(request, String(params.method));
	return HttpResponse.json({ ok: true, result: resultOf(call) });
});

export const telegram = {
	calls(): readonly TelegramCall[] {
		return recorded;
	},

	callsTo(method: string): Record<string, unknown>[] {
		return recorded.filter((call) => call.method === method).map((call) => call.payload);
	},

	/** The next `times` calls to `method` fail as Telegram would answer them. */
	fail(method: string, failure: TelegramFailure, times = 1): void {
		for (let i = 0; i < times; i++) {
			network.use(
				http.post(
					`https://api.telegram.org/bot:token/${method}`,
					async ({ request }) => {
						await record(request, method);
						return failureResponse(failure);
					},
					{ once: true },
				),
			);
		}
	},

	/** Forgets the recorded calls; message ids keep increasing for the whole test file. */
	reset(): void {
		recorded.length = 0;
	},
};

async function record(request: { text(): Promise<string> }, method: string): Promise<TelegramCall> {
	const body = await request.text();
	const call = { method, payload: body === '' ? {} : JSON.parse(body) };
	recorded.push(call);
	return call;
}

function resultOf({ method, payload }: TelegramCall): Message | true {
	if (method !== 'sendMessage') return true;
	const bot: UserFromGetMe = JSON.parse(env.BOT_INFO);
	return {
		message_id: ++lastMessageId,
		date: Math.floor(Date.now() / 1000),
		chat: { id: Number(payload.chat_id), type: 'supergroup', title: 'Squad' },
		from: { id: bot.id, is_bot: true, first_name: bot.first_name, username: bot.username },
		text: String(payload.text),
	};
}

function failureResponse(failure: TelegramFailure): Response {
	switch (failure.status) {
		case 'network':
			return HttpResponse.error();
		case 429:
			return HttpResponse.json(
				{
					ok: false,
					error_code: 429,
					description: `Too Many Requests: retry after ${failure.retryAfter}`,
					parameters: { retry_after: failure.retryAfter },
				},
				{ status: 429 },
			);
		case 500:
			return HttpResponse.json(
				{ ok: false, error_code: 500, description: 'Internal Server Error' },
				{ status: 500 },
			);
		case 400:
			return HttpResponse.json(
				{
					ok: false,
					error_code: 400,
					description: `Bad Request: ${failure.description ?? 'message text is empty'}`,
				},
				{ status: 400 },
			);
	}
}
