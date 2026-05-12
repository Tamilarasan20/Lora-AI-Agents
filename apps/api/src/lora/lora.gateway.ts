import { Injectable, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';

// Use 'any' to avoid direct socket.io peer dependency (resolved via pnpm workspace)
type WsServer = any;
type WsClient = any;

export const LORA_EVENTS = {
  // Outbound — server → client
  STRATEGY_CREATED: 'lora.strategy.created',
  STRATEGY_UPDATED: 'lora.strategy.updated',
  AGENT_TASK_STARTED: 'agent.task.started',
  AGENT_TASK_COMPLETED: 'agent.task.completed',
  AGENT_TASK_FAILED: 'agent.task.failed',
  OUTPUT_REVIEWED: 'lora.output.reviewed',
  APPROVAL_PENDING: 'approval.pending',
  APPROVAL_APPROVED: 'approval.approved',
  APPROVAL_REJECTED: 'approval.rejected',
  CALENDAR_UPDATED: 'lora.calendar.updated',
  CREATIVE_ASSET_READY: 'steve.asset.ready',
  // Inbound — client → server
  JOIN_STRATEGY: 'join.strategy',
  LEAVE_STRATEGY: 'leave.strategy',
} as const;

@Injectable()
@WebSocketGateway({ namespace: '/lora', cors: { origin: '*' } })
export class LoraGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LoraGateway.name);

  @WebSocketServer()
  server: WsServer;

  handleConnection(client: WsClient) {
    this.logger.log(`Lora client connected: ${client.id}`);
  }

  handleDisconnect(client: WsClient) {
    this.logger.log(`Lora client disconnected: ${client.id}`);
  }

  @SubscribeMessage(LORA_EVENTS.JOIN_STRATEGY)
  handleJoinStrategy(
    @MessageBody() data: { strategyId: string },
    @ConnectedSocket() client: WsClient,
  ) {
    client.join(`strategy:${data.strategyId}`);
    return { joined: data.strategyId };
  }

  @SubscribeMessage(LORA_EVENTS.LEAVE_STRATEGY)
  handleLeaveStrategy(
    @MessageBody() data: { strategyId: string },
    @ConnectedSocket() client: WsClient,
  ) {
    client.leave(`strategy:${data.strategyId}`);
    return { left: data.strategyId };
  }

  // ─── Emit helpers called by LoraOrchestrator ─────────────────────────────────

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitStrategyCreated(userId: string, strategy: unknown) {
    this.emitToUser(userId, LORA_EVENTS.STRATEGY_CREATED, strategy);
  }

  emitAgentTaskStarted(userId: string, task: unknown) {
    this.emitToUser(userId, LORA_EVENTS.AGENT_TASK_STARTED, task);
  }

  emitAgentTaskCompleted(userId: string, task: unknown) {
    this.emitToUser(userId, LORA_EVENTS.AGENT_TASK_COMPLETED, task);
  }

  emitAgentTaskFailed(userId: string, task: unknown) {
    this.emitToUser(userId, LORA_EVENTS.AGENT_TASK_FAILED, task);
  }

  emitOutputReviewed(userId: string, output: unknown) {
    this.emitToUser(userId, LORA_EVENTS.OUTPUT_REVIEWED, output);
  }

  emitApprovalPending(userId: string, approval: unknown) {
    this.emitToUser(userId, LORA_EVENTS.APPROVAL_PENDING, approval);
  }

  emitApprovalResult(userId: string, approved: boolean, approval: unknown) {
    const event = approved ? LORA_EVENTS.APPROVAL_APPROVED : LORA_EVENTS.APPROVAL_REJECTED;
    this.emitToUser(userId, event, approval);
  }

  emitCreativeAssetReady(userId: string, asset: unknown) {
    this.emitToUser(userId, LORA_EVENTS.CREATIVE_ASSET_READY, asset);
  }

  emitCalendarUpdated(userId: string, items: unknown) {
    this.emitToUser(userId, LORA_EVENTS.CALENDAR_UPDATED, items);
  }
}
