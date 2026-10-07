import * as React from '@theia/core/shared/react';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { Message } from '@theia/core/lib/browser';
import { createTutorTestCaseId, TutorTestCase, TutorTestMatchMode } from '../common/tutor-test-case-schema';
import { TutorTestContribution } from './tutor-test-contribution';

@injectable()
export class TestWidget extends ReactWidget {

    static readonly ID = 'test:widget';
    static readonly LABEL = 'Test Widget';

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @inject(TutorTestContribution)
    protected readonly tutorTestContribution!: TutorTestContribution;

    protected testCases: TutorTestCase[] = [];
    protected loadErrorMessage: string | undefined;
    protected isBusy = false;
    protected hasUnsavedChanges = false;

    @postConstruct()
    protected init(): void {
        this.doInit();
    }

    protected async doInit(): Promise<void> {
        this.id = TestWidget.ID;
        this.title.label = TestWidget.LABEL;
        this.title.caption = TestWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-vial';
        await this.reload();
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        const htmlElement = document.getElementById('tutor-test-add-case');
        if (htmlElement) {
            htmlElement.focus();
        }
    }

    protected async reload(): Promise<void> {
        this.isBusy = true;
        this.update();

        try {
            const loadResult = await this.tutorTestContribution.loadPersistedTestCases();
            this.testCases = loadResult.testCases;
            this.loadErrorMessage = loadResult.errorMessage;
            this.hasUnsavedChanges = false;
        } catch (error) {
            this.loadErrorMessage = error instanceof Error ? error.message : String(error);
        } finally {
            this.isBusy = false;
            this.update();
        }
    }

    protected addTestCase(): void {
        const existingIds = new Set(this.testCases.map(testCase => testCase.id));
        const newTestCase: TutorTestCase = {
            id: createTutorTestCaseId(existingIds),
            title: `New Test Case ${this.testCases.length + 1}`,
            input: '',
            expectedOutput: '',
            matchMode: 'equals'
        };
        this.testCases = [...this.testCases, newTestCase];
        this.hasUnsavedChanges = true;
        this.update();
    }

    protected removeTestCase(id: string): void {
        this.testCases = this.testCases.filter(testCase => testCase.id !== id);
        this.hasUnsavedChanges = true;
        this.update();
    }

    protected updateTestCase(index: number, key: keyof TutorTestCase, value: string): void {
        const updated = [...this.testCases];
        if (key === 'matchMode') {
            updated[index] = {
                ...updated[index],
                matchMode: value as TutorTestMatchMode
            };
        } else {
            updated[index] = {
                ...updated[index],
                [key]: value
            };
        }
        this.testCases = updated;
        this.hasUnsavedChanges = true;
        this.update();
    }

    protected async save(): Promise<void> {
        this.isBusy = true;
        this.update();

        try {
            const loadResult = await this.tutorTestContribution.savePersistedTestCases(this.testCases);
            this.loadErrorMessage = loadResult.errorMessage;
            this.hasUnsavedChanges = false;
            this.messageService.info('Tutor test cases saved.');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.loadErrorMessage = message;
            this.messageService.error(message);
        } finally {
            this.isBusy = false;
            this.update();
        }
    }

    render(): React.ReactElement {
        return <div id='widget-container' className='tutor-tests-container'>
            <h2>Tutor Test Cases</h2>
            <div className='tutor-tests-toolbar'>
                <button id='tutor-test-add-case' className='theia-button' disabled={this.isBusy} onClick={() => this.addTestCase()}>
                    Add Test Case
                </button>
                <button className='theia-button secondary' disabled={this.isBusy || !this.hasUnsavedChanges} onClick={() => this.save()}>
                    Save
                </button>
                <button className='theia-button secondary' disabled={this.isBusy} onClick={() => this.reload()}>
                    Reload
                </button>
            </div>
            {this.loadErrorMessage &&
                <div className='alert'>
                    {this.loadErrorMessage}
                    <small>Fix the JSON file first if it is malformed, then press Reload.</small>
                </div>
            }
            <div className='tutor-tests-list'>
                {this.testCases.map((testCase, index) => <div className='tutor-test-case' key={testCase.id}>
                    <div className='tutor-test-case-header'>
                        <strong>{testCase.id}</strong>
                        <button className='theia-button danger' disabled={this.isBusy} onClick={() => this.removeTestCase(testCase.id)}>
                            Remove
                        </button>
                    </div>
                    <label>
                        Title
                        <input value={testCase.title} onChange={event => this.updateTestCase(index, 'title', event.target.value)} />
                    </label>
                    <label>
                        Input
                        <textarea value={testCase.input} rows={3} onChange={event => this.updateTestCase(index, 'input', event.target.value)} />
                    </label>
                    <label>
                        Expected Output
                        <textarea value={testCase.expectedOutput} rows={3} onChange={event => this.updateTestCase(index, 'expectedOutput', event.target.value)} />
                    </label>
                    <label>
                        Match Mode
                        <select value={testCase.matchMode} onChange={event => this.updateTestCase(index, 'matchMode', event.target.value)}>
                            <option value='equals'>equals</option>
                            <option value='contains'>contains</option>
                        </select>
                    </label>
                </div>)}
            </div>
        </div>;
    }
}
