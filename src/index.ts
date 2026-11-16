export { ChatRoom } from './chat/chat-room';

export default {
	async fetch(): Promise<Response> {
		return new Response(null, { status: 404 });
	},
} satisfies ExportedHandler<Env>;
