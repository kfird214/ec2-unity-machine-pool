import * as core from '@actions/core';
import * as crypto from 'crypto';
import { IMachinesConfig } from '../UnityMachineConfig';
import { IAllocatorState } from './IAllocatorState';
import { IMachineAllocation } from './IMachineAllocation';
import { IStateFetcher } from '../StateFetcher/IStateFetcher';
import { IAllocator } from './IAllocator';
import { AllocationNotfound } from './AllocationNotfound';


export class AllocatorS3 implements IAllocator {
    private state: IAllocatorState = { allocatedMachines: {} };
    private machinesConfig: IMachinesConfig;
    private stateFetcher: IStateFetcher;

    public get loadedState(): IAllocatorState { return this.state; }

    private constructor(machinesConfig: IMachinesConfig, sateFetcher: IStateFetcher) {
        this.machinesConfig = machinesConfig;
        this.stateFetcher = sateFetcher;
    }

    public static async Create(machinesConfig: IMachinesConfig, sateFetcher: IStateFetcher): Promise<AllocatorS3> {
        const allocator = new AllocatorS3(machinesConfig, sateFetcher);
        await allocator.loadAllocatorState();
        return allocator;
    }

    public async forceSaveValidState(IAllocatorState: IAllocatorState): Promise<void> {
        this.state = IAllocatorState;
        await this.saveAllocatorState();
    }

    public async allocate(): Promise<IMachineAllocation> {
        await this.loadAllocatorState();

        try {
            let freeInstanceId = this.findFreeMachine();

            if (freeInstanceId != null) {
                const allocation = this.addAllocation(freeInstanceId);
                core.debug(`Found free machine "${JSON.stringify(allocation)}"`);
                return allocation;
            }
            else {
                core.debug(`No free machine found, trying to find a machine with least reuse count`);
                const minReuseCountAlloc = this.findMachineWithMinReuseCount();

                if (minReuseCountAlloc == null) {
                    core.debug(`No machine found with least reuse count`);
                    throw new Error('No machine found with least reuse count');
                }

                const allocation = this.addAllocation(minReuseCountAlloc.instanceId, minReuseCountAlloc.reuseCount + 1);
                core.debug(`Found machine with least reuse count "${JSON.stringify(allocation)}"`);
                return allocation;
            }
        } finally {
            await this.saveAllocatorState();
        }
    }

    public async free(allocationId: string): Promise<IMachineAllocation> {
        await this.loadAllocatorState();

        try {
            for (const instanceId in this.state.allocatedMachines) {
                const allocations = this.state.allocatedMachines[instanceId];

                if (allocations == null)
                    continue;

                for (let i = 0; i < allocations.length; i++) {
                    const alloc = allocations[i];
                    if (alloc.allocationId == allocationId) {
                        const removed = allocations.splice(i, 1)[0];
                        core.debug(`Freed machine "${JSON.stringify(removed)}"`);
                        return removed;
                    }
                }
            }

            throw new AllocationNotfound(allocationId);
        } finally {
            await this.saveAllocatorState();
        }
    }

    public async instanceAllocationCount(instanceId: string): Promise<number> {
        const a = this.state.allocatedMachines[instanceId];
        return a != null ? a.length : 0;
    }

    private async saveAllocatorState(): Promise<void> {
        this.state = AllocatorS3.validateFetchedState(this.state);
        core.debug(`Saving allocator state "${JSON.stringify(this.state)}"`);

        await this.stateFetcher.saveAllocatorState(this.state);
    }

    private async loadAllocatorState(): Promise<IAllocatorState> {
        let state = await this.stateFetcher.fetchAllocatorState();
        this.state = AllocatorS3.validateFetchedState(state);

        core.startGroup('Allocator State');
        core.info(JSON.stringify(state, null, 2));
        core.endGroup();

        return state;
    }

    private static validateFetchedState(state: IAllocatorState): IAllocatorState {
        state = state ?? { allocatedMachines: {} };
        // state = structuredClone(state);
        state.allocatedMachines = state.allocatedMachines ?? {};

        // if allocated machines has empty arrays or null, remove them
        for (const instanceId in state.allocatedMachines) {
            if (!(instanceId in state.allocatedMachines))
                continue;

            if (!state.allocatedMachines[instanceId]) {
                const value = state.allocatedMachines[instanceId];
                delete state.allocatedMachines[instanceId];
                core.debug(`Removed allocated machine "${instanceId}" value was falsy "${JSON.stringify(value)}"`);
            }
            else if (Array.isArray(state.allocatedMachines[instanceId])) {
                if (state.allocatedMachines[instanceId]!.length == 0) {
                    const value = state.allocatedMachines[instanceId];
                    delete state.allocatedMachines[instanceId];
                    core.debug(`Removed allocated machine "${instanceId}" value was empty array "${JSON.stringify(value)}"`);
                }
            }
        }

        return state;
    }

    private pushAllocation(allocation: IMachineAllocation): void {
        if (!this.state.allocatedMachines[allocation.instanceId]) {
            this.state.allocatedMachines[allocation.instanceId] = [];
        }

        (this.state.allocatedMachines[allocation.instanceId] as any[]).push(allocation);
    }

    private findMachineWithMinReuseCount(): IMachineAllocation | null {
        let minReuseCount = null;
        let minReuseCountInstanceId = null;

        for (const machine of this.machinesConfig.machines) {
            const machineAllocs = this.state.allocatedMachines[machine.instanceId] ?? [];
            const activeAllocations = machineAllocs.length;
            const maxReuseCount = activeAllocations == 0 ? 0 : machineAllocs.sort((a, b) => a.reuseCount - b.reuseCount)[0].reuseCount;

            if (activeAllocations < (minReuseCount ?? Infinity)) {
                minReuseCount = activeAllocations;
                minReuseCountInstanceId = machine.instanceId;
            }
        }

        if (minReuseCount == null || minReuseCountInstanceId == null)
            return null;

        return this.state.allocatedMachines[minReuseCountInstanceId]?.sort((a, b) => a.reuseCount - b.reuseCount)[0] ?? null;
    }

    private findFreeMachine(): string | null {
        // const allocatedInstanceIds = this.allocatedMachines.map(m => m.instanceId);
        const distinctAllocatedInstanceIds = Object.keys(this.state.allocatedMachines);
        const allocationsIdsThatHasAllocations = distinctAllocatedInstanceIds.filter(instanceId => (this.state.allocatedMachines[instanceId]?.length ?? 0) > 0);

        core.debug(`Allocated instance ids: ${JSON.stringify([...distinctAllocatedInstanceIds])}`);

        for (const machine of this.machinesConfig.machines) {
            // core.debug(`Checking machine "${machine.instanceId}"`);
            if (!allocationsIdsThatHasAllocations.includes(machine.instanceId)) {
                // core.debug(`Found free machine "${machine.instanceId}"`);
                return machine.instanceId;
            }
            // core.debug(`Machine "${machine.instanceId}" is already allocated`);
        }

        return null;
    }

    private addAllocation(instanceId: string, reuseCount: number = 0): IMachineAllocation {
        const allocation = this.newAllocation(instanceId, reuseCount);
        this.pushAllocation(allocation);
        return allocation;
    }

    private newAllocation(instanceId: string, reuseCount: number = 0): IMachineAllocation {
        const machine = this.machinesConfig.machines.find(m => m.instanceId == instanceId);

        return {
            allocationId: crypto.randomUUID(),
            instanceId: instanceId,
            reuseCount: reuseCount,
            instanceName: machine?.instanceName,
        };
    }
}
