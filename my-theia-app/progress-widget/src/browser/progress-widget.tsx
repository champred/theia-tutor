import * as React from '@theia/core/shared/react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { Message } from '@theia/core/lib/browser';

@injectable()
export class ProgressWidget extends ReactWidget {

    static readonly ID = 'progress:widget';
    static readonly LABEL = 'Progress Widget';

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @postConstruct()
    protected init(): void {
        this.doInit()
    }

    protected async doInit(): Promise<void> {
        this.id = ProgressWidget.ID;
        this.title.label = ProgressWidget.LABEL;
        this.title.caption = ProgressWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-window-maximize'; // example widget icon.
        this.update();
    }

    render(): React.ReactElement {
        return <div id="widget-container">
            <h2>Assignment Progress</h2>
            <ProgressBar />
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

function ProgressStage({ number, label, active, click }: {
    number: string,
    label: string,
    active: boolean,
    click: React.MouseEventHandler
}): React.ReactElement {
    return <div className={`stage ${active && 'done'}`} onClick={click}>
        <div className="bubble">{number}</div>
        <span>{label}</span>
    </div>
}

function ProgressBar(): React.ReactElement {
    const [percent, setPercent] = React.useState(0);
    return <>
        <div className="progress" style={{ '--percent': percent + "%" } as React.CSSProperties}></div>
        <div className="stages">
            <ProgressStage number='1' label="Conceptual Logic" active={percent > 0} click={() => setPercent(1)} />
            <ProgressStage number='2' label="Algorithm Design" active={percent > 49} click={() => setPercent(50)} />
            <ProgressStage number='3' label="Code Implementation" active={percent > 99} click={() => setPercent(100)} />
        </div>
    </>
}
