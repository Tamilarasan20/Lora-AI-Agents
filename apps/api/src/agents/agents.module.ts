import { Module } from '@nestjs/common';
import { ClaraAgent } from './clara/clara.agent';
import { SarahAgent } from './sarah/sarah.agent';
import { MarkAgent } from './mark/mark.agent';
import { SophieAgent } from './sophie/sophie.agent';
import { TheoAgent } from './theo/theo.agent';
import { ElenaAgent } from './elena/elena.agent';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [
    ClaraAgent,
    SarahAgent,
    MarkAgent,
    SophieAgent,
    TheoAgent,
    ElenaAgent,
  ],
  exports: [
    ClaraAgent,
    SarahAgent,
    MarkAgent,
    SophieAgent,
    TheoAgent,
    ElenaAgent,
  ],
})
export class AgentsModule {}
