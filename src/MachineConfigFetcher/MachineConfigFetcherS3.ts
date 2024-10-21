import { awsUnityMachinesConfigFile, input } from "../input";
import { s3 } from "../s3";
import { IMachinesConfig } from "../UnityMachineConfig";
import { IMachineConfigFetcher } from "./IMachineConfigFetcher";

export class MachineConfigFetcherS3 implements IMachineConfigFetcher {
    private constructor() { }

    public static async Create(): Promise<MachineConfigFetcherS3> {
        return new MachineConfigFetcherS3();
    }

    public async fetchMachinesConfig(): Promise<IMachinesConfig> {
        const data = await s3.getObject({
            Bucket: input.awsMachinesBucket,
            Key: awsUnityMachinesConfigFile,
        });

        if (!data.Body)
            throw new Error(`Failed to get config from s3 file "${awsUnityMachinesConfigFile}" at "${input.awsMachinesBucket}"`);

        try {
            const body = await data.Body.transformToString();
            const config = JSON.parse(body);

            if (config.machines.length == 0)
                throw new Error(`No machines found in config`);

            return config;
        } catch (error) {
            throw new Error(`Failed to parse config from s3 file "${awsUnityMachinesConfigFile}" at "${input.awsMachinesBucket}" ` + (error ?? '').toString());
        }
    }
}
