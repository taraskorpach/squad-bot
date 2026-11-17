import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const TEST_BOT_INFO = {
	id: 7000000001,
	is_bot: true,
	first_name: 'Squad Test',
	username: 'squad_test_bot',
	can_join_groups: true,
	can_read_all_group_messages: false,
	supports_inline_queries: false,
	can_connect_to_business: false,
	has_main_web_app: false,
	has_topics_enabled: false,
	allows_users_to_create_topics: false,
	can_manage_bots: false,
	supports_join_request_queries: false,
};

// Fake secrets: a Telegram call nobody faked fails instead of reaching a real chat.
export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: './wrangler.jsonc' },
			miniflare: {
				bindings: {
					BOT_TOKEN: '7000000001:TEST-token',
					WEBHOOK_SECRET: 'test-webhook-secret-0123456789abcdef',
					ALLOWED_CHAT_ID: '-1001234567890',
					BOT_INFO: JSON.stringify(TEST_BOT_INFO),
				},
			},
		}),
	],
	test: {
		setupFiles: ['./test/setup.ts'],
	},
});
