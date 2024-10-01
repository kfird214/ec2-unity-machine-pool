export interface MachineConfig {
    /**
     * The AWS instanceId of the machine.
     */
    instanceId: string;

    /**
     * The name of the instance.
     */
    instanceName: string;

    /**
     * The AWS region where the machine is located.
     */
    region: string;
}

export interface IMachinesConfig {
    /**
     * The list of machines that can be allocated.
     */
    machines: MachineConfig[];
}
