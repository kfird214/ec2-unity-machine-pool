export interface IStateFetcher {
    saveAllocatorState(state: IAllocatorState): Promise<void>;
    fetchAllocatorState(): Promise<IAllocatorState>;

    // createAllocatorStateIfNotExists(defaultState: IAllocatorState | null = null);
    // createBucketIfNotExists(): Promise<void>;
}
