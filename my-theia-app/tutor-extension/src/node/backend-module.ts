import { ConnectionHandler, RpcConnectionHandler } from '@theia/core';
import { ContainerModule } from '@theia/core/shared/inversify';
import { TutorTestRunnerService, tutorTestRunnerServicePath } from '../common/tutor-test-runner-service';
import {
    DeterministicTutorTestCaseExecutor,
    TutorTestCaseExecutor,
    TutorTestRunnerServiceImpl
} from './tutor-test-runner-service-impl';

export default new ContainerModule(bind => {
    bind(TutorTestCaseExecutor).to(DeterministicTutorTestCaseExecutor).inSingletonScope();
    bind(TutorTestRunnerService).to(TutorTestRunnerServiceImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new RpcConnectionHandler(tutorTestRunnerServicePath, () => ctx.container.get<TutorTestRunnerService>(TutorTestRunnerService))
    ).inSingletonScope();
});
