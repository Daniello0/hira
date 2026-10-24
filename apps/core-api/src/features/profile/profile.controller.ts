import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { EmploymentType, SeniorityLevel, SkillLevel, WorkFormat } from '@hira/contracts';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import {
  CURRENCY_PATTERN,
  PROFILE_HEADLINE_MAX,
  PROFILE_LOCATIONS_MAX,
  PROFILE_ROLES_MAX,
  PROFILE_ROLE_MAX_CHARS,
  PROFILE_SALARY_MAX,
  PROFILE_TEXT_MAX,
  SKILL_YEARS_MAX,
} from './profile.constants';
import type { Request } from 'express';
import { validatedBody } from '../auth/validation-exception';
import { OptionalAccessGuard } from '../auth/optional-access.guard';
import { mapAccountError } from '../auth/account-http';
import { requireUserId } from '../auth/require-user-id';
import { actorHint } from '../chat/actor-hint';
import { ChatService } from '../chat/chat.service';
import { ProfileService, SkillMissingError } from './profile.service';

const upperCase = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

class ProfileBody {
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: PROFILE_HEADLINE_MAX })
  @IsOptional() @IsString() @MaxLength(PROFILE_HEADLINE_MAX) headline?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: PROFILE_TEXT_MAX })
  @IsOptional() @IsString() @MaxLength(PROFILE_TEXT_MAX) about?: string | null;

  @ApiPropertyOptional({ enum: SeniorityLevel, nullable: true })
  @IsOptional() @IsEnum(SeniorityLevel) seniority?: SeniorityLevel | null;

  @ApiPropertyOptional({ type: [String], maxItems: PROFILE_ROLES_MAX })
  @IsOptional() @IsArray() @ArrayMaxSize(PROFILE_ROLES_MAX) @IsString({ each: true }) @MaxLength(PROFILE_ROLE_MAX_CHARS, { each: true })
  desiredRoles?: string[];

  @ApiPropertyOptional({ enum: WorkFormat, isArray: true })
  @IsOptional() @IsArray() @IsEnum(WorkFormat, { each: true }) preferredWorkFormat?: WorkFormat[];

  @ApiPropertyOptional({ enum: EmploymentType, isArray: true })
  @IsOptional() @IsArray() @IsEnum(EmploymentType, { each: true }) preferredEmployment?: EmploymentType[];

  @ApiPropertyOptional({ type: [Number], description: 'Ids from GET /locations', maxItems: PROFILE_LOCATIONS_MAX })
  @IsOptional() @IsArray() @ArrayMaxSize(PROFILE_LOCATIONS_MAX) @IsInt({ each: true }) @Min(1, { each: true })
  preferredLocations?: number[];

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 0 })
  @IsOptional() @IsNumber() @Min(0) @Max(PROFILE_SALARY_MAX) salaryExpectationMin?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'BYN', description: 'ISO 4217, three letters' })
  @Transform(upperCase)
  @IsOptional() @IsString() @Matches(CURRENCY_PATTERN) currency?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: PROFILE_TEXT_MAX })
  @IsOptional() @IsString() @MaxLength(PROFILE_TEXT_MAX) education?: string | null;
}

class SkillBody {
  @ApiProperty({ type: Number })
  @IsInt() skillId!: number;

  @ApiProperty({ enum: SkillLevel })
  @IsEnum(SkillLevel) level!: SkillLevel;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 0, maximum: SKILL_YEARS_MAX })
  @IsOptional() @IsInt() @Min(0) @Max(SKILL_YEARS_MAX) years?: number | null;
}

/** Profile, skills, and suggestions. Nothing is written from a chat until accept. */
@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(OptionalAccessGuard)
@Controller()
export class ProfileController {
  constructor(
    @Inject(ChatService) private readonly chats: ChatService,
    @Inject(ProfileService) private readonly profiles: ProfileService,
  ) {}

  /** Reads the seeker profile. */
  @Get('profile')
  @ApiOperation({ summary: 'Get profile' })
  get(@Req() request: Request) {
    return this.call(request, (userId) => this.profiles.get(userId));
  }

  /** Updates the fields that were sent. */
  @Put('profile')
  @ApiOperation({ summary: 'Update profile' })
  save(@Body(validatedBody(ProfileBody)) body: ProfileBody, @Req() request: Request) {
    return this.call(request, (userId) => this.profiles.save(userId, body));
  }

  /** Lists profile skills. */
  @Get('profile/skills')
  @ApiOperation({ summary: 'List profile skills' })
  skills(@Req() request: Request) {
    return this.call(request, (userId) => this.profiles.skills(userId));
  }

  /** Adds a self-reported skill. */
  @Post('profile/skills')
  @ApiOperation({ summary: 'Add profile skill' })
  addSkill(@Body(validatedBody(SkillBody)) body: SkillBody, @Req() request: Request) {
    return this.call(request, (userId) => this.profiles.addSkill(userId, body.skillId, body.level, body.years ?? null));
  }

  /** Removes a profile skill. */
  @Delete('profile/skills/:skillId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove profile skill' })
  removeSkill(@Param('skillId', ParseIntPipe) skillId: number, @Req() request: Request) {
    return this.call(request, async (userId) => {
      if (!(await this.profiles.removeSkill(userId, skillId))) throw new SkillMissingError();
    });
  }

  /** Pending suggestions from chats and resumes. */
  @Get('profile/suggestions')
  @ApiOperation({ summary: 'List profile suggestions' })
  suggestions(@Req() request: Request) {
    return this.call(request, (userId) => this.profiles.pending(userId));
  }

  /** Accepts a suggestion into the profile. */
  @Post('profile/suggestions/:id/accept')
  @ApiOperation({ summary: 'Accept suggestion' })
  accept(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.call(request, (userId) => this.profiles.accept(userId, id));
  }

  /** Dismisses a suggestion. */
  @Post('profile/suggestions/:id/dismiss')
  @ApiOperation({ summary: 'Dismiss suggestion' })
  dismiss(@Param('id', ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.call(request, (userId) => this.profiles.dismiss(userId, id));
  }

  private async call<T>(request: Request, run: (userId: string) => Promise<T>): Promise<T> {
    try {
      return await run(requireUserId(this.chats.caller(actorHint(request))));
    } catch (error) {
      const http = mapAccountError(error, request);
      if (http !== null) throw http;
      throw error;
    }
  }
}
