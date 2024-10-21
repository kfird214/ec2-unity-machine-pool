import * as core from '@actions/core';
import { awsUnityMachinesAllocationState, input } from '../input';
import { s3 } from '../s3';

import { IAllocatorState } from "../Allocator/IAllocatorState";
import { IStateFetcher } from "./IStateFetcher";


export class StateFetchers3 implements IStateFetcher {
    private constructor() { }

    public static async Create(): Promise<StateFetchers3> {
        await StateFetchers3.createBucketIfNotExists();
        await StateFetchers3.createAllocatorStateIfNotExists();
        return new StateFetchers3();
    }

    public async saveAllocatorState(state: IAllocatorState): Promise<void> {
        await s3.putObject({
            Bucket: input.awsMachinesBucket,
            Key: awsUnityMachinesAllocationState,
            Body: JSON.stringify(state),
        });
    }

    public async fetchAllocatorState(): Promise<IAllocatorState> {
        const data = await s3.getObject({
            Bucket: input.awsMachinesBucket,
            Key: awsUnityMachinesAllocationState,
        });

        if (!data.Body)
            throw new Error(`Failed to get state from s3 file "${awsUnityMachinesAllocationState}" at "${input.awsMachinesBucket}"`);

        try {
            const body = await data.Body.transformToString();
            const state = JSON.parse(body);
            return state;
        } catch (error) {
            throw new Error(`Failed to parse state from s3 file "${awsUnityMachinesAllocationState}" at "${input.awsMachinesBucket}"\n` + error);
        }
    }

    private static async createAllocatorStateIfNotExists(defaultState: IAllocatorState | null = null) {
        let exists = false;
        try {
            const headData = await s3.headObject({
                Bucket: input.awsMachinesBucket,
                Key: awsUnityMachinesAllocationState,
            });

            if (!headData)
                throw new Error(`Failed to head bucket "${input.awsMachinesBucket}"`);

            exists = true;
        } catch (error) {
            exists = false;
        }

        if (exists) {
            core.debug(`Bucket "${input.awsMachinesBucket}" already exists`);
            return;
        }

        const state = defaultState ?? { allocatedMachines: [] };
        core.notice(`Creating bucket "${input.awsMachinesBucket}" with default state="${JSON.stringify(state)}"`);

        const res = await s3.putObject({
            Bucket: input.awsMachinesBucket,
            Key: awsUnityMachinesAllocationState,
            Body: JSON.stringify(state, null, 2),
        });
    }

    private static async createBucketIfNotExists(): Promise<void> {
        let exists = false;
        try {
            await s3.headBucket({
                Bucket: input.awsMachinesBucket,
            });
            exists = true;
            core.info(`Bucket "${input.awsMachinesBucket}" already exists`);
        } catch (error) {
            core.debug(`Bucket "${input.awsMachinesBucket}" does not exist (error: ${error})`);
            exists = false;
        }

        if (!exists) {
            core.notice(`Creating bucket "${input.awsMachinesBucket}"`);
            await s3.createBucket({
                Bucket: input.awsMachinesBucket,
            });
        }
    }
}
