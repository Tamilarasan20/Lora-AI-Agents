import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe,
  Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoraService } from './lora.service';
import { CreateStrategyDto } from './dto/create-strategy.dto';
import { ApprovalActionDto, RunAgentTaskDto } from './dto/review-output.dto';
import { LoraChatDto } from './dto/lora-chat.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class LoraController {
  constructor(private readonly lora: LoraService) {}

  // ─── Chat ─────────────────────────────────────────────────────────────────

  @Post('lora/chat')
  chat(@Body() dto: LoraChatDto, @Request() req: any) {
    return this.lora.chat(dto, req.user.id);
  }

  @Get('lora/conversations')
  listConversations(@Request() req: any) {
    return this.lora.listConversations(req.user.id);
  }

  @Get('lora/conversations/:id')
  getConversation(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.lora.getConversation(id, req.user.id);
  }

  // ─── Strategy ─────────────────────────────────────────────────────────────

  @Post('lora/strategy')
  createStrategy(@Body() dto: CreateStrategyDto, @Request() req: any) {
    return this.lora.createStrategy(dto, req.user.id);
  }

  @Get('lora/strategy/:id')
  getStrategy(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.lora.getStrategy(id, req.user.id);
  }

  @Get('lora/strategies')
  listStrategies(@Request() req: any) {
    return this.lora.listStrategies(req.user.id);
  }

  @Post('lora/strategy/:id/activate')
  activateStrategy(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.lora.updateStrategyStatus(id, 'active', req.user.id);
  }

  @Post('lora/strategy/:id/pause')
  pauseStrategy(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.lora.updateStrategyStatus(id, 'paused', req.user.id);
  }

  @Post('lora/strategy/:id/complete')
  completeStrategy(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.lora.updateStrategyStatus(id, 'completed', req.user.id);
  }

  @Post('lora/strategy/:id/archive')
  archiveStrategy(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.lora.updateStrategyStatus(id, 'archived', req.user.id);
  }

  // ─── Agent Tasks ──────────────────────────────────────────────────────────

  @Post('agents/run')
  runAgentTask(@Body() dto: RunAgentTaskDto, @Request() req: any) {
    return this.lora.runAgentTask(dto.taskId, dto.agentName, req.user.id);
  }

  @Get('lora/tasks')
  listTasks(@Request() req: any, @Query('status') status?: string) {
    return this.lora.listTasks(req.user.id, status);
  }

  // ─── Outputs / Content Editor ─────────────────────────────────────────────

  @Get('lora/content/:outputId')
  getOutput(@Param('outputId', ParseUUIDPipe) outputId: string, @Request() req: any) {
    return this.lora.getOutput(outputId, req.user.id);
  }

  @Patch('lora/content/:outputId')
  updateOutputContent(
    @Param('outputId', ParseUUIDPipe) outputId: string,
    @Body() body: { content: unknown },
    @Request() req: any,
  ) {
    return this.lora.updateOutputContent(outputId, body.content, req.user.id);
  }

  @Get('lora/review/:outputId')
  reviewOutput(
    @Param('outputId', ParseUUIDPipe) outputId: string,
    @Query('taskId') taskId: string,
    @Request() req: any,
  ) {
    return this.lora.reviewOutput(outputId, taskId, req.user.id);
  }

  // ─── Approvals ────────────────────────────────────────────────────────────

  @Post('approvals/:id/approve')
  approveOutput(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovalActionDto,
    @Request() req: any,
  ) {
    return this.lora.approveOutput(id, req.user.id, dto.notes);
  }

  @Post('approvals/:id/reject')
  rejectOutput(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovalActionDto,
    @Request() req: any,
  ) {
    return this.lora.rejectOutput(id, req.user.id, dto.notes);
  }

  @Get('lora/approvals')
  listApprovals(@Request() req: any) {
    return this.lora.listApprovals(req.user.id);
  }

  // ─── Creative Assets ──────────────────────────────────────────────────────

  @Get('lora/assets')
  listAssets(
    @Request() req: any,
    @Query('campaignId') campaignId?: string,
    @Query('platform') platform?: string,
    @Query('status') status?: string,
  ) {
    return this.lora.listAssets(req.user.id, { campaignId, platform, status });
  }

  @Get('lora/assets/:assetId')
  getAsset(@Param('assetId', ParseUUIDPipe) assetId: string, @Request() req: any) {
    return this.lora.getAsset(assetId, req.user.id);
  }

  @Delete('lora/assets/:assetId')
  deleteAsset(@Param('assetId', ParseUUIDPipe) assetId: string, @Request() req: any) {
    return this.lora.deleteAsset(assetId, req.user.id);
  }

  // ─── Calendar ─────────────────────────────────────────────────────────────

  @Get('lora/calendar')
  getCalendar(
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.lora.getCalendar(req.user.id, from, to);
  }

  @Post('lora/calendar/items/:itemId/schedule')
  scheduleCalendarItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: { scheduledAt: string },
    @Request() req: any,
  ) {
    return this.lora.scheduleCalendarItem(itemId, body.scheduledAt, req.user.id);
  }

  // ─── Credits ──────────────────────────────────────────────────────────────

  @Get('lora/credits/usage')
  getCreditUsage(@Request() req: any) {
    return this.lora.getCreditUsage(req.user.id);
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  @Get('lora/dashboard')
  getDashboard(@Request() req: any) {
    return this.lora.getDashboard(req.user.id);
  }

  // ─── Competitors ─────────────────────────────────────────────────────────

  @Get('lora/competitors')
  listCompetitors(@Request() req: any, @Query('businessId') businessId: string) {
    return this.lora.listCompetitors(req.user.id, businessId ?? 'default');
  }

  @Post('lora/competitors')
  addCompetitor(@Request() req: any, @Body() body: { businessId: string; name: string; websiteUrl?: string; notes?: string }) {
    return this.lora.addCompetitor(req.user.id, body.businessId, body);
  }

  @Delete('lora/competitors/:id')
  removeCompetitor(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.lora.removeCompetitor(id, req.user.id);
  }
}
