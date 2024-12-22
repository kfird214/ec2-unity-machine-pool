import * as core from '@actions/core';
import assert from 'assert';
import { AllocatorS3 } from './Allocator/AllocatorS3';
import { IMachineAllocation } from './Allocator/IMachineAllocation';
import { GithubInput } from './github-input';
import { input } from './input';
import { isMachineRunning, startMachine, stopMachine, validateMachinesAllocatorState } from './machine_state_manager';
import { IMachineConfigFetcher } from './MachineConfigFetcher/IMachineConfigFetcher';
import { MachineConfigFetcherS3 } from './MachineConfigFetcher/MachineConfigFetcherS3';
import { IStateFetcher } from './StateFetcher/IStateFetcher';
import { StateFetchers3 } from './StateFetcher/StateFetcherS3';
import { IAllocator } from './Allocator/IAllocator';
import { AllocatorDynamo } from './Allocator/AllocatorDynamo';
import { AllocationNotfound } from './Allocator/AllocationNotfound';

async function run(input: GithubInput) {
    core.debug('Starting the action');

    const machineConfigFetcher: IMachineConfigFetcher = await MachineConfigFetcherS3.Create();
    const machinesConfig = await machineConfigFetcher.fetchMachinesConfig();

    core.startGroup('Machines Config');
    core.info(JSON.stringify(machinesConfig, null, 2));
    core.endGroup();

    // const stateFetcher: IStateFetcher = await StateFetchers3.Create();
    // const allocator: IAllocator = await AllocatorS3.Create(machinesConfig, stateFetcher);
    const allocator: IAllocator = await AllocatorDynamo.Create(machinesConfig);

    if (allocator instanceof AllocatorS3) {
        const newState = await validateMachinesAllocatorState(machinesConfig, allocator.loadedState);
        if (newState) {
            core.notice('Saving new state');
            await allocator.forceSaveValidState(newState);
        }
        else {
            core.debug('State is valid');
        }
    }

    if (input.allocateMachine) {
        await allocateMachine(allocator);
    }
    else {
        assert(input.allocationId, 'AllocationId is required when allocateMachine is false');
        const machineAll = await deallocateMachine(input.allocationId, allocator);

        if (machineAll === null) {
            return;
        }

        core.setOutput('allocation_id', machineAll.allocationId);
        core.setOutput('instance_id', machineAll.instanceId);
        core.setOutput('instance_name', machineAll.instanceName);
    }
}

async function deallocateMachine(allocationId: string, allocator: IAllocator): Promise<IMachineAllocation | null> {
    core.info(`Deallocating machine with allocationId "${allocationId}"`);

    try {
        const machine = await allocator.free(allocationId);
        const allocCount = await allocator.instanceAllocationCount(machine.instanceId);
        if (allocCount > 0) {
            core.debug(`Machine "${machine.instanceId}" still has ${allocCount} allocations`);
        }
        else {
            core.debug(`Machine "${JSON.stringify(machine)}" has no more allocations, stopping it`);
            await stopMachine(machine.instanceId);
        }

        return machine;
    } catch (error) {
        if (error instanceof AllocationNotfound) {
            core.warning(`Allocation "${allocationId}" not found`);
            return null;
        }
        else {
            throw error;
        }
    }
}

async function allocateMachine(allocator: IAllocator): Promise<IMachineAllocation> {
    core.info('Allocating a new machine');

    const allocation = await allocator.allocate();

    if (!allocation)
        throw new Error('No machines available to allocate');

    core.setOutput("allocation_id", allocation.allocationId);
    core.setOutput('instance_id', allocation.instanceId);
    core.setOutput('instance_name', allocation.instanceName);

    core.info(`Allocating machine "${JSON.stringify(allocation)}"`);
    const isRunning = await isMachineRunning(allocation.instanceId);

    if (isRunning) {
        core.debug(`Machine "${JSON.stringify(allocation)}" is already running`);
    }
    else {
        core.notice(`Starting machine "${allocation.instanceId}"`);
        try {
            await startMachine(allocation.instanceId);
        } catch (error) {
            core.error(`Failed to start machine "${allocation.instanceId}". deallocating it`);
            await deallocateMachine(allocation.allocationId, allocator);
            console.error(error);
        }
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
