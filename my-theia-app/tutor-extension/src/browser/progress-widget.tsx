import * as React from '@theia/core/shared/react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { Message } from '@theia/core/lib/browser';
import { PromptService } from '@theia/ai-core';
import {
    ChatService,
    ChatAgentService,
    ChatAgentLocation,
    ChatSession
} from '@theia/ai-chat';
import {
    TUTOR_PHASE_1_PROMPT_ID,
    TUTOR_PHASE_2_PROMPT_ID,
    TUTOR_PHASE_3_PROMPT_ID,
    tutorSystemVariants
} from '../common/tutor-prompt-template';
import { TutorChatAgentId } from '../common/tutor-chat-agent';

const phases: {[key: string]: string} = {
    '1': TUTOR_PHASE_1_PROMPT_ID,
    '2': TUTOR_PHASE_2_PROMPT_ID,
    '3': TUTOR_PHASE_3_PROMPT_ID
}

@injectable()
export class ProgressWidget extends ReactWidget {

    static readonly ID = 'progress:widget';
    static readonly LABEL = 'Progress Widget';

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @inject(PromptService)
    protected readonly promptService!: PromptService;

    @inject(ChatService)
    protected readonly chatService!: ChatService;

    @inject(ChatAgentService)
    protected readonly chatAgentService!: ChatAgentService;

    private currentSession?: ChatSession;

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

    protected updateMode = async(mode: string) => {
        const agent = this.chatAgentService.getAgent(TutorChatAgentId);
        const phase = this.currentSession ?
            this.promptService.getSelectedVariantId(tutorSystemVariants.id)?.slice(-1) : 0;
        const steps = Number(mode) - Number(phase);
        if (!agent || steps > 1) throw new Error("Cannot move to that phase");

        if (this.currentSession) {
            const requests = this.currentSession.model.getRequests();
            const contents = requests[requests.length-1].response.response.content;
            const response = contents[contents.length-1].asString?.();
            if (response?.includes('[FINISHED]')) {
                const req = await this.chatService.sendRequest(this.currentSession.id, {
                    text: `Create #currentRelativeDirPath/Summary-${phase}.md`,
                    displayText: `Ended Phase ${phase}`,
                    modeId: tutorSystemVariants.defaultVariant.id
                });
                await req?.responseCompleted;
            } else throw new Error("Not ready to move on yet");
        }

        this.currentSession = this.chatService.createSession(
            ChatAgentLocation.Panel,
            {focus: true},
            agent
        )

        await this.promptService.updateSelectedVariantId(
            TutorChatAgentId,
            tutorSystemVariants.id,
            phases[mode]
        )

        await this.chatService.sendRequest(this.currentSession.id, {
            text: `Let's start on Phase ${mode}.`
        })
    }

    render(): React.ReactElement {
        return <div id="widget-container">
            <h2>Assignment Progress</h2>
            <ProgressBar update={this.updateMode} />
        </div>
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

function ProgressBar({update}: {update: (mode: string)=>Promise<void>}): React.ReactElement {
    const [percent, setPercent] = React.useState(0);
    const [status, setStatus] = React.useState("Click on the first phase to begin");
    return <>
        <div className="progress" style={{ '--percent': percent + "%" } as React.CSSProperties}></div>
        <div className="stages">
            <ProgressStage number='1' label="Conceptual Logic" active={percent > 0}
                click={() => update('1').then(() => {
                    setPercent(1);
                    setStatus("Move onto the next phase when ready");
                }).catch(setStatus)} />
            <ProgressStage number='2' label="Algorithm Design" active={percent > 49}
                click={() => update('2').then(() => {
                    setPercent(50);
                    setStatus("Move onto the next phase when ready");
                }).catch(setStatus)} />
            <ProgressStage number='3' label="Implement Code" active={percent > 99}
                click={() => update('3').then(() => {
                    setPercent(100);
                    setStatus("Move onto the next phase when ready");
                }).catch(setStatus)} />
        </div>
        <p className={'status ' + (status.toString().startsWith("Error") && 'fail')}>{status.toString()}</p>
    </>
}
