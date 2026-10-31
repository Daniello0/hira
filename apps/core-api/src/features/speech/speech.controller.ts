import { VoiceLanguage, asVoiceLanguage, type TranscriptDto } from '@hira/contracts';
import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { VALIDATION_ERROR_CODE } from '../../common/constants/app.constants';
import { ApiHttpException } from '../../common/filters/api-http.exception';
import { mapAccountError } from '../auth/account-http';
import { apiError } from '../auth/auth-http';
import { OptionalAccessGuard } from '../auth/optional-access.guard';
import { requireUserId } from '../auth/require-user-id';
import { validatedBody } from '../auth/validation-exception';
import { PlanGate } from '../billing/plan-gate';
import { actorHint } from '../chat/actor-hint';
import { ChatService } from '../chat/chat.service';
import { SpeechUnavailableError, type SpeechGateway } from './speech-gateway';
import { AUDIO_MAX_BYTES, SPEECH_GATEWAY, SPEECH_TEXT_MAX_CHARS, SPEECH_UNAVAILABLE } from './speech.constants';

class SynthesizeBody {
  @ApiProperty({ type: String, maxLength: SPEECH_TEXT_MAX_CHARS })
  @IsString()
  @MinLength(1)
  @MaxLength(SPEECH_TEXT_MAX_CHARS)
  text!: string;

  @ApiProperty({ enum: VoiceLanguage })
  @IsEnum(VoiceLanguage)
  language!: VoiceLanguage;
}

/** Hearing and speaking on a call. Same plan rule as the call itself. */
@ApiTags('speech')
@ApiBearerAuth()
@UseGuards(OptionalAccessGuard)
@Controller('speech')
export class SpeechController {
  constructor(
    @Inject(ChatService) private readonly chats: ChatService,
    @Inject(PlanGate) private readonly plans: PlanGate,
    @Inject(SPEECH_GATEWAY) private readonly speech: SpeechGateway,
  ) {}

  /** A spoken phrase as text, with the language heard. `language` pins it when the user chose one. */
  @Post('transcribe')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: AUDIO_MAX_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Transcribe a phrase' })
  transcribe(
    @UploadedFile() audio: { buffer: Buffer } | undefined,
    @Body('language') language: string | undefined,
    @Req() request: Request,
  ): Promise<TranscriptDto> {
    return this.call(request, () => {
      if (audio === undefined) throw apiError(HttpStatus.BAD_REQUEST, VALIDATION_ERROR_CODE, 'audio is required', request);
      return this.speech.transcribe(audio.buffer, asVoiceLanguage(language));
    });
  }

  /** Hira's voice saying a text, as WAV. */
  @Post('synthesize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Speak a text' })
  async synthesize(@Body(validatedBody(SynthesizeBody)) body: SynthesizeBody, @Req() request: Request, @Res() response: Response): Promise<void> {
    const audio = await this.call(request, () => this.speech.synthesize(body.text, body.language));
    response.setHeader('Content-Type', 'audio/wav');
    response.send(audio);
  }

  private async call<T>(request: Request, run: () => Promise<T>): Promise<T> {
    try {
      const userId = requireUserId(this.chats.caller(actorHint(request)));
      await this.plans.requireFeature(userId, 'call');
      return await run();
    } catch (error) {
      if (error instanceof SpeechUnavailableError) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, SPEECH_UNAVAILABLE, error.message, request);
      if (error instanceof ApiHttpException) throw error;
      const http = mapAccountError(error, request);
      if (http !== null) throw http;
      throw error;
    }
  }
}
