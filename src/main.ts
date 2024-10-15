import * as core from '@actions/core';
import { DescribeInstancesCommand, EC2Client, InstanceStateName, StartInstancesCommand, StopInstancesCommand } from '@aws-sdk/client-ec2';
import assert from 'assert';
import { IMachinesConfig, MachineConfig } from './UnityMachineConfig';
import { Allocator, IAllocatorState, IMachineAllocation } from './Allocator';
import { GithubInput } from './github-input';
import { awsUnityMachinesAllocationState, awsUnityMachinesConfigFile, input } from './input';
import { s3 } from './s3';

const ec2 = new EC2Client({
    region: input.awsRegion,
    credentials: {
        accessKeyId: input.awsAccessKeyId,
        secretAccessKey: input.awsSecretAccessKey,
    },
});

async function fetchMachinesConfig(): Promise<IMachinesConfig> {
    const data = await s3.getObject({
        Bucket: input.awsMachinesBucket,
        Key: awsUnityMachinesConfigFile,
    });

    if (!data.Body)
        throw new Error(`Failed to get config from s3 file "${awsUnityMachinesConfigFile}" at "${input.awsMachinesBucket}"`);

    try {
        const body = await data.Body.transformToString();
        const config = JSON.parse(body);

        if (config.machines.length == 0)
            throw new Error(`No machines found in config`);

        return config;
    } catch (error) {
        throw new Error(`Failed to parse config from s3 file "${awsUnityMachinesConfigFile}" at "${input.awsMachinesBucket}" ` + (error ?? '').toString());
    }
}

async function createAllocatorStateIfNotExists(defaultState: IAllocatorState | null = null) {
    let exists = false;
    try {
        const headData = await s3.headObject({
            Bucket: input.awsMachinesBucket,
            Key: awsUnityMachinesAllocationState,
        });

        if (!headData)
            throw new Error(`Failed to head bucket "${input.awsMachinesBucket}"`);

        exists = true;
    } catch (error) {
        exists = false;
    }

    if (exists) {
        core.debug(`Bucket "${input.awsMachinesBucket}" already exists`);
        return;
    }

    const state = defaultState ?? { allocatedMachines: [] };
    core.notice(`Creating bucket "${input.awsMachinesBucket}" with default state="${JSON.stringify(state)}"`);

    const res = await s3.putObject({
        Bucket: input.awsMachinesBucket,
        Key: awsUnityMachinesAllocationState,
        Body: JSON.stringify(state, null, 2),
    });
}

async function createBucketIfNotExists(): Promise<void> {
    let exists = false;
    try {
        await s3.headBucket({
            Bucket: input.awsMachinesBucket,
        });
        exists = true;
        core.info(`Bucket "${input.awsMachinesBucket}" already exists`);
    } catch (error) {
        core.debug(`Bucket "${input.awsMachinesBucket}" does not exist (error: ${error})`);
        exists = false;
    }

    if (!exists) {
        core.notice(`Creating bucket "${input.awsMachinesBucket}"`);
        await s3.createBucket({
            Bucket: input.awsMachinesBucket,
        });
    }
}

async function fetchMachineState(instanceId: string): Promise<InstanceStateName> {
    const data = await ec2.send(new DescribeInstancesCommand({
        InstanceIds: [instanceId],
    }));

    if (!data.Reservations || data.Reservations.length == 0)
        throw new Error(`No reservations found for instance "${instanceId}"`);

    const instance = data.Reservations[0].Instances?.[0];
    if (!instance)
        throw new Error(`No instances found for instance "${instanceId}"`);

    const stateName = instance.State?.Name;

    if (!stateName)
        throw new Error(`No state found for instance "${instanceId}"`);

    return stateName;
}

async function isMachineRunning(instanceId: string): Promise<boolean> {
    return await fetchMachineState(instanceId) == InstanceStateName.running;
}

async function startMachine(instanceId: string): Promise<void> {
    const data = await ec2.send(new StartInstancesCommand({
        InstanceIds: [instanceId],
    }));

    if (!data.StartingInstances || data.StartingInstances.length == 0)
        throw new Error(`Failed to start instance "${instanceId}"`);

    const instance = data.StartingInstances[0];
    if (!instance)
        throw new Error(`Failed to start instance "${instanceId}"`);

    // if (instance.CurrentState?.Name != InstanceStateName.running)
    //     throw new Error(`Failed to start instance "${instanceId}"`);

    if (instance.InstanceId != instanceId)
        throw new Error(`Started different instance id "${instanceId}"!="${instance.InstanceId}"`);
}

async function stopMachine(instanceId: string): Promise<void> {
    const data = await ec2.send(new StopInstancesCommand({
        InstanceIds: [instanceId],
    }));

    if (!data.StoppingInstances || data.StoppingInstances.length == 0)
        throw new Error(`Failed to stop instance "${instanceId}"`);

    const instance = data.StoppingInstances[0];
    if (!instance)
        throw new Error(`Failed to stop instance "${instanceId}"`);

    // if (instance.CurrentState?.Name != InstanceStateName.stopped)
    //     throw new Error(`Failed to stop instance "${instanceId}"`);

    if (instance.InstanceId != instanceId)
        throw new Error(`Stopped different instance id "${instanceId}"!="${instance.InstanceId}"`);

    core.notice(`Stopped instance "${instanceId}"`);
}

function isInvalidMachineState(state: InstanceStateName): boolean {
    return state == InstanceStateName.terminated || state == InstanceStateName.shutting_down;
}

/**
 * validates the current state of the machines and the allocator state by checking aws ec2 instances
 * @param machinesConfig machines config
 * @param state current allocator state
 * @returns a valid allocator state or null if already valid
 */
async function validateMachinesAllocatorState(machinesConfig: IMachinesConfig, state: IAllocatorState): Promise<IAllocatorState | null> {
    const areMachinesRunningTasks = machinesConfig.machines.map(m => (async () => {
        const ec2State = await fetchMachineState(m.instanceId);
        return { config: m, ec2State };
    })());

    const areMachinesRunning = await Promise.all(areMachinesRunningTasks);

    // { instanceId: boolean }
    const machineStateVsActualState: { [key: string]: { ec2State: InstanceStateName | null, hasAllocations: boolean, config: MachineConfig } } = {};
    for (const machine of machinesConfig.machines) {
        const anyAllocationHasMachine = Object.entries(state.allocatedMachines)
            .filter(([allocId, allocs]) => !!allocs)
            .some(([allocId, allocs]) => allocs?.some(alloc => alloc.instanceId == machine.instanceId));

        const findMachine = areMachinesRunning.find(m => m.config.instanceId == machine.instanceId);

        machineStateVsActualState[machine.instanceId] = {
            config: machine,
            ec2State: findMachine?.ec2State ?? null,
            hasAllocations: anyAllocationHasMachine,
        };
    }

    core.startGroup('Machines has allocations');
    core.info(JSON.stringify(machineStateVsActualState, null, 2));
    core.endGroup();

    const newState = JSON.parse(JSON.stringify(state)) as IAllocatorState;
    // const newState = structuredClone(state) as IAllocatorState;

    core.debug('Validating machines state');
    let stateChanged = false;
    for (const [instanceId, { ec2State, hasAllocations, config }] of Object.entries(machineStateVsActualState)) {
        if (ec2State == null || isInvalidMachineState(ec2State)) {
            core.warning(`Machine "${instanceId}" is in an invalid state "${ec2State}". removing from state`);
            delete newState.allocatedMachines[instanceId];
            stateChanged = true;
            continue;
        }
        
        const running = ec2State == InstanceStateName.running;

        if (running && !hasAllocations) {
            core.warning(`Machine "${instanceId}" is running but has no allocations. stoping it and removing from state`);
            await stopMachine(instanceId);
            delete newState.allocatedMachines[instanceId];
            stateChanged = true;
            continue;
        }

        if (!running && hasAllocations) {
            core.warning(`Machine "${instanceId}" is not running but has allocations. removing from state`);
            delete newState.allocatedMachines[instanceId];
            stateChanged = true;
            continue;
        }

        core.debug(`Machine "${instanceId}" is in a valid state`);
    }

    if (!stateChanged)
        return null;

    core.startGroup('New Allocator State');
    core.info(JSON.stringify(newState, null, 2));
    core.endGroup();

    return newState;
}

async function run(input: GithubInput) {
    core.debug('Starting the action');
    await createBucketIfNotExists();
    await createAllocatorStateIfNotExists();

    const machinesConfig = await fetchMachinesConfig();

    core.startGroup('Machines Config');
    core.info(JSON.stringify(machinesConfig, null, 2));
    core.endGroup();

    const allocator = await Allocator.New(machinesConfig);

    {
        const newState = await validateMachinesAllocatorState(machinesConfig, allocator.loadedState);
        if (newState) {
            core.notice('Saving new state');
            await allocator.forceSaveValidState(newState);
        }
        else {
            core.debug('State is valid');
        }
    }

    let allocationId: string;
    let machineAlloc: IMachineAllocation;
    if (input.allocateMachine) {
        machineAlloc = await allocateMachine(allocator);
        allocationId = machineAlloc.allocationId;
    }
    else {
        assert(input.allocationId, 'AllocationId is required when allocateMachine is false');
        machineAlloc = await deallocateMachine(input.allocationId, allocator);
        allocationId = input.allocationId;
    }

    core.setOutput('allocation_id', allocationId);
    core.setOutput('instance_id', machineAlloc.instanceId);
    core.setOutput('instance_name', machineAlloc.instanceName);
}

async function deallocateMachine(allocationId: string, allocator: Allocator): Promise<IMachineAllocation> {
    core.info(`Deallocating machine with allocationId "${allocationId}"`);

    const machine = await allocator.free(allocationId);

    const allocCount = allocator.instanceAllocationCount(machine.instanceId);
    if (allocCount > 0) {
        core.debug(`Machine "${machine.instanceId}" still has ${allocCount} allocations`);
    }
    else {
        core.debug(`Machine "${JSON.stringify(machine)}" has no more allocations, stopping it`);
        await stopMachine(machine.instanceId);
    }

    return machine;
}

async function allocateMachine(allocator: Allocator): Promise<IMachineAllocation> {
    core.info('Allocating a new machine');

    const allocation = await allocator.allocate(); // todo dealocate on error?

    if (!allocation)
        throw new Error('No machines available to allocate');

    core.info(`Allocating machine "${JSON.stringify(allocation)}"`);
    const isRunning = await isMachineRunning(allocation.instanceId);

    if (isRunning) {
        core.debug(`Machine "${JSON.stringify(allocation)}" is already running`);
    }
    else {
        core.notice(`Starting machine "${allocation.instanceId}"`);
        await startMachine(allocation.instanceId);
    }

    return allocation;
}

run(input)
    .then(result => {
        core.setOutput('result', 'success');
    })
    .catch(error => {
        core.setOutput('result', 'failure');
        core.setFailed(error?.message ?? 'Unknown error');
    });
