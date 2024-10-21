import { IMachineAllocation } from "./IMachineAllocation";

export interface IAllocatorState {
    allocatedMachines: {
        [allocationId: string]: IMachineAllocation[] | null | undefined;
    }
};
