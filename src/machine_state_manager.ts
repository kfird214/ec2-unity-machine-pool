import * as core from '@actions/core';
import { DescribeInstancesCommand, InstanceStateName, StartInstancesCommand, StopInstancesCommand } from '@aws-sdk/client-ec2';
import { ec2 } from './ec2';
import { IMachinesConfig, MachineConfig } from './UnityMachineConfig';
import { IAllocatorState } from './Allocator/IAllocatorState';

export async function fetchMachineState(instanceId: string): Promise<InstanceStateName> {
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

export async function isMachineRunning(instanceId: string): Promise<boolean> {
    return await fetchMachineState(instanceId) == InstanceStateName.running;
}

export async function startMachine(instanceId: string): Promise<void> {
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

export async function stopMachine(instanceId: string): Promise<void> {
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

/**
 * {@link https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_InstanceState.html|InstanceState}
 * 
 * {@link https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html|Instance Lifecycle}
 * 
 * @param state the aws ec2 instance state
 * @returns true if it is an invalid state for starting the machine
 */
export function isInvalidMachineState(state: InstanceStateName): boolean {
    return state == InstanceStateName.terminated || state == InstanceStateName.shutting_down;
}

export function isMachineStateRunningOrWillRun(state: InstanceStateName): boolean {
    return state == InstanceStateName.running || state == InstanceStateName.pending;
}

/**
 * validates the current state of the machines and the allocator state by checking aws ec2 instances
 * @param machinesConfig machines config
 * @param state current allocator state
 * @returns a valid allocator state or null if already valid
 */
export async function validateMachinesAllocatorState(machinesConfig: IMachinesConfig, state: IAllocatorState): Promise<IAllocatorState | null> {
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

        const startOrStarting = isMachineStateRunningOrWillRun(ec2State);

        if (startOrStarting && !hasAllocations) {
            core.warning(`Machine "${instanceId}" is running/pending but has no allocations. stoping it and removing from state`);
            await stopMachine(instanceId);
            delete newState.allocatedMachines[instanceId];
            stateChanged = true;
            continue;
        }

        if (!startOrStarting && hasAllocations) {
            core.warning(`Machine "${instanceId}" is not running/pending but has allocations. removing from state`);
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
