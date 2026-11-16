import { DurableObject } from 'cloudflare:workers';

export class ChatRoom extends DurableObject<Env> {}
