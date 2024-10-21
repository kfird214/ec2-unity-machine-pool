export interface IAllocator {
    forceSaveValidState(IAllocatorState: IAllocatorState): Promise<void>;

    allocate(): Promise<IMachineAllocation>;
    free(allocationId: string): Promise<IMachineAllocation>;

    instanceAllocationCount(instanceId: string): Promise<number>;
}
