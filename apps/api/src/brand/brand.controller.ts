import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional, IsBoolean, IsNumber, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BrandService } from './brand.service';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

class AnalyzeWebsiteDto {
  @ApiProperty() @IsString() @IsUrl() websiteUrl: string;
}

class StringArrayDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  items: string[];
}

class UpdateVoiceDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString()  tone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsArray()   voiceCharacteristics?: string[];
  @ApiProperty({ required: false }) @IsOptional() @IsString()  brandDescription?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString()  valueProposition?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() autoReplyEnabled?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber()  sentimentThreshold?: number;
}

class AddCompetitorDto {
  @ApiProperty() @IsString() platform: string;
  @ApiProperty() @IsString() handle: string;
}

@ApiTags('Brand')
@ApiBearerAuth()
@Controller('brand')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

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
  @ApiOperation({ summary: 'Replace brand profile fields (alias for PATCH)' })
  replace(@CurrentUser() user: AuthUser, @Body() dto: UpdateBrandDto) {
    return this.brandService.update(user.id, dto);
  }

  // ── Voice ──────────────────────────────────────────────────────────────────

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

  // ── Competitors ────────────────────────────────────────────────────────────

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

  // ── Hashtags / Prohibited ──────────────────────────────────────────────────

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

  // ── Website Analyzer ───────────────────────────────────────────────────────

  @Post('analyze-website')
  @ApiOperation({ summary: 'Scrape website and auto-fill brand profile via AI' })
  analyzeWebsite(@CurrentUser() user: AuthUser, @Body() dto: AnalyzeWebsiteDto) {
    return this.brandService.analyzeWebsite(user.id, dto.websiteUrl);
  }

  @Get('markdown')
  @ApiOperation({ summary: 'Get presigned URL for brand knowledge markdown file' })
  getMarkdown(@CurrentUser() user: AuthUser) {
    return this.brandService.getMarkdown(user.id);
  }
}
