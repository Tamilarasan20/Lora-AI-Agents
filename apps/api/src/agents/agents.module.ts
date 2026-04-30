import { Module } from '@nestjs/common';
import { ClaraAgent } from './clara/clara.agent';
import { SarahAgent } from './sarah/sarah.agent';
import { MarkAgent } from './mark/mark.agent';

@Module({
  providers: [ClaraAgent, SarahAgent, MarkAgent],
  exports: [ClaraAgent, SarahAgent, MarkAgent],
})
export class AgentsModule {}
