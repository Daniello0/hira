import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmploymentType, SeniorityLevel, SkillLevel, WorkFormat } from '@hira/contracts';
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { validatedBody } from '../auth/validation-exception';
import { OptionalAccessGuard } from '../auth/optional-access.guard';
import { mapAccountError } from '../auth/account-http';
import { requireUserId } from '../auth/require-user-id';
import { actorHint } from '../chat/actor-hint';
import { ChatService } from '../chat/chat.service';
import { ProfileService, SkillMissingError } from './profile.service';

class ProfileBody {
  @IsOptional() @IsString() @MaxLength(256) headline?: string | null;
  @IsOptional() @IsString() about?: string | null;
  @IsOptional() @IsEnum(SeniorityLevel) seniority?: SeniorityLevel | null;
  @IsOptional() @IsArray() desiredRoles?: string[];
  @IsOptional() @IsArray() @IsEnum(WorkFormat, { each: true }) preferredWorkFormat?: WorkFormat[];
  @IsOptional() @IsArray() @IsEnum(EmploymentType, { each: true }) preferredEmployment?: EmploymentType[];
  @IsOptional() @IsArray() preferredLocations?: number[];
  @IsOptional() @IsNumber() salaryExpectationMin?: number | null;
  @IsOptional() @IsString() @MaxLength(3) currency?: string | null;
  @IsOptional() @IsString() education?: string | null;
}

class SkillBody {
  @IsInt() skillId!: number;
  @IsEnum(SkillLevel) level!: SkillLevel;
  @IsOptional() @IsInt() years?: number | null;
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
