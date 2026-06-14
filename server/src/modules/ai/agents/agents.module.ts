import { Module } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { DehumanizeService } from './dehumanize.service';
import { AgentsController } from './agents.controller';
import { ModelRouterService } from '../model-router.service';

@Module({
  controllers: [AgentsController],
  providers: [OrchestratorService, DehumanizeService, ModelRouterService],
  exports: [OrchestratorService, DehumanizeService],
})
export class AgentsModule {}
