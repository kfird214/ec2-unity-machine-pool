import { IMachinesConfig } from "../UnityMachineConfig";

export interface IMachineConfigFetcher {
    async fetchMachinesConfig(): Promise<IMachinesConfig>;
}
