import { CancellationToken, CancellationTokenSource, Emitter, Event, URI } from '@theia/core';
import { Location, Range } from '@theia/core/shared/vscode-languageserver-protocol';
import { MarkdownString } from '@theia/core/lib/common/markdown-rendering';
import { SimpleObservableCollection, TreeCollection, observableProperty } from '@theia/test/lib/common/collections';
import {
    TestController, TestExecutionState, TestFailure, TestItem,
    TestOutputItem, TestRun, TestRunProfile, TestState, TestStateChangedEvent
} from '@theia/test/lib/browser/test-service';
import { AccumulatingTreeDeltaEmitter, CollectionDelta, TreeDelta, TreeDeltaBuilder } from '@theia/test/lib/common/tree-delta';
import { TutorTestCase } from '../common/tutor-test-case-schema';
import { TutorTestRunnerService } from '../common/tutor-test-runner-service';

export class TestItemCollection extends TreeCollection<string, TestItemImpl, TestItemImpl | TestControllerImpl> {
    override add(item: TestItemImpl): TestItemImpl | undefined {
        item.realParent = this.owner;
        return super.add(item);
    }

    clear() {
        for (let [key, _val] of this) {
            this.remove(key);
        }
    }
}

export class TestItemImpl implements TestItem {
    constructor(readonly uri: URI, readonly id: string) {
        this._children = new TestItemCollection(this, value => value.path, value => value?.deltaBuilder);
    }

    testCase: TutorTestCase | undefined;

    protected notifyPropertyChange(property: keyof TestItemImpl, value: unknown): void {
        const changedValue: { [key: string]: unknown } = {};
        changedValue[property] = value as never;
        if (this.path) {
            this.deltaBuilder?.reportChanged(this.path, changedValue);
        }
    }

    _deltaBuilder: TreeDeltaBuilder<string, TestItemImpl> | undefined;
    get deltaBuilder(): TreeDeltaBuilder<string, TestItemImpl> | undefined {
        if (this._deltaBuilder) {
            return this._deltaBuilder;
        } else if (this.realParent) {
            this._deltaBuilder = this.realParent.deltaBuilder;
            return this._deltaBuilder;
        }
        return undefined;
    }

    _path: string[] | undefined;

    get path(): string[] {
        if (this._path) {
            return this._path;
        }
        if (this.realParent instanceof TestItemImpl) {
            this._path = [...this.realParent.path, this.id];
            return this._path;
        }
        return [this.id];
    }

    private _parent?: TestItemImpl | TestControllerImpl;
    get realParent(): TestItemImpl | TestControllerImpl | undefined {
        return this._parent;
    }

    set realParent(value: TestItemImpl | TestControllerImpl | undefined) {
        this.iterate(item => {
            item._path = undefined;
            return true;
        });
        this._parent = value;
    }

    get parent(): TestItem | undefined {
        const realParent = this.realParent;
        if (realParent instanceof TestItemImpl) {
            return realParent;
        }
        return undefined;
    }

    get controller(): TestControllerImpl | undefined {
        if (this.realParent instanceof TestItemImpl) {
            return this.realParent.controller;
        }
        return this.realParent;
    }

    protected iterate(toDo: (value: TestItemImpl) => boolean): boolean {
        if (!toDo(this)) {
            return false;
        }
        for (let i = 0; i < this._children.values.length; i++) {
            if (!this._children.values[i].iterate(toDo)) {
                return false;
            }
        }
        return true;
    }

    @observableProperty('notifyPropertyChange')
    label: string = '';

    @observableProperty('notifyPropertyChange')
    range?: Range;

    @observableProperty('notifyPropertyChange')
    sortKey?: string | undefined;

    @observableProperty('notifyPropertyChange')
    tags: string[] = [];

    @observableProperty('notifyPropertyChange')
    busy: boolean = false;

    @observableProperty('notifyPropertyChange')
    canResolveChildren: boolean = false;

    @observableProperty('notifyPropertyChange')
    description?: string | undefined;

    @observableProperty('notifyPropertyChange')
    error?: string | MarkdownString | undefined;

    _children: TestItemCollection;
    get tests(): readonly TestItemImpl[] {
        return this._children.values;
    }

    resolveChildren(): void {
        // do nothing
    }
}

export class TestRunImpl implements TestRun {
    private readonly testStates = new Map<TestItem, TestState>();
    private readonly outputIndices = new Map<TestItem, number[]>();
    private readonly outputs: TestOutputItem[] = [];
    private readonly onDidChangePropertyEmitter = new Emitter<{ name?: string; isRunning?: boolean; }>();
    onDidChangeProperty: Event<{ name?: string; isRunning?: boolean; }> = this.onDidChangePropertyEmitter.event;
    private cts: CancellationTokenSource;

    constructor(
        readonly controller: TestControllerImpl,
        readonly id: string,
        name: string,
        private readonly testItems: readonly TestItemImpl[],
        private readonly testRunnerService: TutorTestRunnerService
    ) {
        this.name = name;
        this.isRunning = false;
        this.cts = new CancellationTokenSource();
        this.start();
    }

    private async start(): Promise<void> {
        this.isRunning = true;
        for (const item of this.testItems) {
            if (this.cts.token.isCancellationRequested) {
                this.setTestState(item, { state: TestExecutionState.Skipped });
                continue;
            }
            await this.runOne(item, this.cts.token);
        }
        this.ended();
    }

    private async runOne(item: TestItemImpl, token: CancellationToken): Promise<void> {
        if (!item.testCase) {
            this.setTestState(item, this.toErrorState(item, 'Test case data is missing.'));
            return;
        }

        this.setTestState(item, { state: TestExecutionState.Queued });
        this.setTestState(item, { state: TestExecutionState.Running });

        try {
            const result = await this.testRunnerService.runTestCase(item.testCase);
            if (token.isCancellationRequested) {
                this.setTestState(item, { state: TestExecutionState.Skipped });
                this.appendOutput('Execution cancelled.', undefined, item);
                return;
            }

            result.output.forEach(line => this.appendOutput(line, undefined, item));
            if (result.state === 'passed') {
                this.setTestState(item, { state: TestExecutionState.Passed });
                return;
            }

            if (result.state === 'failed') {
                this.setTestState(item, this.toFailureState(item, result.message ?? 'Test failed.'));
                return;
            }

            this.setTestState(item, this.toErrorState(item, result.message ?? 'Test runner error.'));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.setTestState(item, this.toErrorState(item, message));
        }
    }

    private toFailureState(item: TestItemImpl, message: string): TestFailure {
        return {
            state: TestExecutionState.Failed,
            duration: 0,
            messages: [
                {
                    message: {
                        value: message
                    },
                    location: item.range ? {
                        uri: item.uri.toString(),
                        range: item.range
                    } : undefined
                }
            ]
        };
    }

    private toErrorState(item: TestItemImpl, message: string): TestFailure {
        return {
            state: TestExecutionState.Errored,
            duration: 0,
            messages: [
                {
                    message: {
                        value: message
                    },
                    location: item.range ? {
                        uri: item.uri.toString(),
                        range: item.range
                    } : undefined
                }
            ]
        };
    }

    @observableProperty('notifyPropertyChange')
    isRunning: boolean;

    @observableProperty('notifyPropertyChange')
    name: string;

    protected notifyPropertyChange(property: 'name' | 'isRunning', value: unknown): void {
        const changedValue: { name?: string; isRunning?: boolean; } = {};
        if (property === 'name') {
            changedValue.name = String(value);
        } else {
            changedValue.isRunning = Boolean(value);
        }
        this.onDidChangePropertyEmitter.fire(changedValue);
    }

    cancel(): void {
        this.cts.cancel();
    }

    getTestState(item: TestItem): TestState | undefined {
        return this.testStates.get(item);
    }

    private readonly onDidChangeTestStateEmitter = new Emitter<TestStateChangedEvent[]>();
    onDidChangeTestState: Event<TestStateChangedEvent[]> = this.onDidChangeTestStateEmitter.event;

    getOutput(item?: TestItem | undefined): readonly TestOutputItem[] {
        if (!item) {
            return this.outputs;
        }
        const indices = this.outputIndices.get(item);
        if (!indices) {
            return [];
        }
        return indices.map(index => this.outputs[index]);
    }

    private readonly onDidChangeTestOutputEmitter = new Emitter<[TestItem | undefined, TestOutputItem][]>();
    onDidChangeTestOutput: Event<[TestItem | undefined, TestOutputItem][]> = this.onDidChangeTestOutputEmitter.event;

    setTestState(test: TestItemImpl, newState: TestState): void {
        const oldState = this.testStates.get(test);
        this.testStates.set(test, newState);
        this.onDidChangeTestStateEmitter.fire([{
            oldState,
            newState,
            test
        }]);
    }

    appendOutput(text: string, location?: Location, item?: TestItem): void {
        const output = {
            output: `${text}\n`,
            location
        };
        this.outputs.push(output);
        if (item) {
            let indices = this.outputIndices.get(item);
            if (!indices) {
                indices = [];
                this.outputIndices.set(item, indices);
            }
            indices.push(this.outputs.length - 1);
        }
        this.onDidChangeTestOutputEmitter.fire([[item, output]]);
    }

    get items(): readonly TestItem[] {
        return [...this.testStates.keys()];
    }

    ended(): void {
        const stateEvents: TestStateChangedEvent[] = [];
        this.testStates.forEach((state, item) => {
            if (state.state <= TestExecutionState.Running) {
                stateEvents.push({
                    oldState: state,
                    newState: undefined,
                    test: item
                });
                this.testStates.delete(item);
            }
        });
        if (stateEvents.length > 0) {
            this.onDidChangeTestStateEmitter.fire(stateEvents);
        }
        this.isRunning = false;
    }
}

export class TestControllerImpl implements TestController {
    private readonly profilesCollection = new SimpleObservableCollection<TestRunProfile>();
    private readonly runsCollection = new SimpleObservableCollection<TestRun>();
    readonly deltaBuilder = new AccumulatingTreeDeltaEmitter<string, TestItemImpl>(300);
    items = new TestItemCollection(this, item => item.path, () => this.deltaBuilder);

    constructor(readonly id: string, readonly label: string) {
    }

    refreshTests(_token: CancellationToken): Promise<void> {
        return Promise.resolve();
    }

    get testRunProfiles(): readonly TestRunProfile[] {
        return this.profilesCollection.values;
    }

    addProfile(profile: TestRunProfile): void {
        this.profilesCollection.add(profile);
    }

    onProfilesChanged: Event<CollectionDelta<TestRunProfile, TestRunProfile>> = this.profilesCollection.onChanged;

    get testRuns(): readonly TestRun[] {
        return this.runsCollection.values;
    }

    addRun(run: TestRun): void {
        this.runsCollection.add(run);
    }

    onRunsChanged: Event<CollectionDelta<TestRun, TestRun>> = this.runsCollection.onChanged;

    get tests(): readonly TestItemImpl[] {
        return this.items.values;
    }

    onItemsChanged: Event<TreeDelta<string, TestItemImpl>[]> = this.deltaBuilder.onDidFlush;

    canResolveChildren: boolean = false;

    resolveChildren(_item?: TestItem): void {
        // nothing to do
    }

    clearRuns(): void {
        this.runsCollection.clear();
    }

    replaceAll(items: readonly TestItemImpl[]): void {
        this.items.clear();
        items.forEach(item => this.items.add(item));
    }
}
