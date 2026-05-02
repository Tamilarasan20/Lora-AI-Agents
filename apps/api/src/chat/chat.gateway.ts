import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ChatService, AgentType } from './chat.service';

// Use any so we don't need a direct socket.io peer dependency
type WsClient = any;
type WsServer = any;

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: WsServer;
  private readonly logger = new Logger(ChatGateway.name);
  private readonly clientUserMap = new Map<string, string>();

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: WsClient) {
    const token = client.handshake?.auth?.token as string | undefined;
    if (token) {
      try {
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64').toString('utf8'),
        );
        const userId = payload.sub ?? payload.userId;
        if (userId) this.clientUserMap.set(client.id, userId);
      } catch (_e) {
        // unauthenticated connection — allowed, limits applied per message if needed
      }
    }
    this.logger.debug(`Chat client connected: ${client.id}`);
  }

  handleDisconnect(client: WsClient) {
    this.clientUserMap.delete(client.id);
    this.logger.debug(`Chat client disconnected: ${client.id}`);
  }

  @SubscribeMessage('chat:message')
  async handleMessage(
    @ConnectedSocket() client: WsClient,
    @MessageBody()
    payload: { sessionId: string; message: string; agent?: AgentType },
  ) {
    const { sessionId, message, agent = 'lora' } = payload ?? {};

    if (!message?.trim()) {
      client.emit('chat:error', { sessionId, message: 'Empty message' });
      return;
    }

    for await (const event of this.chatService.streamMessage(sessionId, message, agent)) {
      switch (event.type) {
        case 'chunk':
          client.emit('chat:chunk', { sessionId, text: event.text });
          break;
        case 'done':
          client.emit('chat:done', { sessionId, tokensUsed: event.tokensUsed });
          break;
        case 'error':
          client.emit('chat:error', { sessionId, message: event.message });
          break;
      }
    }
  }

  @SubscribeMessage('chat:clear')
  handleClear(
    @ConnectedSocket() client: WsClient,
    @MessageBody() payload: { sessionId: string },
  ) {
    this.chatService.clearSession(payload.sessionId);
    client.emit('chat:cleared', { sessionId: payload.sessionId });
  }

  @SubscribeMessage('chat:history')
  handleHistory(
    @ConnectedSocket() client: WsClient,
    @MessageBody() payload: { sessionId: string },
  ) {
    const history = this.chatService.getHistory(payload.sessionId);
    client.emit('chat:history', { sessionId: payload.sessionId, history });
  }
}
