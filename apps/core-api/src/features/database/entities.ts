import { CallSession } from '../call/call-session.entity';
import { CallTurn } from '../call/call-turn.entity';
import { Chat } from '../chat/chat.entity';
import { Message } from '../chat/message.entity';
import { MessageVacancy } from '../chat/message-vacancy.entity';
import { Company } from '../company/company.entity';
import { Favorite } from '../favorite/favorite.entity';
import { Collection } from '../favorite/collection.entity';
import { Feedback } from '../feedback/feedback.entity';
import { Industry } from '../industry/industry.entity';
import { IngestionRun } from '../ingestion/ingestion-run.entity';
import { Location } from '../location/location.entity';
import { Occupation } from '../occupation/occupation.entity';
import { OccupationSkill } from '../occupation/occupation-skill.entity';
import { OccupationTransition } from '../occupation/occupation-transition.entity';
import { SearchLog } from '../search-log/search-log.entity';
import { Skill } from '../skill/skill.entity';
import { SkillAlias } from '../skill/skill-alias.entity';
import { SkillEdge } from '../skill/skill-edge.entity';
import { VacancySkill } from '../skill/vacancy-skill.entity';
import { RefreshToken } from '../user/refresh-token.entity';
import { User } from '../user/user.entity';
import { UserDocument } from '../user/user-document.entity';
import { UserMemory } from '../user/user-memory.entity';
import { UserProfile } from '../user/user-profile.entity';
import { UserProfileSkill } from '../user/user-profile-skill.entity';
import { Vacancy } from '../vacancy/vacancy.entity';
import { VacancyChunk } from '../vacancy/vacancy-chunk.entity';
import { VacancyDuplicate } from '../vacancy/vacancy-duplicate.entity';

/** Every mapped table. Migrations, not synchronize, create them. */
export const ENTITIES = [
  Industry,
  Location,
  User,
  RefreshToken,
  Company,
  Vacancy,
  VacancyChunk,
  VacancyDuplicate,
  Skill,
  SkillAlias,
  SkillEdge,
  VacancySkill,
  Occupation,
  OccupationSkill,
  OccupationTransition,
  UserProfile,
  UserProfileSkill,
  Chat,
  Message,
  UserMemory,
  UserDocument,
  MessageVacancy,
  CallSession,
  CallTurn,
  Collection,
  Favorite,
  SearchLog,
  IngestionRun,
  Feedback,
];
