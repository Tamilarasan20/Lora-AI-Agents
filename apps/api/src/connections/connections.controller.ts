import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConnectionsService } from './connections.service';
import { GetOAuthUrlDto, ExchangeCodeDto } from './dto/connect-platform.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Connections')
@ApiBearerAuth()
@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  @Post('oauth-url')
  @ApiOperation({ summary: 'Get OAuth authorization URL for a platform' })
  getOAuthUrl(@CurrentUser() user: AuthUser, @Body() dto: GetOAuthUrlDto) {
    return this.connectionsService.getOAuthUrl(user.id, dto.platform, dto.redirectUri);
  }

  @Post('exchange')
  @ApiOperation({ summary: 'Exchange OAuth code for tokens and save connection' })
  exchangeCode(@CurrentUser() user: AuthUser, @Body() dto: ExchangeCodeDto) {
    return this.connectionsService.exchangeCode(user.id, dto.platform, dto.code, dto.redirectUri);
  }

  @Get()
  @ApiOperation({ summary: 'List all platform connections for current user' })
  list(@CurrentUser() user: AuthUser) {
    return this.connectionsService.listConnections(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single connection' })
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.connectionsService.getConnection(user.id, id);
  }

  @Post(':id/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force-refresh OAuth tokens for a connection' })
  refresh(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.connectionsService.refreshConnection(user.id, id);
  }

  @Get(':id/health')
  @ApiOperation({ summary: 'Check if a connection token is still valid' })
  health(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.connectionsService.checkHealth(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect a platform (revoke tokens)' })
  async disconnect(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.connectionsService.disconnectConnection(user.id, id);
  }
}
