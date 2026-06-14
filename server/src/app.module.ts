// NestJS 根模块
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ProjectModule } from './modules/project/project.module';
import { AiModule } from './modules/ai/ai.module';
import { ExportModule } from './modules/export/export.module';
import { CacheModule } from './modules/cache/cache.module';
import { OutlineModule } from './modules/outline/outline.module';
import { CharacterModule } from './modules/character/character.module';
import { WorldbuildingModule } from './modules/worldbuilding/worldbuilding.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { TokenModule } from './modules/token/token.module';
import { VersionModule } from './modules/version/version.module';
import { MemoryModule } from './modules/memory/memory.module';
import { SyncModule } from './modules/sync/sync.module';
import { databaseConfig } from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '.env.local'] }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({ useFactory: () => databaseConfig() }),
    CacheModule,
    HealthModule,
    AuthModule,
    UserModule,
    ProjectModule,
    OutlineModule,
    CharacterModule,
    WorldbuildingModule,
    SubscriptionModule,
    TokenModule,
    VersionModule,
    MemoryModule,
    SyncModule,
    AiModule,
    ExportModule,
  ],
})
export class AppModule {}
