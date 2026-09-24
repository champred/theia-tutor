import { ContainerModule } from '@theia/core/shared/inversify';
import { ProgressWidget } from './progress-widget';
import { WidgetContribution } from './widget-contribution';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';
// @ts-expect-error
import '../../src/browser/style/index.css';

export default new ContainerModule(bind => {
    bindViewContribution(bind, WidgetContribution);
    bind(FrontendApplicationContribution).toService(WidgetContribution);
    bind(ProgressWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: ProgressWidget.ID,
        createWidget: () => ctx.container.get<ProgressWidget>(ProgressWidget)
    })).inSingletonScope();
});
