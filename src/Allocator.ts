import * as core from '@actions/core';
import * as crypto from 'crypto';
import { MachinesConfig } from './UnityMachineConfig';
import { s3 } from './s3';
import { awsUnityMachinesAllocationState, input } from './input';

export interface IMachineAllocation {
    /**
     * Randomly generated UUID for the allocation.
     */
    allocationId: string;

    /**
     * The AWS instanceId of the machine.
     */
    instanceId: string;

    /**
     * The count of the allocation of the same instaceId. 0 is first allocation.
     */
    reuseCount: number;
}

export interface IAllocatorState {
    allocatedMachines: {
        [allocationId: string]: IMachineAllocation[] | null | undefined;
    }
};

export class Allocator {
    private state: IAllocatorState = { allocatedMachines: {} };
    private machinesConfig: MachinesConfig;

    constructor(machinesConfig: MachinesConfig) {
        this.machinesConfig = machinesConfig;
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

            throw new Error(`Allocation with id "${allocationId}" not found`);
        } finally {
            await this.saveAllocatorState();
        }
    }

    public instanceAllocationCount(instanceId: string): number {
        const a = this.state.allocatedMachines[instanceId];
        return a != null ? a.length : 0;
    }

    private async saveAllocatorState(): Promise<void> {
        core.debug(`Saving allocator state "${JSON.stringify(this.state)}"`);

        await s3.putObject({
            Bucket: input.awsMachinesBucket,
            Key: awsUnityMachinesAllocationState,
            Body: JSON.stringify(this.state),
        });
    }

    private async loadAllocatorState(): Promise<IAllocatorState> {
        let state = await this.getAllocatorState();
        state = state ?? { allocatedMachines: {} };
        state.allocatedMachines = state.allocatedMachines ?? {};
        this.state = state;

        core.startGroup('Allocator State');
        core.info(JSON.stringify(state, null, 2));
        core.endGroup();

        return state;
    }

    private async getAllocatorState(): Promise<IAllocatorState> {
        const data = await s3.getObject({
            Bucket: input.awsMachinesBucket,
            Key: awsUnityMachinesAllocationState,
        });

        if (!data.Body)
            throw new Error(`Failed to get state from s3 file "${awsUnityMachinesAllocationState}" at "${input.awsMachinesBucket}"`);

        try {
            const body = await data.Body.transformToString();
            const state = JSON.parse(body);
            return state;
        } catch (error) {
            throw new Error(`Failed to parse state from s3 file "${awsUnityMachinesAllocationState}" at "${input.awsMachinesBucket}"\n` + error);
        }
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
        return {
            allocationId: crypto.randomUUID(),
            instanceId: instanceId,
            reuseCount: reuseCount,
        };
    }
}
