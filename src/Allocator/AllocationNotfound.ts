export class AllocationNotfound extends Error {
    constructor(allocationId: string, message: string | null = null) {
        message = message ?? "Allocation not found";
        super(message + ` AllocationId: ${allocationId}`);
        this.name = "AllocationNotfound";
    }
}
