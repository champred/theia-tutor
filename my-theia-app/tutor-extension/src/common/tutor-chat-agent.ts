import { LanguageModelRequirement } from '@theia/ai-core/lib/common';
import { inject, injectable, named } from '@theia/core/shared/inversify';
import { AbstractModeAwareChatAgent } from '@theia/ai-ide/lib/browser/mode-aware-chat-agent';
import { ILogger, nls } from '@theia/core';
import {
    TUTOR_OVERSEER_PROMPT_ID,
    TUTOR_PHASE_1_PROMPT_ID,
    TUTOR_PHASE_2_PROMPT_ID,
    TUTOR_PHASE_3_PROMPT_ID,
    tutorSystemVariants
} from './tutor-prompt-template';
import { ChatMode } from '@theia/ai-chat';

export const TutorChatAgentId = 'Tutor';
@injectable()
export class TutorChatAgent extends AbstractModeAwareChatAgent {
    @inject(ILogger) @named('progress-widget:TutorChatAgent')
   protected override readonly logger!: ILogger;

    id: string = TutorChatAgentId;
    name = TutorChatAgentId;
    languageModelRequirements: LanguageModelRequirement[] = [{
        purpose: 'chat',
        identifier: 'ollama/gpt-oss:20b',
    }];
    protected defaultLanguageModelPurpose: string = 'chat';
    override description = nls.localize('theia-tutor/agent/description',
    'This agent is designed to provide tutoring guidance.');

    protected readonly modeDefinitions: Omit<ChatMode, 'isDefault'>[] = [{
        id: TUTOR_OVERSEER_PROMPT_ID,
        name: nls.localizeByDefault("Overseer")
    }, {
        id: TUTOR_PHASE_1_PROMPT_ID,
        name: nls.localize('theia-tutor/agent/mode/1', 'Phase 1')
    }, {
        id: TUTOR_PHASE_2_PROMPT_ID,
        name: nls.localize('theia-tutor/agent/mode/1', 'Phase 2')
    }, {
        id: TUTOR_PHASE_3_PROMPT_ID,
        name: nls.localize('theia-tutor/agent/mode/1', 'Phase 3')
    }]

    override prompts = [tutorSystemVariants];
    protected override systemPromptId: string = tutorSystemVariants.id;
    // override iconClass: string = 'codicon codicon-comment';
    override functions = ['getTutorTests', 'getFileContent', 'writeFileContent'];
    override variables = ['currentFileContent', 'lineNumber', 'currentRelativeDirPath'];
}