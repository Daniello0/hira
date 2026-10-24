import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { SearchOrchestratorModule } from '../search-orchestrator/search-orchestrator.module';
import { VacancyController } from './vacancy.controller';
import { VacancyService } from './vacancy.service';

/** Vacancy card routes. Similar vacancies and the skill gap come from retrieval-service. */
@Module({
  imports: [AuthModule, ChatModule, SearchOrchestratorModule],
  controllers: [VacancyController],
  providers: [VacancyService],
})
export class VacancyModule {}
