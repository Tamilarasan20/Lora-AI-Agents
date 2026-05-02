import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BrandService, BrandAnalysisResult } from './brand.service';
import { QueueService } from '../queue/queue.service';
import { QUEUE_NAMES, JOB_NAMES } from '../queue/queue.constants';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { BrandIntelligenceService } from './intelligence/brand-intelligence.service';
import { AgentName } from './intelligence/agent-context.service';
import { ChannelSample } from './intelligence/brand-drift.service';
import { CustomerVoiceInput } from './intelligence/customer-voice.service';
import { Competitor } from './brand.service';

class AnalyzeWebsiteDto {
  @ApiProperty({ example: 'https://stripe.com' }) @IsString() websiteUrl: string;
}

class UpdateDraftDto {
  // Free-form patch — every field on BrandAnalysisResult is optional.
  // We don't strictly validate to keep the review UX flexible.
  [key: string]: unknown;
}

class StringArrayDto {
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) items: string[];
}

class UpdateVoiceDto {
  @ApiPropertyOptional() @IsOptional() @IsString()  tone?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray()   voiceCharacteristics?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString()  brandDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString()  valueProposition?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() autoReplyEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber()  sentimentThreshold?: number;
}

class AddCompetitorDto {
  @ApiProperty() @IsString() platform: string;
  @ApiProperty() @IsString() handle: string;
}

class AnalyzeCompetitorDto {
  @ApiProperty() @IsString() platform: string;
  @ApiProperty() @IsString() handle: string;
  @ApiPropertyOptional() @IsOptional() @IsString() websiteUrl?: string;
}

class IngestCustomerVoiceDto {
  @ApiProperty() @IsString() sourceType: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceUrl?: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) texts: string[];
}

class DriftChannelDto {
  @ApiProperty() @IsString() channel: string;
  @ApiProperty() @IsString() content: string;
  @ApiPropertyOptional() @IsOptional() @IsString() url?: string;
}

class AnalyzeDriftDto {
  @ApiProperty({ type: [DriftChannelDto] }) channels: DriftChannelDto[];
}

class SearchDto {
  @ApiProperty() @IsString() query: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agentContext?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() limit?: number;
}

@ApiTags('Brand')
@ApiBearerAuth()
@Controller('brand')
export class BrandController {
  constructor(
    private readonly brandService: BrandService,
    private readonly intel: BrandIntelligenceService,
    private readonly queue: QueueService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get full brand knowledge profile' })
  get(@CurrentUser() user: AuthUser) {
    return this.brandService.get(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update brand profile fields' })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateBrandDto) {
    return this.brandService.update(user.id, dto);
  }

  @Put()
  @ApiOperation({ summary: 'Replace brand profile fields' })
  replace(@CurrentUser() user: AuthUser, @Body() dto: UpdateBrandDto) {
    return this.brandService.update(user.id, dto);
  }

  @Get('voice')
  @ApiOperation({ summary: 'Get brand voice settings' })
  getVoice(@CurrentUser() user: AuthUser) {
    return this.brandService.getVoice(user.id);
  }

  @Put('voice')
  @ApiOperation({ summary: 'Update brand voice settings' })
  updateVoice(@CurrentUser() user: AuthUser, @Body() dto: UpdateVoiceDto) {
    return this.brandService.updateVoice(user.id, dto);
  }

  @Get('competitors')
  @ApiOperation({ summary: 'List tracked competitors' })
  getCompetitors(@CurrentUser() user: AuthUser) {
    return this.brandService.getCompetitors(user.id);
  }

  @Post('competitors')
  @ApiOperation({ summary: 'Add a competitor to track' })
  addCompetitor(@CurrentUser() user: AuthUser, @Body() dto: AddCompetitorDto) {
    return this.brandService.addCompetitor(user.id, dto.platform, dto.handle);
  }

  @Delete('competitors/:id')
  @ApiOperation({ summary: 'Remove a tracked competitor' })
  removeCompetitor(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.brandService.removeCompetitor(user.id, id);
  }

  @Post('hashtags')
  @ApiOperation({ summary: 'Add hashtags to preferred list' })
  addHashtags(@CurrentUser() user: AuthUser, @Body() dto: StringArrayDto) {
    return this.brandService.addHashtags(user.id, dto.items);
  }

  @Delete('hashtags/:hashtag')
  @ApiOperation({ summary: 'Remove a hashtag from preferred list' })
  removeHashtag(@CurrentUser() user: AuthUser, @Param('hashtag') hashtag: string) {
    return this.brandService.removeHashtag(user.id, hashtag);
  }

  @Post('prohibited-words')
  @ApiOperation({ summary: 'Add words to prohibited list' })
  addProhibited(@CurrentUser() user: AuthUser, @Body() dto: StringArrayDto) {
    return this.brandService.addProhibitedWords(user.id, dto.items);
  }

  // ─── Pomelli-style async analyze flow ────────────────────────────────────
  // 1. POST /brand/analyze-website          → creates job + enqueues BullMQ work, returns { jobId }
  // 2. GET  /brand/analyze-website/jobs/:id → poll for status & progress
  // 3. GET  /brand/analyze-website/jobs/:id/draft → review draft when AWAITING_REVIEW
  // 4. PATCH /brand/analyze-website/jobs/:id/draft → user edits before approve
  // 5. POST /brand/analyze-website/jobs/:id/approve → commit draft to BrandKnowledge
  // 6. POST /brand/analyze-website/jobs/:id/cancel  → abort

  @Post('analyze-website')
  @ApiOperation({ summary: 'Start an async brand-knowledge analysis job (Pomelli-style)' })
  async startAnalyzeWebsite(
    @CurrentUser() user: AuthUser,
    @Body() dto: AnalyzeWebsiteDto,
  ) {
    const job = await this.brandService.createAnalysisJob(user.id, dto.websiteUrl);
    await this.queue.addJob(
      QUEUE_NAMES.BRAND_ANALYZE,
      JOB_NAMES.BRAND_ANALYZE_WEBSITE,
      { jobId: job.id, userId: user.id, websiteUrl: job.websiteUrl },
    );
    return { jobId: job.id, status: job.status, websiteUrl: job.websiteUrl };
  }

  @Get('analyze-website/jobs')
  @ApiOperation({ summary: 'List recent brand analysis jobs' })
  listAnalyzeJobs(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.brandService.listAnalysisJobs(user.id, limit ? parseInt(limit, 10) : 10);
  }

  @Get('analyze-website/jobs/:jobId')
  @ApiOperation({ summary: 'Get brand analysis job status & progress' })
  getAnalyzeJob(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string) {
    return this.brandService.getAnalysisJob(user.id, jobId);
  }

  @Get('analyze-website/jobs/:jobId/draft')
  @ApiOperation({ summary: 'Get the draft brand knowledge for review' })
  async getAnalyzeJobDraft(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string) {
    const job = await this.brandService.getAnalysisJob(user.id, jobId);
    return { status: job.status, draft: job.draftResult };
  }

  @Patch('analyze-website/jobs/:jobId/draft')
  @ApiOperation({ summary: 'Edit draft fields before approving' })
  patchAnalyzeJobDraft(
    @CurrentUser() user: AuthUser,
    @Param('jobId') jobId: string,
    @Body() patch: UpdateDraftDto,
  ) {
    return this.brandService.updateAnalysisJobDraft(user.id, jobId, patch as Partial<BrandAnalysisResult>);
  }

  @Post('analyze-website/jobs/:jobId/approve')
  @ApiOperation({ summary: 'Approve the draft and commit to brand profile' })
  approveAnalyzeJob(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string) {
    return this.brandService.approveAnalysisJob(user.id, jobId);
  }

  @Post('analyze-website/jobs/:jobId/cancel')
  @ApiOperation({ summary: 'Cancel a queued or running brand analysis job' })
  cancelAnalyzeJob(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string) {
    return this.brandService.cancelAnalysisJob(user.id, jobId);
  }

  @Get('markdown')
  @ApiOperation({ summary: 'Get presigned URL for brand knowledge markdown file' })
  getMarkdown(@CurrentUser() user: AuthUser) {
    return this.brandService.getMarkdown(user.id);
  }

  @Get('documents')
  @ApiOperation({ summary: 'Get presigned URLs for all 5 brand intelligence documents' })
  getDocuments(@CurrentUser() user: AuthUser) {
    return this.brandService.getDocuments(user.id);
  }

  @Get('validation-history')
  @ApiOperation({ summary: 'Get brand validation log history' })
  getValidationHistory(@CurrentUser() user: AuthUser) {
    return this.brandService.getValidationHistory(user.id);
  }

  // ═══════════════════════════════ INTELLIGENCE ═══════════════════════════════

  @Post('intelligence/enrich')
  @ApiOperation({ summary: 'Trigger full AI intelligence enrichment pipeline' })
  fullEnrich(@CurrentUser() user: AuthUser) {
    return this.intel.fullEnrich(user.id);
  }

  @Get('intelligence/dna')
  @ApiOperation({ summary: 'Get brand DNA — archetype, persuasion style, emotional energy' })
  getDna(@CurrentUser() user: AuthUser) {
    return this.intel.getDna(user.id);
  }

  @Post('intelligence/dna/extract')
  @ApiOperation({ summary: 'Re-extract brand DNA from current profile' })
  extractDna(@CurrentUser() user: AuthUser) {
    return this.intel.extractDna(user.id);
  }

  @Get('intelligence/memory')
  @ApiOperation({ summary: 'Get brand change history (living memory)' })
  getMemory(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.intel.getMemoryHistory(user.id, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('intelligence/memory/timeline')
  @ApiOperation({ summary: 'Get positioning evolution timeline' })
  getTimeline(@CurrentUser() user: AuthUser) {
    return this.intel.getPositioningTimeline(user.id);
  }

  @Get('intelligence/customer-voice')
  @ApiOperation({ summary: 'Get aggregated customer voice insights' })
  getCustomerVoice(@CurrentUser() user: AuthUser) {
    return this.intel.getCustomerVoice(user.id);
  }

  @Post('intelligence/customer-voice')
  @ApiOperation({ summary: 'Ingest customer reviews, comments, or testimonials' })
  ingestCustomerVoice(@CurrentUser() user: AuthUser, @Body() dto: IngestCustomerVoiceDto) {
    return this.intel.ingestCustomerVoice(user.id, {
      sourceType: dto.sourceType as CustomerVoiceInput['sourceType'],
      sourceUrl: dto.sourceUrl,
      texts: dto.texts,
    });
  }

  @Get('intelligence/competitors')
  @ApiOperation({ summary: 'Get competitor snapshots' })
  getCompetitorSnapshots(@CurrentUser() user: AuthUser, @Query('handle') handle?: string) {
    return this.intel.getCompetitorSnapshots(user.id, handle);
  }

  @Post('intelligence/competitors/analyze')
  @ApiOperation({ summary: 'Analyze a competitor with AI' })
  analyzeCompetitor(@CurrentUser() user: AuthUser, @Body() dto: AnalyzeCompetitorDto) {
    return this.intel.analyzeCompetitor(user.id, {
      id: '',
      platform: dto.platform,
      handle: dto.handle,
      addedAt: new Date().toISOString(),
    } as Competitor, dto.websiteUrl);
  }

  @Get('intelligence/competitors/report')
  @ApiOperation({ summary: 'Get full competitive intelligence report' })
  getCompetitiveReport(@CurrentUser() user: AuthUser) {
    return this.intel.getCompetitiveReport(user.id);
  }

  @Get('intelligence/drift')
  @ApiOperation({ summary: 'Get latest brand drift / consistency report' })
  getDrift(@CurrentUser() user: AuthUser) {
    return this.intel.getLatestDrift(user.id);
  }

  @Get('intelligence/drift/history')
  @ApiOperation({ summary: 'Get brand drift report history' })
  getDriftHistory(@CurrentUser() user: AuthUser) {
    return this.intel.getDriftHistory(user.id);
  }

  @Post('intelligence/drift/analyze')
  @ApiOperation({ summary: 'Run brand consistency analysis across channel content' })
  analyzeDrift(@CurrentUser() user: AuthUser, @Body() dto: AnalyzeDriftDto) {
    return this.intel.analyzeDrift(user.id, dto.channels as ChannelSample[]);
  }

  @Post('intelligence/drift/auto')
  @ApiOperation({ summary: 'Auto-analyze drift from published post history' })
  autoDrift(@CurrentUser() user: AuthUser) {
    return this.intel.getLatestDrift(user.id);
  }

  @Get('intelligence/agent/:agent')
  @ApiOperation({ summary: 'Get agent-specific brand intelligence context' })
  getAgentContext(@CurrentUser() user: AuthUser, @Param('agent') agent: string) {
    const valid: AgentName[] = ['sophie', 'leo', 'nova', 'atlas', 'clara', 'sarah', 'mark', 'general'];
    const agentName: AgentName = valid.includes(agent as AgentName) ? (agent as AgentName) : 'general';
    return this.intel.getAgentContext(user.id, agentName);
  }

  @Post('intelligence/search')
  @ApiOperation({ summary: 'Semantic search across brand knowledge' })
  search(@CurrentUser() user: AuthUser, @Body() dto: SearchDto) {
    return this.intel.search(user.id, dto.query, {
      agentContext: dto.agentContext as AgentName,
      limit: dto.limit,
    });
  }
}
