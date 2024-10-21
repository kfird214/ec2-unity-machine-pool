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
     * The name of the instance.
     */
    instanceName?: string;

    /**
     * The count of the allocation of the same instaceId. 0 is first allocation.
     */
    reuseCount: number;
}
