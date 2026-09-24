import * as React from '@theia/core/shared/react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { Message } from '@theia/core/lib/browser';

@injectable()
export class TestWidget extends ReactWidget {

    static readonly ID = 'test:widget';
    static readonly LABEL = 'Test Widget';

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @postConstruct()
    protected init(): void {
        this.doInit()
    }

    protected async doInit(): Promise<void> {
        this.id = TestWidget.ID;
        this.title.label = TestWidget.LABEL;
        this.title.caption = TestWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-window-maximize'; // example widget icon.
        this.update();
    }

    render(): React.ReactElement {
        return <div id="widget-container">
            <h2>Test Cases</h2>
            <div className="tests">
                <TestCase name="Test 1" pass={true} />
                <TestCase name="Test 2" pass={false} />
            </div>
        </div>
    }

    protected displayMessage(): void {
        this.messageService.info('Congratulations: Widget Widget Successfully Created!');
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        const htmlElement = document.getElementById('displayMessageButton');
        if (htmlElement) {
            htmlElement.focus();
        }
    }

}

function TestCase({ name, pass }: {
    name: string,
    pass: boolean
}): React.ReactElement {
    return <div className={`test ${!pass && 'fail-row'}`}>
        <span className={`status ${pass ? 'pass' : 'fail'}`}>{pass ? '✓' : '×'}</span>
        <div>
            <code>{name}</code>
            <small>{pass ? 'PASS' : 'FAIL'}</small>
        </div>
    </div>
}
