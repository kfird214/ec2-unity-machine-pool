import * as core from '@actions/core';
import { GithubInput } from "./github-input";
import assert from 'assert';

export const awsUnityMachinesConfigFile = 'unity-machines.json'; // MachinesConfig
export const awsUnityMachinesAllocationState = 'unity-machines.state.json'; // AllocatorState

const NODE_ENV = process.env['NODE_ENV'];

let inputObj: GithubInput;
if (NODE_ENV != 'local') {
    const allocateMachine = core.getInput('allocate-machine') == 'true';
    inputObj = {
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

    inputObj = {
        awsAccessKeyId: AWS_ACCESS_KEY_ID,
        awsSecretAccessKey: AWS_SECRET_ACCESS_KEY,
        awsRegion: AWS_REGION,
        awsMachinesBucket: AWS_BUCKET,
        allocateMachine: ALLOCATE_MACHINE == 'true',
        allocationId: ALLOCATION_ID,
    };
}

export const input = inputObj;
