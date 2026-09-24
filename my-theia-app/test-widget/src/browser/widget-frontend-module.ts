import { ContainerModule } from '@theia/core/shared/inversify';
import { TestWidget } from './test-widget';
import { WidgetContribution } from './widget-contribution';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';
// @ts-expect-error
import '../../src/browser/style/index.css';

export default new ContainerModule(bind => {
    bindViewContribution(bind, WidgetContribution);
    bind(FrontendApplicationContribution).toService(WidgetContribution);
    bind(TestWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: TestWidget.ID,
        createWidget: () => ctx.container.get<TestWidget>(TestWidget)
    })).inSingletonScope();
});
