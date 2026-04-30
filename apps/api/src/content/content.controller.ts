import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { CreateContentDto } from './dto/create-content.dto';
import { GenerateContentDto } from './dto/generate-content.dto';
import { QueryContentDto } from './dto/query-content.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Content')
@ApiBearerAuth()
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post()
  @ApiOperation({ summary: 'Create content manually' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateContentDto) {
    return this.contentService.create(user.id, dto);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Ask Clara to generate platform-adapted content from a brief' })
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateContentDto) {
    return this.contentService.generate(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List content with optional filters' })
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryContentDto) {
    return this.contentService.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single content item' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.contentService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update content draft' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: Partial<CreateContentDto>) {
    return this.contentService.update(user.id, id, dto);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve content for scheduling' })
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.contentService.approve(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete content' })
  async delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.contentService.delete(user.id, id);
  }
}
