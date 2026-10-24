import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { SkillController } from './skill.controller';
import { SKILL_CATALOG } from './skill.store';
import { TypeOrmSkillCatalog } from './typeorm-skill.store';

/** Read-only skill search for the profile editor. */
@Module({
  imports: [AuthModule, ChatModule],
  controllers: [SkillController],
  providers: [TypeOrmSkillCatalog, { provide: SKILL_CATALOG, useExisting: TypeOrmSkillCatalog }],
  exports: [SKILL_CATALOG],
})
export class SkillModule {}
