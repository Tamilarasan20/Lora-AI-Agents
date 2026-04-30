import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BrandService } from './brand.service';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

class StringArrayDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  items: string[];
}

@ApiTags('Brand')
@ApiBearerAuth()
@Controller('brand')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get()
  @ApiOperation({ summary: 'Get brand knowledge profile' })
  get(@CurrentUser() user: AuthUser) {
    return this.brandService.get(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update brand voice, tone, prohibited words, hashtags, content pillars' })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateBrandDto) {
    return this.brandService.update(user.id, dto);
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
}
