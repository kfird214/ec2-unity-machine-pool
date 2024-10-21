export interface IStateFetcher {
    saveAllocatorState(state: IAllocatorState): Promise<void>;
    fetchAllocatorState(): Promise<IAllocatorState>;
    fetchMachinesConfig(): Promise<IMachinesConfig>;

    // createAllocatorStateIfNotExists(defaultState: IAllocatorState | null = null);
    // createBucketIfNotExists(): Promise<void>;
}
