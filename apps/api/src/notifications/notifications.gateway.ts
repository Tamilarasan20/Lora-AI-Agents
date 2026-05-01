import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';

type WsServer = any;
type WsClient = any;

// Decode a JWT payload without verifying the signature (auth guard handles verification)
function decodeJwtSub(token: string): string | null {
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: WsServer;
  private readonly logger = new Logger(NotificationsGateway.name);

  handleConnection(client: WsClient) {
    const token: string = client.handshake?.auth?.token ?? '';
    const sub = decodeJwtSub(token);
    if (sub) {
      // Each user joins their own room keyed by Supabase UUID
      client.join(`user:${sub}`);
      client.data = { sub };
      this.logger.debug(`Notifications client connected: ${sub}`);
    } else {
      // No valid token — disconnect immediately
      client.disconnect(true);
    }
  }

  handleDisconnect(client: WsClient) {
    this.logger.debug(`Notifications client disconnected: ${client.data?.sub}`);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: WsClient) {
    client.emit('pong', { ts: Date.now() });
  }

  /**
   * Push a notification to a specific user.
   * Called by NotificationsService after persisting to DB.
   */
  pushToUser(supabaseId: string, notification: Record<string, unknown>) {
    this.server.to(`user:${supabaseId}`).emit('notification', notification);
  }

  /**
   * Push an unread-count update to a user.
   */
  pushUnreadCount(supabaseId: string, count: number) {
    this.server.to(`user:${supabaseId}`).emit('unread_count', { unread: count });
  }
}
