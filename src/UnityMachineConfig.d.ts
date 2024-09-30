export interface MachineConfig {
    /**
     * The AWS instanceId of the machine.
     */
    instanceId: string;

    /**
     * The AWS region where the machine is located.
     */
    region: string;
}

export interface MachinesConfig {
    /**
     * The list of machines that can be allocated.
     */
    machines: MachineConfig[];
}
