// WebSocket 同步网关 — 多端实时推送
import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect,
  ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

/** 服务端→客户端事件 */
export enum WsServerEvent {
  CHAPTER_UPDATED = 'chapter:updated',
  CHAPTER_CREATED = 'chapter:created',
  CHAPTER_DELETED = 'chapter:deleted',
  OUTLINE_UPDATED = 'outline:updated',
  CHARACTER_UPDATED = 'character:updated',
  WORLD_SETTING_UPDATED = 'world_setting:updated',
  MEMORY_EXTRACTED = 'memory:extracted',
  CONFLICT_DETECTED = 'conflict:detected',
  QUOTA_WARNING = 'quota:warning',
  QUOTA_EXHAUSTED = 'quota:exhausted',
  SYNC_COMPLETED = 'sync:completed',
}

/** 客户端→服务端事件 */
enum WsClientEvent {
  SUBSCRIBE_BOOK = 'book:subscribe',
  UNSUBSCRIBE_BOOK = 'book:unsubscribe',
  PING = 'ping',
}

@WebSocketGateway({
  namespace: '/sync',
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class SyncGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SyncGateway.name);

  /** 书籍订阅映射: bookId → Set<socketId> */
  private subscriptions = new Map<string, Set<string>>();

  /** socketId → userId 映射 */
  private socketUsers = new Map<string, string>();

  handleConnection(client: Socket) {
    this.logger.log(`客户端连接: ${client.id}`);
    client.emit('connected', { socketId: client.id });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`客户端断开: ${client.id}`);
    // 清理订阅
    for (const [bookId, sockets] of this.subscriptions) {
      sockets.delete(client.id);
      if (sockets.size === 0) this.subscriptions.delete(bookId);
    }
    this.socketUsers.delete(client.id);
  }

  /** 订阅书籍更新 */
  @SubscribeMessage(WsClientEvent.SUBSCRIBE_BOOK)
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { bookId: string; userId: string },
  ) {
    const { bookId, userId } = data;
    if (!this.subscriptions.has(bookId)) {
      this.subscriptions.set(bookId, new Set());
    }
    this.subscriptions.get(bookId)!.add(client.id);
    this.socketUsers.set(client.id, userId);
    this.logger.log(`用户 ${userId} 订阅了作品 ${bookId.substring(0, 8)}`);
    return { subscribed: true, bookId };
  }

  /** 取消订阅 */
  @SubscribeMessage(WsClientEvent.UNSUBSCRIBE_BOOK)
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { bookId: string },
  ) {
    const sockets = this.subscriptions.get(data.bookId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) this.subscriptions.delete(data.bookId);
    }
    return { unsubscribed: true };
  }

  /** 心跳 */
  @SubscribeMessage(WsClientEvent.PING)
  handlePing() {
    return { event: 'pong', timestamp: Date.now() };
  }

  // ====== 推送方法（由其他服务调用） ======

  /** 推送章节更新 */
  notifyChapterUpdated(bookId: string, chapterId: string, data: any) {
    this.broadcast(bookId, WsServerEvent.CHAPTER_UPDATED, {
      chapterId, timestamp: new Date().toISOString(), data,
    });
  }

  /** 推送章节创建 */
  notifyChapterCreated(bookId: string, chapter: any) {
    this.broadcast(bookId, WsServerEvent.CHAPTER_CREATED, {
      chapter, timestamp: new Date().toISOString(),
    });
  }

  /** 推送记忆提取完成 */
  notifyMemoryExtracted(bookId: string, chapterId: string, result: any) {
    this.broadcast(bookId, WsServerEvent.MEMORY_EXTRACTED, {
      chapterId, result, timestamp: new Date().toISOString(),
    });
  }

  /** 推送冲突检测 */
  notifyConflict(bookId: string, conflict: any) {
    this.broadcast(bookId, WsServerEvent.CONFLICT_DETECTED, {
      conflict, timestamp: new Date().toISOString(),
    });
  }

  /** 推送额度告警 */
  notifyQuotaWarning(userId: string, data: any) {
    const sockets = this.subscriptions;
    for (const [, sockSet] of sockets) {
      for (const sockId of sockSet) {
        if (this.socketUsers.get(sockId) === userId) {
          this.server.to(sockId).emit(WsServerEvent.QUOTA_WARNING, data);
        }
      }
    }
  }

  /** 向订阅了某书籍的所有客户端广播 */
  private broadcast(bookId: string, event: WsServerEvent, data: any) {
    const sockets = this.subscriptions.get(bookId);
    if (sockets) {
      for (const sockId of sockets) {
        this.server.to(sockId).emit(event, data);
      }
    }
  }
}
