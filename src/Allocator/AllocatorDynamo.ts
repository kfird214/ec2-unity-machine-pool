import * as core from '@actions/core';
import { DeleteItemCommand, PutItemCommand, QueryCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { dynamo } from "../dynamo";
import { IAllocator } from "./IAllocator";
import { IAllocatorState } from "./IAllocatorState";
import { IMachineAllocation } from "./IMachineAllocation";
import { input } from "../input";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { IMachinesConfig, MachineConfig } from "../UnityMachineConfig";
import { AllocationNotfound } from './AllocationNotfound';

// interface IMachineAllocationDynamoItem {
//     allocationId: string;
//     instanceId: string;
//     instanceName?: string;
//     reuseCount: number;
// };

export class AllocatorDynamo implements IAllocator {
    private machinesConfig: IMachinesConfig;

    private constructor(machinesConfig: IMachinesConfig) {
        this.machinesConfig = machinesConfig;

        if (machinesConfig.machines.length == 0) {
            throw new Error('No machines configured');
        }
    }

    public static async Create(machinesConfig: IMachinesConfig): Promise<AllocatorDynamo> {
        return new AllocatorDynamo(machinesConfig);
    }

    forceSaveValidState(IAllocatorState: IAllocatorState): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public async allocate(): Promise<IMachineAllocation> {
        const freeMachine = await this.findFreeMachine();

        if (freeMachine !== null) {
            const allocation = await this.addAllocation(freeMachine);
            core.debug(`Found free machine "${JSON.stringify(allocation)}"`);
            return allocation;
        }
        else {
            core.debug(`No free machine found, trying to find a machine with least reuse count`);
            const res = await this.findMachineWithMinReuseCount();

            if (res == null) {
                core.debug(`No machine found with least reuse count`);
                throw new Error('No machine found with least reuse count');
            }

            const [minMachine, minReuseCountAlloc] = res;

            const allocation = await this.addAllocation(minMachine, minReuseCountAlloc.reuseCount + 1);
            core.debug(`Found machine with least reuse count "${JSON.stringify(allocation)}"`);
            return allocation;
        }
    }

    private async findMachineWithMinReuseCount(): Promise<[MachineConfig, IMachineAllocation] | null> {
        const res = await dynamo.send(new ScanCommand({
            TableName: input.awsDynamoDbTable,
        }));

        const allocs = res.Items?.map(it => unmarshall(it) as IMachineAllocation);
        const machinesWithAllocs = this.machinesConfig.machines.filter(m => allocs?.find(a => a.instanceId == m.instanceId) == null);

        let minReuseCount: number | null = null;
        let minReuseCountMachine: MachineConfig | null = null;

        for (const machine of this.machinesConfig.machines) {
            const machineAllocs = allocs!.filter(a => a.instanceId == machine.instanceId);

            const activeAllocations = machineAllocs.length;
            // const maxReuseCount = activeAllocations == 0 ? 0 : machineAllocs.sort((a, b) => a.reuseCount - b.reuseCount)[0].reuseCount;

            if (activeAllocations < (minReuseCount ?? Infinity)) {
                minReuseCount = activeAllocations;
                minReuseCountMachine = machine;
            }
        }

        if (minReuseCount == null || minReuseCountMachine == null)
            return null;

        const maxReusedAllocation = allocs!.filter(a => a.instanceId == minReuseCountMachine.instanceId).sort((a, b) => b.reuseCount - a.reuseCount)[0];

        return [minReuseCountMachine, maxReusedAllocation];
    }

    private async addAllocation(freeMachine: MachineConfig, reuseCount: number = 0): Promise<IMachineAllocation> {
        const allocation = this.newAllocation(freeMachine, reuseCount);

        core.debug(`Allocating machine ${JSON.stringify(allocation)}`);

        await dynamo.send(new PutItemCommand({
            TableName: input.awsDynamoDbTable,
            Item: marshall(allocation),
        }));

        return allocation;
    }

    private async findFreeMachine(): Promise<MachineConfig | null> {
        const res = await dynamo.send(new ScanCommand({
            TableName: input.awsDynamoDbTable,
        }));

        const allocs = res.Items?.map(it => unmarshall(it) as IMachineAllocation);
        const machinesWithAllocs = this.machinesConfig.machines.filter(m => allocs?.find(a => a.instanceId == m.instanceId) == null);

        const distinctMachineWithAllocsIds = [...new Set(allocs?.map(a => a.instanceId))];

        for (const machine of this.machinesConfig.machines) {
            if (!distinctMachineWithAllocsIds.includes(machine.instanceId)) {
                return machine;
            }
        }

        return null;
    }

    private newAllocation(machine: MachineConfig, reuseCount: number = 0): IMachineAllocation {
        return {
            allocationId: crypto.randomUUID(),
            instanceId: machine.instanceId,
            reuseCount: reuseCount,
            instanceName: machine?.instanceName,
        };
    }

    public async free(allocationId: string): Promise<IMachineAllocation> {
        const res = await dynamo.send(new QueryCommand({
            TableName: input.awsDynamoDbTable,
            KeyConditionExpression: 'allocationId = :allocationId',
            ExpressionAttributeValues: {
                ':allocationId': { S: allocationId },
            },
        }));

        if (!res.Items || res.Items.length == 0) {
            throw new AllocationNotfound(allocationId);
        }

        const alloc = unmarshall(res.Items[0]) as IMachineAllocation;

        // delete allocation
        await dynamo.send(new DeleteItemCommand({
            TableName: input.awsDynamoDbTable,
            Key: {
                'allocationId': { S: allocationId },

                // sort key instanceId
                'instanceId': { S: alloc.instanceId },
            },
        }));

        return alloc;
    }

    public async instanceAllocationCount(instanceId: string): Promise<number> {
        const res = await dynamo.send(new ScanCommand({
            TableName: input.awsDynamoDbTable,
            FilterExpression: 'instanceId = :instanceId',
            ExpressionAttributeValues: {
                ':instanceId': { S: instanceId },
            },
        }));

        return res.Count ?? 0;
    }
}
