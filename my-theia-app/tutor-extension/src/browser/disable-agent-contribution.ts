import { AgentService } from '@theia/ai-core';
import {
    FrontendApplicationContribution,
    FrontendApplication
} from '@theia/core/lib/browser';
import { inject, injectable } from '@theia/core/shared/inversify';
import { TutorChatAgentId } from '../common/tutor-chat-agent';

@injectable()
export class DisableAgentContribution implements FrontendApplicationContribution {
    @inject(AgentService)
    protected readonly agentService!: AgentService;

    async onStart(_app: FrontendApplication): Promise<void> {
        for (const agent of this.agentService.getAllAgents()) {
            if (agent.id !== TutorChatAgentId && this.agentService.isEnabled(agent.id)) {
                await this.agentService.disableAgent(agent.id);
            }
        }
    }
}