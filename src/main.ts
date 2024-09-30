import * as core from '@actions/core';
import { S3 } from '@aws-sdk/client-s3';
import { DescribeInstancesCommand, EC2Client, InstanceStateName, StartInstancesCommand, StopInstancesCommand } from '@aws-sdk/client-ec2';
import assert from 'assert';
import { MachinesConfig } from './UnityMachineConfig';
import { Allocator, IAllocatorState, IMachineAllocation } from './Allocator';

const awsUnityMachinesConfigFile = 'unity-machines.json'; // MachinesConfig
const awsUnityMachinesAllocationState = 'unity-machines.state.json'; // AllocatorState

const NODE_ENV = process.env['NODE_ENV'];

interface GithubInput {
    awsAccessKeyId: string
    awsSecretAccessKey: string
    awsRegion: string
    awsMachinesBucket: string
    allocateMachine: boolean

    /**
     * Required if `allocateMachine` is false.
     */
    allocationId?: string
}

let input: GithubInput;
if (NODE_ENV != 'local') {
    const allocateMachine = core.getInput('allocate-machine') == 'true';
    input = {
        awsAccessKeyId: core.getInput('aws-access-key-id', { required: true }),
        awsSecretAccessKey: core.getInput('aws-secret-access-key', { required: true }),
        awsRegion: core.getInput('aws-region', { required: true }),
        awsMachinesBucket: core.getInput('aws-machine-bucket', { required: true }),
        allocateMachine: allocateMachine,
        allocationId: core.getInput('allocation-id', { required: !allocateMachine }),
    };
} else {
    console.log('Running locally');
    // If you want to run it locally, set the environment variables like `$ export SOME_KEY=<your token>`
    const AWS_ACCESS_KEY_ID = process.env['AWS_ACCESS_KEY_ID'];
    const AWS_SECRET_ACCESS_KEY = process.env['AWS_SECRET_ACCESS_KEY'];
    const AWS_BUCKET = process.env['AWS_BUCKET'];
    const ALLOCATE_MACHINE = process.env['ALLOCATE_MACHINE'];
    const ALLOCATION_ID = process.env['ALLOCATION_ID'];
    const AWS_REGION = process.env['AWS_REGION'];

    assert(AWS_ACCESS_KEY_ID, 'AWS_ACCESS_KEY_ID is required');
    assert(AWS_SECRET_ACCESS_KEY, 'AWS_SECRET_ACCESS_KEY is required');
    assert(AWS_BUCKET, 'AWS_BUCKET is required');
    assert(ALLOCATE_MACHINE, 'ALLOCATE_MACHINE is required');
    assert(AWS_REGION, 'AWS_REGION is required');

    if (ALLOCATE_MACHINE == 'false')
        assert(ALLOCATION_ID, 'ALLOCATION_ID is required');

    input = {
        awsAccessKeyId: AWS_ACCESS_KEY_ID,
        awsSecretAccessKey: AWS_SECRET_ACCESS_KEY,
        awsRegion: AWS_REGION,
        awsMachinesBucket: AWS_BUCKET,
        allocateMachine: ALLOCATE_MACHINE == 'true',
        allocationId: ALLOCATION_ID,
    };
}

const s3 = new S3({
    region: input.awsRegion,
    credentials: {
        accessKeyId: input.awsAccessKeyId,
        secretAccessKey: input.awsSecretAccessKey,
    },
});

const ec2 = new EC2Client({
    region: input.awsRegion,
    credentials: {
        accessKeyId: input.awsAccessKeyId,
        secretAccessKey: input.awsSecretAccessKey,
    },
});

async function getMachinesConfig(): Promise<MachinesConfig> {
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

async function createAllocatorStateIfNotExists(defaultState: IAllocatorState | null = null) {
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

async function getAllocatorState(): Promise<IAllocatorState> {
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

async function saveAllocatorState(state: IAllocatorState): Promise<void> {
    await s3.putObject({
        Bucket: input.awsMachinesBucket,
        Key: awsUnityMachinesAllocationState,
        Body: JSON.stringify(state),
    });
}

async function createBucketIfNotExists(): Promise<void> {
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


async function isMachineRunning(instanceId: string): Promise<boolean> {
    const data = await ec2.send(new DescribeInstancesCommand({
        InstanceIds: [instanceId],
    }));

    if (!data.Reservations || data.Reservations.length == 0)
        throw new Error(`No reservations found for instance "${instanceId}"`);

    const instance = data.Reservations[0].Instances?.[0];
    if (!instance)
        throw new Error(`No instances found for instance "${instanceId}"`);

    const stateName = instance.State?.Name;

    if (!stateName)
        throw new Error(`No state found for instance "${instanceId}"`);

    return stateName == InstanceStateName.running;
}

async function startMachine(instanceId: string): Promise<void> {
    const data = await ec2.send(new StartInstancesCommand({
        InstanceIds: [instanceId],
    }));

    if (!data.StartingInstances || data.StartingInstances.length == 0)
        throw new Error(`Failed to start instance "${instanceId}"`);

    const instance = data.StartingInstances[0];
    if (!instance)
        throw new Error(`Failed to start instance "${instanceId}"`);

    // if (instance.CurrentState?.Name != InstanceStateName.running)
    //     throw new Error(`Failed to start instance "${instanceId}"`);

    if (instance.InstanceId != instanceId)
        throw new Error(`Started different instance id "${instanceId}"!="${instance.InstanceId}"`);
}

async function stopMachine(instanceId: string): Promise<void> {
    const data = await ec2.send(new StopInstancesCommand({
        InstanceIds: [instanceId],
    }));

    if (!data.StoppingInstances || data.StoppingInstances.length == 0)
        throw new Error(`Failed to stop instance "${instanceId}"`);

    const instance = data.StoppingInstances[0];
    if (!instance)
        throw new Error(`Failed to stop instance "${instanceId}"`);

    // if (instance.CurrentState?.Name != InstanceStateName.stopped)
    //     throw new Error(`Failed to stop instance "${instanceId}"`);

    if (instance.InstanceId != instanceId)
        throw new Error(`Stopped different instance id "${instanceId}"!="${instance.InstanceId}"`);

    core.notice(`Stopped instance "${instanceId}"`);
}

async function run(input: GithubInput) {
    core.debug('Starting the action');
    await createBucketIfNotExists();
    await createAllocatorStateIfNotExists();

    const machinesConfig = await getMachinesConfig();
    const allocatorState = await getAllocatorState();

    core.startGroup('Machines Config');
    core.info(JSON.stringify(machinesConfig, null, 2));
    core.endGroup();

    core.startGroup('Allocator State');
    core.info(JSON.stringify(allocatorState, null, 2));
    core.endGroup();

    const allocator = new Allocator(machinesConfig, allocatorState);

    let allocationId: string;
    if (input.allocateMachine) {
        const allocation = await allocateMachine(allocator);
        allocationId = allocation.allocationId;
    }
    else {
        assert(input.allocationId, 'AllocationId is required when allocateMachine is false');
        await deallocateMachine(input.allocationId, allocator);
        allocationId = input.allocationId;
    }

    core.setOutput('allocation_id', allocationId);
}

async function deallocateMachine(allocationId: string, allocator: Allocator): Promise<void> {
    core.info(`Deallocating machine with allocationId "${allocationId}"`);

    const machine = allocator.free(allocationId);

    core.debug(`Saving allocator state "${JSON.stringify(allocator.state)}"`);
    await saveAllocatorState(allocator.state);

    const allocCount = allocator.instanceAllocationCount(machine.instanceId);
    if (allocCount > 0) {
        core.debug(`Machine "${machine.instanceId}" still has ${allocCount} allocations`);
        return;
    }
    else {
        core.debug(`Machine "${JSON.stringify(machine)}" has no more allocations, stopping it`);
        await stopMachine(machine.instanceId);
    }
}

async function allocateMachine(allocator: Allocator): Promise<IMachineAllocation> {
    core.info('Allocating a new machine');

    const allocation = allocator.allocate();

    if (!allocation)
        throw new Error('No machines available to allocate');

    core.info(`Allocating machine "${JSON.stringify(allocation)}"`);
    const isRunning = await isMachineRunning(allocation.instanceId);

    if (isRunning) {
        core.debug(`Machine "${JSON.stringify(allocation)}" is already running`);
    }
    else {
        core.notice(`Starting machine "${allocation.instanceId}"`);
        await startMachine(allocation.instanceId);
    }

    core.debug(`Saving allocator state "${JSON.stringify(allocator.state)}"`);
    await saveAllocatorState(allocator.state);

    return allocation;
}

run(input)
    .then(result => {
        core.setOutput('result', 'success');
    })
    .catch(error => {
        core.setOutput('result', 'failure');
        core.setFailed(error?.message ?? 'Unknown error');
    });
