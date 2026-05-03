import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmRouterService } from '../../llm-router/llm-router.service';
import { AgentsService } from '../agents/agents.service';
import {
  assignAgent, classifyGoal,
  LoraStrategyOutput, ExecutionWeek, CalendarItemDraft, PHASE_1_AGENT_CREDIT_COSTS,
} from '../agents/agent.types';
import { LORA_SYSTEM_PROMPT } from '../agents/prompts/lora.prompt';
import { CreateStrategyDto } from './dto/create-strategy.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LoraOrchestrator {
  private readonly logger = new Logger(LoraOrchestrator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agents: AgentsService,
    @Optional() private readonly llm: LlmRouterService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════
  // MAIN ORCHESTRATION: Create full marketing strategy
  // ═══════════════════════════════════════════════════════════════════

  async createMarketingStrategy(dto: CreateStrategyDto, userId: string) {
    this.logger.log(`[Lora] Creating strategy for user=${userId} goal="${dto.goal}"`);

    // 1. Load brand knowledge
    const brand = await this.prisma.brandKnowledge.findUnique({ where: { userId } });

    // 2. Classify goal type
    const goalType = classifyGoal(dto.goal);

    // 3. Build context for Lora
    const brandContext = brand ? `
Brand: ${brand.brandName ?? 'Unknown'}
Industry: ${brand.industry ?? 'Unknown'}
Target Audience: ${brand.targetAudience ?? 'Unknown'}
Tone: ${brand.tone ?? 'professional'}
Value Proposition: ${brand.valueProposition ?? 'N/A'}
Content Pillars: ${(brand.contentPillars as string[]).join(', ')}
` : 'No brand knowledge base available. Make reasonable assumptions.';

    // 4. Optionally get Sam insights for research-heavy goals
    let samInsights = '';
    if (['market_research', 'competitor_analysis', 'brand_awareness', 'product_launch', 'social_growth'].includes(goalType)) {
      this.logger.log('[Lora] Requesting Sam trend/competitor insights...');
      const samResult = await this.agents.runSam(
        `Analyze trends and competitor activity for a business in ${brand?.industry ?? 'this industry'} with goal: ${dto.goal}. Provide actionable insights for a ${goalType} strategy.`,
        userId,
        dto.businessId,
      );
      samInsights = `\nSam's Research Insights:\n${JSON.stringify(samResult, null, 2)}`;
    }

    // 5. Generate Lora strategy via LLM
    const loraOutput = await this.generateLoraStrategy(dto, brandContext, samInsights, goalType, userId);

    // 6. Persist strategy
    const strategy = await this.prisma.marketingStrategy.create({
      data: {
        userId,
        businessId: dto.businessId,
        title: loraOutput.strategySummary.slice(0, 200) || dto.goal,
        goal: dto.goal,
        goalType,
        summary: loraOutput.strategySummary,
        targetAudience: loraOutput.targetAudience,
        brandVoiceDirection: loraOutput.brandVoiceDirection,
        positioning: loraOutput.positioning,
        channels: (loraOutput.recommendedChannels ?? []) as Prisma.InputJsonValue,
        contentPillars: (loraOutput.contentPillars ?? []) as Prisma.InputJsonValue,
        campaignIdeas: (loraOutput.campaignIdeas ?? []) as Prisma.InputJsonValue,
        executionPlan: (loraOutput.executionPlan ?? []) as unknown as Prisma.InputJsonValue,
        teamAssignments: (loraOutput.teamAssignments ?? []) as unknown as Prisma.InputJsonValue,
        recommendedChannels: (loraOutput.recommendedChannels ?? []) as Prisma.InputJsonValue,
        risks: (loraOutput.risks ?? []) as Prisma.InputJsonValue,
        nextBestActions: (loraOutput.nextBestActions ?? []) as Prisma.InputJsonValue,
        status: 'draft',
        creditsUsed: PHASE_1_AGENT_CREDIT_COSTS.loraFullStrategy,
      },
    });

    // 7. Create campaigns from execution plan
    const campaigns = await this.createCampaignsFromPlan(strategy.id, dto, loraOutput, userId);

    // 8. Create tasks + assignments
    const tasks = await this.createTasksFromPlan(strategy.id, campaigns[0]?.id, loraOutput, userId, dto.businessId);

    // 9. Create calendar items
    const calendarItems = await this.createCalendarItems(loraOutput.calendarItems ?? [], userId, dto.businessId, campaigns[0]?.id);

    // 10. Log credit usage
    await this.prisma.agentCreditUsage.create({
      data: {
        userId,
        agentName: 'Lora',
        action: 'loraFullStrategy',
        credits: PHASE_1_AGENT_CREDIT_COSTS.loraFullStrategy,
        metadata: { strategyId: strategy.id } as Prisma.InputJsonValue,
      },
    }).catch(() => null);

    return {
      strategyId: strategy.id,
      strategy: { ...strategy, loraOutput },
      tasks,
      teamAssignments: loraOutput.teamAssignments ?? [],
      calendarItems,
      approvalItems: loraOutput.approvalItems ?? [],
      nextBestActions: loraOutput.nextBestActions ?? [],
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // RUN AGENT TASK
  // ═══════════════════════════════════════════════════════════════════

  async runAgentTask(taskId: string, agentName: string, userId: string) {
    const task = await this.prisma.marketingTask.findFirstOrThrow({ where: { id: taskId, userId } });

    await this.prisma.marketingTask.update({ where: { id: taskId }, data: { status: 'in_progress' } });
    await this.prisma.agentAssignment.updateMany({
      where: { taskId, agentName },
      data: { status: 'in_progress', startedAt: new Date() },
    });

    let content: unknown;
    const bId = task.businessId;

    if (agentName === 'Sam') {
      content = await this.agents.runSam(task.description, userId, bId);
    } else if (agentName === 'Clara') {
      content = await this.agents.runClara(task.description, userId, bId);
    } else if (agentName === 'Steve') {
      content = await this.agents.runSteve(task.description, userId, bId);
    } else if (agentName === 'Sarah') {
      content = await this.agents.runSarah(task.description, userId, bId);
    } else {
      content = { message: 'Lora reviewed task', task };
    }

    const output = await this.prisma.agentOutput.create({
      data: {
        userId,
        businessId: bId,
        taskId,
        agentName,
        outputType: this.inferOutputType(agentName),
        content: content as Prisma.InputJsonValue,
        status: 'needs_review',
      },
    });

    // Auto-Lora review
    const strategy = task.strategyId
      ? await this.prisma.marketingStrategy.findUnique({ where: { id: task.strategyId } })
      : null;

    const review = await this.agents.runLoraReview(content, strategy?.goal ?? task.title, userId, bId);

    const reviewed = await this.prisma.agentOutput.update({
      where: { id: output.id },
      data: {
        qualityScore: review.qualityScore,
        brandFitScore: review.brandFitScore,
        goalAlignmentScore: review.goalAlignmentScore,
        reviewNotes: review.notes,
        reviewedByLora: true,
        status: review.approved ? 'pending_approval' : 'needs_revision',
      },
    });

    // Create approval record if Lora approved
    if (review.approved) {
      await this.prisma.approval.upsert({
        where: { outputId: output.id },
        create: {
          userId,
          businessId: bId,
          outputId: output.id,
          type: this.inferOutputType(agentName),
          status: 'pending',
          requestedBy: 'Lora',
        },
        update: { status: 'pending' },
      });
    }

    await this.prisma.marketingTask.update({
      where: { id: taskId },
      data: { status: review.approved ? 'pending_approval' : 'needs_revision', outputId: output.id, reviewStatus: 'reviewed', reviewedBy: 'Lora', reviewNotes: review.notes },
    });

    await this.prisma.agentAssignment.updateMany({
      where: { taskId, agentName },
      data: { status: 'completed', completedAt: new Date() },
    });

    return { output: reviewed, review };
  }

  // ═══════════════════════════════════════════════════════════════════
  // APPROVE / REJECT
  // ═══════════════════════════════════════════════════════════════════

  async approveOutput(outputId: string, userId: string, notes?: string) {
    const approval = await this.prisma.approval.update({
      where: { outputId },
      data: { status: 'approved', reviewedBy: userId, notes },
    });
    await this.prisma.agentOutput.update({ where: { id: outputId }, data: { status: 'approved' } });
    return approval;
  }

  async rejectOutput(outputId: string, userId: string, notes?: string) {
    const approval = await this.prisma.approval.update({
      where: { outputId },
      data: { status: 'rejected', reviewedBy: userId, notes },
    });
    await this.prisma.agentOutput.update({ where: { id: outputId }, data: { status: 'rejected' } });
    return approval;
  }

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════════

  async getDashboard(userId: string) {
    const [activeStrategies, pendingTasks, pendingApprovals, upcomingCalendar] = await Promise.all([
      this.prisma.marketingStrategy.findMany({
        where: { userId, status: { in: ['draft', 'active'] } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.marketingTask.findMany({
        where: { userId, status: { in: ['pending', 'in_progress'] } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { assignments: true },
      }),
      this.prisma.approval.findMany({
        where: { userId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { output: true },
      }),
      this.prisma.marketingCalendarItem.findMany({
        where: { userId, scheduledAt: { gte: new Date() } },
        orderBy: { scheduledAt: 'asc' },
        take: 10,
      }),
    ]);

    const agentAssignments = await this.prisma.agentAssignment.groupBy({
      by: ['agentName', 'status'],
      where: { userId },
      _count: { id: true },
    });

    const loraRecommendations = activeStrategies.length
      ? activeStrategies[0].nextBestActions
      : ['Add your brand knowledge base to get started', 'Tell Lora your marketing goal', 'Connect your social platforms'];

    return {
      activeStrategies,
      activeCampaigns: [],
      pendingTasks,
      agentAssignments,
      pendingApprovals,
      upcomingCalendarItems: upcomingCalendar,
      loraRecommendations,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════

  private async generateLoraStrategy(
    dto: CreateStrategyDto,
    brandContext: string,
    samInsights: string,
    goalType: string,
    userId: string,
  ): Promise<LoraStrategyOutput> {
    const prompt = `
You are Lora, AI Marketing Lead. Create a complete marketing strategy.

Business Goal: ${dto.goal}
Goal Type: ${goalType}
Timeline: ${dto.timeline ?? '30 days'}
Preferred Channels: ${dto.channels?.join(', ') ?? 'Instagram, TikTok, Facebook, LinkedIn'}
Target Audience: ${dto.targetAudience ?? 'To be determined from brand knowledge'}
Additional Context: ${dto.additionalContext ?? 'None'}

${brandContext}
${samInsights}

Return ONLY valid JSON matching this structure exactly:
{
  "strategySummary": "string",
  "businessGoal": "string",
  "goalType": "string",
  "targetAudience": "string",
  "brandVoiceDirection": "string",
  "positioning": "string",
  "recommendedChannels": ["string"],
  "campaignIdeas": ["string"],
  "contentPillars": ["string"],
  "executionPlan": [{"week": 1, "focus": "string", "tasks": [{"title": "string", "assignedTo": "Sam|Clara|Steve|Sarah", "priority": "high|medium|low", "description": "string"}]}],
  "teamAssignments": [{"agent": "string", "responsibility": "string"}],
  "calendarItems": [{"title": "string", "platform": "string", "contentType": "string", "assignedTo": "string", "status": "draft"}],
  "approvalItems": ["string"],
  "risks": ["string"],
  "nextBestActions": ["string"]
}`;

    if (!this.llm) {
      return this.fallbackStrategy(dto, goalType);
    }

    try {
      const res = await this.llm.route({
        systemPrompt: LORA_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 6000,
        routing: { strategy: 'quality' },
      });
      const parsed = this.parseJson<LoraStrategyOutput>(res.content, this.fallbackStrategy(dto, goalType));
      return parsed;
    } catch (err) {
      this.logger.warn(`Lora LLM call failed: ${err} — using fallback`);
      return this.fallbackStrategy(dto, goalType);
    }
  }

  private parseJson<T>(raw: string, fallback: T): T {
    try {
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/s);
      return JSON.parse(match?.[1] ?? raw) as T;
    } catch {
      return fallback;
    }
  }

  private fallbackStrategy(dto: CreateStrategyDto, goalType: string): LoraStrategyOutput {
    return {
      strategySummary: `Focus on educational and trust-building content to achieve: ${dto.goal}`,
      businessGoal: dto.goal,
      goalType: goalType as any,
      targetAudience: dto.targetAudience ?? 'Target customers interested in your product',
      brandVoiceDirection: 'Helpful, clear, confident, and conversion-focused',
      positioning: 'A practical solution that makes the customer\'s life easier',
      recommendedChannels: dto.channels ?? ['Instagram', 'TikTok', 'Facebook'],
      campaignIdeas: ['Problem-solution content', 'Customer trust campaign', 'Product benefits series', 'Limited-time offer'],
      contentPillars: ['Education', 'Product benefits', 'Social proof', 'Behind the brand', 'Offers'],
      executionPlan: [
        { week: 1, focus: 'Research and foundation', tasks: [
          { title: 'Analyze competitors and trends', assignedTo: 'Sam', priority: 'high', description: 'Research top competitor content and current trends' },
          { title: 'Create campaign messaging angles', assignedTo: 'Clara', priority: 'high', description: 'Write 5 content angles for the campaign' },
          { title: 'Create visual direction', assignedTo: 'Steve', priority: 'medium', description: 'Design carousel concepts and visual brief' },
        ]},
        { week: 2, focus: 'Content creation', tasks: [
          { title: 'Write 10 social captions', assignedTo: 'Clara', priority: 'high', description: 'Create platform-specific captions for all channels' },
          { title: 'Create 3 carousel concepts', assignedTo: 'Steve', priority: 'high', description: 'Build 3 scroll-stopping carousel ideas' },
          { title: 'Prepare weekly posting calendar', assignedTo: 'Sarah', priority: 'medium', description: 'Organize and schedule approved content' },
        ]},
      ],
      teamAssignments: [
        { agent: 'Sam', responsibility: 'Trends, competitors, and content opportunities' },
        { agent: 'Clara', responsibility: 'Campaign copy, captions, emails, and CTAs' },
        { agent: 'Steve', responsibility: 'Visual concepts, carousels, and design prompts' },
        { agent: 'Sarah', responsibility: 'Scheduling, publishing, and engagement management' },
      ],
      calendarItems: [
        { title: 'Product benefit post', platform: 'Instagram', contentType: 'carousel', assignedTo: 'Sarah', status: 'draft' },
        { title: 'Educational reel', platform: 'TikTok', contentType: 'video', assignedTo: 'Sarah', status: 'draft' },
      ],
      approvalItems: ['Campaign strategy', 'Captions', 'Carousel concepts', 'Publishing schedule'],
      risks: ['Brand knowledge base incomplete', 'No past analytics available'],
      nextBestActions: ['Confirm main product offer', 'Generate first week content', 'Create carousel concepts', 'Prepare calendar'],
    };
  }

  private async createCampaignsFromPlan(strategyId: string, dto: CreateStrategyDto, output: LoraStrategyOutput, userId: string) {
    return Promise.all(
      (output.campaignIdeas ?? []).slice(0, 3).map((idea, i) =>
        this.prisma.marketingCampaign.create({
          data: {
            userId,
            businessId: dto.businessId,
            strategyId,
            name: idea,
            objective: dto.goal,
            channels: (dto.channels ?? output.recommendedChannels ?? []) as Prisma.InputJsonValue,
            status: 'draft',
            kpis: [] as Prisma.InputJsonValue,
          },
        })
      )
    );
  }

  private async createTasksFromPlan(
    strategyId: string,
    campaignId: string | undefined,
    output: LoraStrategyOutput,
    userId: string,
    businessId: string,
  ) {
    const allTasks: any[] = [];
    for (const week of output.executionPlan ?? []) {
      for (const t of week.tasks ?? []) {
        const agent = t.assignedTo ?? assignAgent(t.title);
        const task = await this.prisma.marketingTask.create({
          data: {
            userId,
            businessId,
            strategyId,
            campaignId: campaignId ?? null,
            title: t.title,
            description: t.description ?? t.title,
            assignedAgent: agent,
            priority: t.priority ?? 'medium',
            status: 'pending',
          },
        });
        await this.prisma.agentAssignment.create({
          data: {
            userId,
            businessId,
            taskId: task.id,
            agentName: agent,
            agentRole: this.agentRole(agent),
            assignmentReason: `Assigned by Lora for ${week.focus}`,
            status: 'assigned',
          },
        });
        allTasks.push(task);
      }
    }
    return allTasks;
  }

  private async createCalendarItems(
    items: CalendarItemDraft[],
    userId: string,
    businessId: string,
    campaignId?: string,
  ) {
    return Promise.all(
      items.map((item) =>
        this.prisma.marketingCalendarItem.create({
          data: {
            userId,
            businessId,
            campaignId: campaignId ?? null,
            title: item.title,
            platform: item.platform,
            contentType: item.contentType,
            assignedAgent: item.assignedTo,
            approvalStatus: 'pending',
            publishStatus: 'draft',
          },
        })
      )
    );
  }

  private inferOutputType(agentName: string): string {
    const map: Record<string, string> = {
      Sam: 'trend_analysis', Clara: 'written_content', Steve: 'visual_concept',
      Sarah: 'social_schedule', Lora: 'strategy_review',
    };
    return map[agentName] ?? 'general';
  }

  private agentRole(agent: string): string {
    const map: Record<string, string> = {
      Sam: 'AI Strategist', Clara: 'AI Content Writer',
      Steve: 'AI Visual Designer', Sarah: 'AI Social Media Manager',
      Lora: 'AI Marketing Lead',
    };
    return map[agent] ?? agent;
  }
}
