import { ContainerModule } from '@theia/core/shared/inversify';
import { ProgressWidget } from './progress-widget';
import { WidgetContribution } from './widget-contribution';
import { Agent } from '@theia/ai-core';
import { ChatAgent } from '@theia/ai-chat';
import { TutorChatAgent } from '../common/tutor-chat-agent';
import { AIChatInputConfiguration } from '@theia/ai-chat-ui/lib/browser/chat-input-widget';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';
// @ts-ignore
import '../../src/browser/style/index.css';

export default new ContainerModule((bind, _unbind, _isBound, rebind) => {
    bindViewContribution(bind, WidgetContribution);
    bind(FrontendApplicationContribution).toService(WidgetContribution);
    bind(ProgressWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: ProgressWidget.ID,
        createWidget: () => ctx.container.get<ProgressWidget>(ProgressWidget)
    })).inSingletonScope();
    bind(TutorChatAgent).toSelf().inSingletonScope();
    bind(Agent).toService(TutorChatAgent);
    bind(ChatAgent).toService(TutorChatAgent);
    rebind(AIChatInputConfiguration).toConstantValue({
        showPinnedAgent: false,
    });
});
