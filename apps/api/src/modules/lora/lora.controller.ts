import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LoraService } from './lora.service';
import { CreateStrategyDto } from './dto/create-strategy.dto';
import { ApprovalActionDto, RunAgentTaskDto } from './dto/review-output.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class LoraController {
  constructor(private readonly lora: LoraService) {}

  // ─── Strategy ────────────────────────────────────────────────────────────────

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

  // ─── Agent Tasks ─────────────────────────────────────────────────────────────

  @Post('agents/run')
  runAgentTask(@Body() dto: RunAgentTaskDto, @Request() req: any) {
    return this.lora.runAgentTask(dto.taskId, dto.agentName, req.user.id);
  }

  @Get('lora/tasks')
  listTasks(@Request() req: any, @Query('status') status?: string) {
    return this.lora.listTasks(req.user.id, status);
  }

  // ─── Review & Approvals ──────────────────────────────────────────────────────

  @Get('lora/review/:outputId')
  reviewOutput(
    @Param('outputId', ParseUUIDPipe) outputId: string,
    @Query('taskId') taskId: string,
    @Request() req: any,
  ) {
    return this.lora.reviewOutput(outputId, taskId, req.user.id);
  }

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

  // ─── Dashboard & Calendar ────────────────────────────────────────────────────

  @Get('lora/dashboard')
  getDashboard(@Request() req: any) {
    return this.lora.getDashboard(req.user.id);
  }

  @Get('lora/calendar')
  getCalendar(
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.lora.getCalendar(req.user.id, from, to);
  }
}
