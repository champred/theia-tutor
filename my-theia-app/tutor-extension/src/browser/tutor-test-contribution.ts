import { CommandContribution, CommandRegistry, ILogger, URI } from '@theia/core';
import { inject, injectable, interfaces, named, postConstruct } from '@theia/core/shared/inversify';
import { TestContribution, TestItem, TestRunProfileKind, TestService } from '@theia/test/lib/browser/test-service';
import { TutorTestCase } from '../common/tutor-test-case-schema';
import { TutorTestRunnerService } from '../common/tutor-test-runner-service';
import { TestControllerImpl, TestItemImpl, TestRunImpl } from './test-controller';
import { TutorTestCaseLoadResult, TutorTestCaseStore } from '../common/tutor-test-case-store';
import { ChatService } from '@theia/ai-chat';

export namespace TutorTestCommands {
    export const reloadTestCases = {
        id: 'tutor-tests.reload-test-cases',
        label: 'Reload Tutor Test Cases',
        category: 'Tutor'
    };
}

@injectable()
export class TutorTestContribution implements TestContribution, CommandContribution {
    @inject(TutorTestCaseStore)
    protected readonly testCaseStore!: TutorTestCaseStore;

    @inject(TutorTestRunnerService)
    protected readonly testRunnerService!: TutorTestRunnerService;

    @inject(ILogger) @named('tutor-extension:TutorTestContribution')
    protected readonly logger!: ILogger;

    @inject(ChatService)
    protected readonly chatService!: ChatService

    protected readonly testController = new TestControllerImpl('TutorTestController', 'Tutor Test Controller');
    protected nextRunId = 0;

    @postConstruct()
    protected init(): void {
        this.reloadControllerFromFile().catch(error => {
            this.logger.error('Failed to initialize tutor tests.', error);
        });
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(TutorTestCommands.reloadTestCases, {
            execute: async (): Promise<TutorTestCaseLoadResult> => this.reloadControllerFromFile()
        });
    }

    registerTestControllers(service: TestService): void {
        this.testController.addProfile({
            kind: TestRunProfileKind.Run,
            label: 'Run Tutor Test Cases',
            isDefault: true,
            canConfigure: false,
            tag: 'tutor-tests',
            run: (name: string, included: readonly TestItem[], excluded: readonly TestItem[]) => {
                const runId = this.nextRunId++;
                const runItems = this.collectRunnableItems(included, excluded);
                const testRun = new TestRunImpl(
                    this.testController,
                    `tutor-run-id-${runId}`,
                    name || `tutor-run-${runId}`,
                    runItems,
                    this.testRunnerService
                );
                this.testController.addRun(testRun);
                let completed = 0;
                testRun.onDidChangeTestOutput(_ => {
                    const sessId = this.chatService.getActiveSession()?.id;
                    if (++completed === runItems.length && sessId) {
                        this.chatService.sendRequest(sessId, {
                            text: testRun.getOutput().map(o => o.output).join('')
                        })
                    }
                });
            },
            configure: (): void => {
                // no configuration yet
            }
        });

        service.registerTestController(this.testController);
    }

    async loadPersistedTestCases(): Promise<TutorTestCaseLoadResult> {
        return this.testCaseStore.load();
    }

    async savePersistedTestCases(testCases: readonly TutorTestCase[]): Promise<TutorTestCaseLoadResult> {
        await this.testCaseStore.save(testCases);
        return this.reloadControllerFromFile();
    }

    async reloadControllerFromFile(): Promise<TutorTestCaseLoadResult> {
        const loadResult = await this.testCaseStore.load();
        if (loadResult.errorMessage && loadResult.malformedFile) {
            this.logger.error(loadResult.errorMessage);
            return loadResult;
        }

        const fileUri = loadResult.fileUri;
        if (fileUri) {
            const grouped = this.groupByPrefix(fileUri, loadResult.testCases);
            this.testController.replaceAll(grouped);
        }
        return loadResult;
    }

    protected toTestItem(fileUri: URI, testCase: TutorTestCase, index: number): TestItemImpl {
        const testItem = new TestItemImpl(fileUri, testCase.id);
        testItem.testCase = testCase;
        testItem.label = testCase.title;
        testItem.description = `${testCase.matchMode} matcher`;
        testItem.range = {
            start: { line: index + 3, character: 0 },
            end: { line: index + 3, character: Math.max(testCase.title.length, 1) }
        };
        return testItem;
    }

    protected collectRunnableItems(included: readonly TestItem[], excluded: readonly TestItem[]): TestItemImpl[] {
        const excludedIds = new Set(excluded.map(item => item.id));
        const allLeafItems: TestItemImpl[] = [];

        const collectLeafs = (items: readonly TestItemImpl[]) => {
            for (const item of items) {
                if (item.tests.length === 0 && item.testCase) {
                    allLeafItems.push(item);
                } else {
                    collectLeafs(item.tests as TestItemImpl[]);
                }
            }
        };

        collectLeafs(this.testController.tests);

        if (included.length === 0) {
            return allLeafItems.filter(item => !excludedIds.has(item.id));
        }

        const includedIds = new Set<string>();
        included.forEach(item => {
            if (item instanceof TestItemImpl && item.tests.length > 0) {
                const recurse = (node: TestItemImpl) => {
                    if (node.tests.length === 0 && node.testCase) {
                        includedIds.add(node.id);
                    } else {
                        node.tests.forEach(child => recurse(child as TestItemImpl));
                    }
                };
                recurse(item);
                return;
            }
            includedIds.add(item.id);
        });

        return allLeafItems.filter(item => includedIds.has(item.id) && !excludedIds.has(item.id));
    }

    protected groupByPrefix(fileUri: URI, testCases: readonly TutorTestCase[]): TestItemImpl[] {
        const groups = new Map<string, TestItemImpl>();

        for (const [index, testCase] of testCases.entries()) {
            const prefix = testCase.title.split(':')[0]?.trim() ?? 'Other';

            let parent = groups.get(prefix);
            if (!parent) {
                parent = new TestItemImpl(fileUri, `group-${prefix.replace(/\s+/g, '-')}`);
                parent.label = prefix;
                parent.description = 'Task group';
                groups.set(prefix, parent);
            }

            const item = this.toTestItem(fileUri, testCase, index);
            parent._children.add(item); // same file/class can do this
        }

        return [...groups.values()];
    }
}

export function bindTutorTests(bind: interfaces.Bind): void {
    bind(TutorTestCaseStore).toSelf().inSingletonScope();
    bind(TutorTestContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(TutorTestContribution);
    bind(TestContribution).toService(TutorTestContribution);
}
