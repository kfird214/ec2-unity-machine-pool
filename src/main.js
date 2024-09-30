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
const client_ec2_1 = require("@aws-sdk/client-ec2");
const assert_1 = __importDefault(require("assert"));
const Allocator_1 = require("./Allocator");
const input_1 = require("./input");
const s3_1 = require("./s3");
const ec2 = new client_ec2_1.EC2Client({
    region: input_1.input.awsRegion,
    credentials: {
        accessKeyId: input_1.input.awsAccessKeyId,
        secretAccessKey: input_1.input.awsSecretAccessKey,
    },
});
function getMachinesConfig() {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield s3_1.s3.getObject({
            Bucket: input_1.input.awsMachinesBucket,
            Key: input_1.awsUnityMachinesConfigFile,
        });
        if (!data.Body)
            throw new Error(`Failed to get config from s3 file "${input_1.awsUnityMachinesConfigFile}" at "${input_1.input.awsMachinesBucket}"`);
        try {
            const body = yield data.Body.transformToString();
            const config = JSON.parse(body);
            if (config.machines.length == 0)
                throw new Error(`No machines found in config`);
            return config;
        }
        catch (error) {
            throw new Error(`Failed to parse config from s3 file "${input_1.awsUnityMachinesConfigFile}" at "${input_1.input.awsMachinesBucket}" ` + (error !== null && error !== void 0 ? error : '').toString());
        }
    });
}
function createAllocatorStateIfNotExists() {
    return __awaiter(this, arguments, void 0, function* (defaultState = null) {
        let exists = false;
        try {
            const headData = yield s3_1.s3.headObject({
                Bucket: input_1.input.awsMachinesBucket,
                Key: input_1.awsUnityMachinesAllocationState,
            });
            if (!headData)
                throw new Error(`Failed to head bucket "${input_1.input.awsMachinesBucket}"`);
            exists = true;
        }
        catch (error) {
            exists = false;
        }
        if (exists) {
            core.debug(`Bucket "${input_1.input.awsMachinesBucket}" already exists`);
            return;
        }
        const state = defaultState !== null && defaultState !== void 0 ? defaultState : { allocatedMachines: [] };
        core.notice(`Creating bucket "${input_1.input.awsMachinesBucket}" with default state="${JSON.stringify(state)}"`);
        const res = yield s3_1.s3.putObject({
            Bucket: input_1.input.awsMachinesBucket,
            Key: input_1.awsUnityMachinesAllocationState,
            Body: JSON.stringify(state, null, 2),
        });
    });
}
function createBucketIfNotExists() {
    return __awaiter(this, void 0, void 0, function* () {
        let exists = false;
        try {
            yield s3_1.s3.headBucket({
                Bucket: input_1.input.awsMachinesBucket,
            });
            exists = true;
            core.info(`Bucket "${input_1.input.awsMachinesBucket}" already exists`);
        }
        catch (error) {
            core.debug(`Bucket "${input_1.input.awsMachinesBucket}" does not exist (error: ${error})`);
            exists = false;
        }
        if (!exists) {
            core.notice(`Creating bucket "${input_1.input.awsMachinesBucket}"`);
            yield s3_1.s3.createBucket({
                Bucket: input_1.input.awsMachinesBucket,
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
        core.startGroup('Machines Config');
        core.info(JSON.stringify(machinesConfig, null, 2));
        core.endGroup();
        const allocator = new Allocator_1.Allocator(machinesConfig);
        let allocationId;
        if (input.allocateMachine) {
            const allocation = yield allocateMachine(allocator);
            allocationId = allocation.allocationId;
        }
        else {
            (0, assert_1.default)(input.allocationId, 'AllocationId is required when allocateMachine is false');
            yield deallocateMachine(input.allocationId, allocator);
            allocationId = input.allocationId;
        }
        core.setOutput('allocation_id', allocationId);
    });
}
function deallocateMachine(allocationId, allocator) {
    return __awaiter(this, void 0, void 0, function* () {
        core.info(`Deallocating machine with allocationId "${allocationId}"`);
        const machine = yield allocator.free(allocationId);
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
        const allocation = yield allocator.allocate(); // todo dealocate on error?
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
        return allocation;
    });
}
run(input_1.input)
    .then(result => {
    core.setOutput('result', 'success');
})
    .catch(error => {
    var _a;
    core.setOutput('result', 'failure');
    core.setFailed((_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : 'Unknown error');
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLG9EQUFzQztBQUN0QyxvREFBMEk7QUFDMUksb0RBQTRCO0FBRTVCLDJDQUE2RTtBQUU3RSxtQ0FBNkY7QUFDN0YsNkJBQTBCO0FBRTFCLE1BQU0sR0FBRyxHQUFHLElBQUksc0JBQVMsQ0FBQztJQUN0QixNQUFNLEVBQUUsYUFBSyxDQUFDLFNBQVM7SUFDdkIsV0FBVyxFQUFFO1FBQ1QsV0FBVyxFQUFFLGFBQUssQ0FBQyxjQUFjO1FBQ2pDLGVBQWUsRUFBRSxhQUFLLENBQUMsa0JBQWtCO0tBQzVDO0NBQ0osQ0FBQyxDQUFDO0FBRUgsU0FBZSxpQkFBaUI7O1FBQzVCLE1BQU0sSUFBSSxHQUFHLE1BQU0sT0FBRSxDQUFDLFNBQVMsQ0FBQztZQUM1QixNQUFNLEVBQUUsYUFBSyxDQUFDLGlCQUFpQjtZQUMvQixHQUFHLEVBQUUsa0NBQTBCO1NBQ2xDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSTtZQUNWLE1BQU0sSUFBSSxLQUFLLENBQUMsc0NBQXNDLGtDQUEwQixTQUFTLGFBQUssQ0FBQyxpQkFBaUIsR0FBRyxDQUFDLENBQUM7UUFFekgsSUFBSSxDQUFDO1lBQ0QsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDakQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUVoQyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBTSxJQUFJLENBQUM7Z0JBQzNCLE1BQU0sSUFBSSxLQUFLLENBQUMsNkJBQTZCLENBQUMsQ0FBQztZQUVuRCxPQUFPLE1BQU0sQ0FBQztRQUNsQixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNi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