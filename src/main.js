"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const client_s3_1 = require("@aws-sdk/client-s3");
const client_ec2_1 = require("@aws-sdk/client-ec2");
const assert_1 = __importDefault(require("assert"));
const Allocator_1 = require("./Allocator");
const awsUnityMachinesConfigFile = 'unity-machines.json'; // MachinesConfig
const awsUnityMachinesAllocationState = 'unity-machines.state.json'; // AllocatorState
const NODE_ENV = process.env['NODE_ENV'];
let input;
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
}
else {
    console.log('Running locally');
    // If you want to run it locally, set the environment variables like `$ export SOME_KEY=<your token>`
    const AWS_ACCESS_KEY_ID = process.env['AWS_ACCESS_KEY_ID'];
    const AWS_SECRET_ACCESS_KEY = process.env['AWS_SECRET_ACCESS_KEY'];
    const AWS_BUCKET = process.env['AWS_BUCKET'];
    const ALLOCATE_MACHINE = process.env['ALLOCATE_MACHINE'];
    const ALLOCATION_ID = process.env['ALLOCATION_ID'];
    const AWS_REGION = process.env['AWS_REGION'];
    (0, assert_1.default)(AWS_ACCESS_KEY_ID, 'AWS_ACCESS_KEY_ID is required');
    (0, assert_1.default)(AWS_SECRET_ACCESS_KEY, 'AWS_SECRET_ACCESS_KEY is required');
    (0, assert_1.default)(AWS_BUCKET, 'AWS_BUCKET is required');
    (0, assert_1.default)(ALLOCATE_MACHINE, 'ALLOCATE_MACHINE is required');
    (0, assert_1.default)(AWS_REGION, 'AWS_REGION is required');
    if (ALLOCATE_MACHINE == 'false')
        (0, assert_1.default)(ALLOCATION_ID, 'ALLOCATION_ID is required');
    input = {
        awsAccessKeyId: AWS_ACCESS_KEY_ID,
        awsSecretAccessKey: AWS_SECRET_ACCESS_KEY,
        awsRegion: AWS_REGION,
        awsMachinesBucket: AWS_BUCKET,
        allocateMachine: ALLOCATE_MACHINE == 'true',
        allocationId: ALLOCATION_ID,
    };
}
const s3 = new client_s3_1.S3({
    region: input.awsRegion,
    credentials: {
        accessKeyId: input.awsAccessKeyId,
        secretAccessKey: input.awsSecretAccessKey,
    },
});
const ec2 = new client_ec2_1.EC2Client({
    region: input.awsRegion,
    credentials: {
        accessKeyId: input.awsAccessKeyId,
        secretAccessKey: input.awsSecretAccessKey,
    },
});
function getMachinesConfig() {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield s3.getObject({
            Bucket: input.awsMachinesBucket,
            Key: awsUnityMachinesConfigFile,
        });
        if (!data.Body)
            throw new Error(`Failed to get config from s3 file "${awsUnityMachinesConfigFile}" at "${input.awsMachinesBucket}"`);
        try {
            const body = yield data.Body.transformToString();
            const config = JSON.parse(body);
            if (config.machines.length == 0)
                throw new Error(`No machines found in config`);
            return config;
        }
        catch (error) {
            throw new Error(`Failed to parse config from s3 file "${awsUnityMachinesConfigFile}" at "${input.awsMachinesBucket}" ` + (error !== null && error !== void 0 ? error : '').toString());
        }
    });
}
function createAllocatorStateIfNotExists() {
    return __awaiter(this, arguments, void 0, function* (defaultState = null) {
        let exists = false;
        try {
            const headData = yield s3.headObject({
                Bucket: input.awsMachinesBucket,
                Key: awsUnityMachinesAllocationState,
            });
            if (!headData)
                throw new Error(`Failed to head bucket "${input.awsMachinesBucket}"`);
            exists = true;
        }
        catch (error) {
            exists = false;
        }
        if (exists) {
            core.debug(`Bucket "${input.awsMachinesBucket}" already exists`);
            return;
        }
        const state = defaultState !== null && defaultState !== void 0 ? defaultState : { allocatedMachines: [] };
        core.notice(`Creating bucket "${input.awsMachinesBucket}" with default state="${JSON.stringify(state)}"`);
        const res = yield s3.putObject({
            Bucket: input.awsMachinesBucket,
            Key: awsUnityMachinesAllocationState,
            Body: JSON.stringify(state, null, 2),
        });
    });
}
function getAllocatorState() {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield s3.getObject({
            Bucket: input.awsMachinesBucket,
            Key: awsUnityMachinesAllocationState,
        });
        if (!data.Body)
            throw new Error(`Failed to get state from s3 file "${awsUnityMachinesAllocationState}" at "${input.awsMachinesBucket}"`);
        try {
            const body = yield data.Body.transformToString();
            const state = JSON.parse(body);
            return state;
        }
        catch (error) {
            throw new Error(`Failed to parse state from s3 file "${awsUnityMachinesAllocationState}" at "${input.awsMachinesBucket}"\n` + error);
        }
    });
}
function saveAllocatorState(state) {
    return __awaiter(this, void 0, void 0, function* () {
        yield s3.putObject({
            Bucket: input.awsMachinesBucket,
            Key: awsUnityMachinesAllocationState,
            Body: JSON.stringify(state),
        });
    });
}
function createBucketIfNotExists() {
    return __awaiter(this, void 0, void 0, function* () {
        let exists = false;
        try {
            yield s3.headBucket({
                Bucket: input.awsMachinesBucket,
            });
            exists = true;
            core.info(`Bucket "${input.awsMachinesBucket}" already exists`);
        }
        catch (error) {
            core.debug(`Bucket "${input.awsMachinesBucket}" does not exist (error: ${error})`);
            exists = false;
        }
        if (!exists) {
            core.notice(`Creating bucket "${input.awsMachinesBucket}"`);
            yield s3.createBucket({
                Bucket: input.awsMachinesBucket,
            });
        }
    });
}
function isMachineRunning(instanceId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const data = yield ec2.send(new client_ec2_1.DescribeInstancesCommand({
            InstanceIds: [instanceId],
        }));
        if (!data.Reservations || data.Reservations.length == 0)
            throw new Error(`No reservations found for instance "${instanceId}"`);
        const instance = (_a = data.Reservations[0].Instances) === null || _a === void 0 ? void 0 : _a[0];
        if (!instance)
            throw new Error(`No instances found for instance "${instanceId}"`);
        const stateName = (_b = instance.State) === null || _b === void 0 ? void 0 : _b.Name;
        if (!stateName)
            throw new Error(`No state found for instance "${instanceId}"`);
        return stateName == client_ec2_1.InstanceStateName.running;
    });
}
function startMachine(instanceId) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield ec2.send(new client_ec2_1.StartInstancesCommand({
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
    });
}
function stopMachine(instanceId) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield ec2.send(new client_ec2_1.StopInstancesCommand({
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
    });
}
function run(input) {
    return __awaiter(this, void 0, void 0, function* () {
        core.debug('Starting the action');
        yield createBucketIfNotExists();
        yield createAllocatorStateIfNotExists();
        const machinesConfig = yield getMachinesConfig();
        const allocatorState = yield getAllocatorState();
        core.startGroup('Machines Config');
        core.info(JSON.stringify(machinesConfig, null, 2));
        core.endGroup();
        core.startGroup('Allocator State');
        core.info(JSON.stringify(allocatorState, null, 2));
        core.endGroup();
        const allocator = new Allocator_1.Allocator(machinesConfig, allocatorState);
        if (input.allocateMachine)
            yield allocateMachine(allocator);
        else {
            (0, assert_1.default)(input.allocationId, 'AllocationId is required when allocateMachine is false');
            yield deallocateMachine(input.allocationId, allocator);
        }
    });
}
function deallocateMachine(allocationId, allocator) {
    return __awaiter(this, void 0, void 0, function* () {
        core.info(`Deallocating machine with allocationId "${allocationId}"`);
        const machine = allocator.free(allocationId);
        core.debug(`Saving allocator state "${JSON.stringify(allocator.state)}"`);
        yield saveAllocatorState(allocator.state);
        const allocCount = allocator.instanceAllocationCount(machine.instanceId);
        if (allocCount > 0) {
            core.debug(`Machine "${machine.instanceId}" still has ${allocCount} allocations`);
            return;
        }
        else {
            core.debug(`Machine "${JSON.stringify(machine)}" has no more allocations, stopping it`);
            yield stopMachine(machine.instanceId);
        }
    });
}
function allocateMachine(allocator) {
    return __awaiter(this, void 0, void 0, function* () {
        core.info('Allocating a new machine');
        const allocation = allocator.allocate();
        if (!allocation)
            throw new Error('No machines available to allocate');
        core.info(`Allocating machine "${JSON.stringify(allocation)}"`);
        const isRunning = yield isMachineRunning(allocation.instanceId);
        if (isRunning) {
            core.debug(`Machine "${JSON.stringify(allocation)}" is already running`);
        }
        else {
            core.notice(`Starting machine "${allocation.instanceId}"`);
            yield startMachine(allocation.instanceId);
        }
        core.debug(`Saving allocator state "${JSON.stringify(allocator.state)}"`);
        yield saveAllocatorState(allocator.state);
        return allocation;
    });
}
run(input)
    .then(result => {
    core.setOutput('result', 'success');
})
    .catch(error => {
    var _a;
    core.setOutput('result', 'failure');
    core.setFailed((_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : 'Unknown error');
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLG9EQUFzQztBQUN0QyxrREFBd0M7QUFDeEMsb0RBQTBJO0FBQzFJLG9EQUE0QjtBQUU1QiwyQ0FBNkU7QUFFN0UsTUFBTSwwQkFBMEIsR0FBRyxxQkFBcUIsQ0FBQyxDQUFDLGlCQUFpQjtBQUMzRSxNQUFNLCtCQUErQixHQUFHLDJCQUEyQixDQUFDLENBQUMsaUJBQWlCO0FBRXRGLE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7QUFlekMsSUFBSSxLQUFrQixDQUFDO0FBQ3ZCLElBQUksUUFBUSxJQUFJLE9BQU8sRUFBRSxDQUFDO0lBQ3RCLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsa0JBQWtCLENBQUMsSUFBSSxNQUFNLENBQUM7SUFDcEUsS0FBSyxHQUFHO1FBQ0osY0FBYyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsbUJBQW1CLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUM7UUFDdEUsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUM5RSxTQUFTLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUM7UUFDMUQsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUMxRSxlQUFlLEVBQUUsZUFBZTtRQUNoQyxZQUFZLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLEVBQUUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxlQUFlLEVBQUUsQ0FBQztL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