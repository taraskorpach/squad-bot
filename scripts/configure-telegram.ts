// The setup script's shell: arguments, the env file, Telegram calls and printing. Its decisions
// live in telegram-setup.ts, which the tests cover. Node runs this file with type stripping, so
// every relative import keeps its extension.
import { readFileSync } from 'node:fs';
import { parseArgs, parseEnv } from 'node:util';
import { Api } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import { API_TIMEOUT_SECONDS, isAdmin } from '../src/telegram.ts';
import { welcomeMessage } from '../src/welcome.ts';
import {
	COMMAND_MENU,
	deliveryError,
	type FoundGroup,
	groupsIn,
	probeProblem,
	probeRequest,
	webhookSettings,
} from './telegram-setup.ts';

const USAGE = `Usage: node scripts/configure-telegram.ts [--env <file>] <command>

  discover              print BOT_INFO and the groups in the bot's pending updates
  webhook <worker-url>  check the Worker, point Telegram at it, set the command menu
  welcome               post the welcome with its 👋 button to ALLOWED_CHAT_ID

--env is the file with the bot's settings: .dev.vars (the default) or .prod.vars.`;

interface Setup {
	api: Api;
	/** The bot whose token the env file holds. */
	me: UserFromGetMe;
	/** A setting from the env file; each command reads only the ones it needs. */
	setting: (key: string) => string;
	args: string[];
}

const SUBCOMMANDS = new Map<string, (setup: Setup) => Promise<void>>([
	['discover', discover],
	['webhook', webhook],
	['welcome', welcome],
]);

try {
	await main();
} catch (error) {
	console.error(`\n${messagesOf(error)}`);
	process.exitCode = 1;
}

async function main(): Promise<void> {
	const { values, positionals } = parseArgs({
		options: {
			env: { type: 'string', default: '.dev.vars' },
			help: { type: 'boolean', short: 'h' },
		},
		allowPositionals: true,
	});
	const [name, ...args] = positionals;
	const command = name === undefined ? undefined : SUBCOMMANDS.get(name);
	if (values.help || command === undefined) {
		console.log(USAGE);
		if (!values.help) process.exitCode = 1;
		return;
	}
	const setting = settingsFrom(values.env);
	const api = new Api(setting('BOT_TOKEN'), { timeoutSeconds: API_TIMEOUT_SECONDS });
	const me = await api.getMe();
	// First, so it's clear which bot and env file a run targets.
	console.log(`Bot: @${me.username} (${values.env})`);
	await command({ api, me, setting, args });
}

async function discover({ api, me }: Setup): Promise<void> {
	console.log(`BOT_INFO=${JSON.stringify(me)}`);
	const { url } = await api.getWebhookInfo();
	if (url) {
		throw new Error(`A webhook is set (${url}), and getUpdates can't run while one is`);
	}
	// No offset: an offset confirms, and so deletes, every update before it.
	const updates = await api.getUpdates();
	const groups = groupsIn(updates);
	console.log(`\nGroups in the ${updates.length} oldest pending updates:`);
	if (groups.length === 0) {
		console.log('  none: post a message in the group, then run discover again');
	}
	for (const group of groups) console.log(`  ${describeGroup(group)}`);
}

function describeGroup({ id, title, type, upgradedTo }: FoundGroup): string {
	if (upgradedTo !== undefined) return `${id}  ${title}  basic group, upgraded to ${upgradedTo}`;
	if (type === 'group') {
		return `${id}  ${title}  basic group: upgrade it to a supergroup, then run discover again`;
	}
	return `${id}  ${title}  supergroup: the id for ALLOWED_CHAT_ID`;
}

async function webhook({ api, setting, args: [workerUrl] }: Setup): Promise<void> {
	if (workerUrl === undefined) throw new Error(`webhook needs the Worker's URL\n\n${USAGE}`);
	const secret = setting('WEBHOOK_SECRET');
	const settings = webhookSettings(workerUrl, secret);
	await probe(settings.url, secret);
	await api.raw.setWebhook(settings);
	await api.raw.setMyCommands(COMMAND_MENU);
	const problem = deliveryError(await api.getWebhookInfo());
	if (problem) throw new Error(problem);
	console.log(`Webhook: ${settings.url}, pending updates dropped`);
	console.log(`Menu: ${COMMAND_MENU.commands.map(({ command }) => `/${command}`).join(' ')}`);
}

/** Sends Telegram's request before Telegram does, since its own report comes only after one. */
async function probe(url: string, secret: string): Promise<void> {
	const response = await fetch(url, probeRequest(secret)).catch((error: unknown) => {
		throw new Error(`Can't reach ${url}`, { cause: error });
	});
	const problem = probeProblem(response.status);
	if (problem) throw new Error(`${problem}. The webhook wasn't changed.`);
	console.log(`Probe: ${url} answered 200`);
}

async function welcome({ api, me, setting }: Setup): Promise<void> {
	const chatId = setting('ALLOWED_CHAT_ID');
	const info = await api.getWebhookInfo();
	if (!info.url) throw new Error('No webhook is set, so nobody would hear 👋: run webhook first');
	const problem = deliveryError(info);
	if (problem) throw new Error(`${problem}. Fix it, run webhook again, then welcome.`);
	const admin = isAdmin(await api.getChatMember(chatId, me.id));
	const { text, options } = welcomeMessage({ isAdmin: admin });
	const { chat } = await api.sendMessage(chatId, text, options);
	const asks = admin ? '' : ', asking to be made an admin';
	console.log(`Welcome posted to ${chat.title ?? chat.id} (${chat.id})${asks}`);
}

function settingsFrom(file: string): (key: string) => string {
	const settings = readEnvFile(file);
	return (key) => {
		const value = settings[key];
		if (!value) throw new Error(`${key} is missing from ${file}`);
		return value;
	};
}

function readEnvFile(file: string): NodeJS.Dict<string> {
	try {
		return parseEnv(readFileSync(file, 'utf8'));
	} catch (error) {
		throw new Error(`Can't read ${file}: copy .dev.vars.example to it and fill it in`, {
			cause: error,
		});
	}
}

// Only messages: grammY keeps the token out of its own, but an HttpError's inner error can
// carry the request URL, and the URL holds the token.
function messagesOf(error: unknown): string {
	if (!(error instanceof Error)) return String(error);
	return error.cause === undefined ? error.message : `${error.message}: ${messagesOf(error.cause)}`;
}
