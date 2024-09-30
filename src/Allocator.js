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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Allocator = void 0;
const core = __importStar(require("@actions/core"));
const crypto = __importStar(require("crypto"));
const s3_1 = require("./s3");
const input_1 = require("./input");
;
class Allocator {
    constructor(machinesConfig) {
        this.state = { allocatedMachines: {} };
        this.machinesConfig = machinesConfig;
    }
    allocate() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadAllocatorState();
            try {
                let freeInstanceId = this.findFreeMachine();
                if (freeInstanceId != null) {
                    const allocation = this.addAllocation(freeInstanceId);
                    core.debug(`Found free machine "${JSON.stringify(allocation)}"`);
                    return allocation;
                }
                else {
                    core.debug(`No free machine found, trying to find a machine with least reuse count`);
                    const minReuseCountAlloc = this.findMachineWithMinReuseCount();
                    if (minReuseCountAlloc == null) {
                        core.debug(`No machine found with least reuse count`);
                        throw new Error('No machine found with least reuse count');
                    }
                    const allocation = this.addAllocation(minReuseCountAlloc.instanceId, minReuseCountAlloc.reuseCount + 1);
                    core.debug(`Found machine with least reuse count "${JSON.stringify(allocation)}"`);
                    return allocation;
                }
            }
            finally {
                yield this.saveAllocatorState();
            }
        });
    }
    free(allocationId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadAllocatorState();
            try {
                for (const instanceId in this.state.allocatedMachines) {
                    const allocations = this.state.allocatedMachines[instanceId];
                    if (allocations == null)
                        continue;
                    for (let i = 0; i < allocations.length; i++) {
                        const alloc = allocations[i];
                        if (alloc.allocationId == allocationId) {
                            const removed = allocations.splice(i, 1)[0];
                            core.debug(`Freed machine "${JSON.stringify(removed)}"`);
                            return removed;
                        }
                    }
                }
                throw new Error(`Allocation with id "${allocationId}" not found`);
            }
            finally {
                yield this.saveAllocatorState();
            }
        });
    }
    instanceAllocationCount(instanceId) {
        const a = this.state.allocatedMachines[instanceId];
        return a != null ? a.length : 0;
    }
    saveAllocatorState() {
        return __awaiter(this, void 0, void 0, function* () {
            core.debug(`Saving allocator state "${JSON.stringify(this.state)}"`);
            yield s3_1.s3.putObject({
                Bucket: input_1.input.awsMachinesBucket,
                Key: input_1.awsUnityMachinesAllocationState,
                Body: JSON.stringify(this.state),
            });
        });
    }
    loadAllocatorState() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            let state = yield this.getAllocatorState();
            state = state !== null && state !== void 0 ? state : { allocatedMachines: {} };
            state.allocatedMachines = (_a = state.allocatedMachines) !== null && _a !== void 0 ? _a : {};
            this.state = state;
            core.startGroup('Allocator State');
            core.info(JSON.stringify(state, null, 2));
            core.endGroup();
            return state;
        });
    }
    getAllocatorState() {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield s3_1.s3.getObject({
                Bucket: input_1.input.awsMachinesBucket,
                Key: input_1.awsUnityMachinesAllocationState,
            });
            if (!data.Body)
                throw new Error(`Failed to get state from s3 file "${input_1.awsUnityMachinesAllocationState}" at "${input_1.input.awsMachinesBucket}"`);
            try {
                const body = yield data.Body.transformToString();
                const state = JSON.parse(body);
                return state;
            }
            catch (error) {
                throw new Error(`Failed to parse state from s3 file "${input_1.awsUnityMachinesAllocationState}" at "${input_1.input.awsMachinesBucket}"\n` + error);
            }
        });
    }
    pushAllocation(allocation) {
        if (!this.state.allocatedMachines[allocation.instanceId]) {
            this.state.allocatedMachines[allocation.instanceId] = [];
        }
        this.state.allocatedMachines[allocation.instanceId].push(allocation);
    }
    findMachineWithMinReuseCount() {
        var _a, _b, _c;
        let minReuseCount = null;
        let minReuseCountInstanceId = null;
        for (const machine of this.machinesConfig.machines) {
            const machineAllocs = (_a = this.state.allocatedMachines[machine.instanceId]) !== null && _a !== void 0 ? _a : [];
            const activeAllocations = machineAllocs.length;
            const maxReuseCount = activeAllocations == 0 ? 0 : machineAllocs.sort((a, b) => a.reuseCount - b.reuseCount)[0].reuseCount;
            if (activeAllocations < (minReuseCount !== null && minReuseCount !== void 0 ? minReuseCount : Infinity)) {
                minReuseCount = activeAllocations;
                minReuseCountInstanceId = machine.instanceId;
            }
        }
        if (minReuseCount == null || minReuseCountInstanceId == null)
            return null;
        return (_c = (_b = this.state.allocatedMachines[minReuseCountInstanceId]) === null || _b === void 0 ? void 0 : _b.sort((a, b) => a.reuseCount - b.reuseCount)[0]) !== null && _c !== void 0 ? _c : null;
    }
    findFreeMachine() {
        // const allocatedInstanceIds = this.allocatedMachines.map(m => m.instanceId);
        const distinctAllocatedInstanceIds = Object.keys(this.state.allocatedMachines);
        const allocationsIdsThatHasAllocations = distinctAllocatedInstanceIds.filter(instanceId => { var _a, _b; return ((_b = (_a = this.state.allocatedMachines[instanceId]) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0; });
        core.debug(`Allocated instance ids: ${JSON.stringify([...distinctAllocatedInstanceIds])}`);
        for (const machine of this.machinesConfig.machines) {
            // core.debug(`Checking machine "${machine.instanceId}"`);
            if (!allocationsIdsThatHasAllocations.includes(machine.instanceId)) {
                // core.debug(`Found free machine "${machine.instanceId}"`);
                return machine.instanceId;
            }
            // core.debug(`Machine "${machine.instanceId}" is already allocated`);
        }
        return null;
    }
    addAllocation(instanceId, reuseCount = 0) {
        const allocation = this.newAllocation(instanceId, reuseCount);
        this.pushAllocation(allocation);
        return allocation;
    }
    newAllocation(instanceId, reuseCount = 0) {
        return {
            allocationId: crypto.randomUUID(),
            instanceId: instanceId,
            reuseCount: reuseCount,
        };
    }
}
exports.Allocator = Allocator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWxsb2NhdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiQWxsb2NhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsb0RBQXNDO0FBQ3RDLCtDQUFpQztBQUVqQyw2QkFBMEI7QUFDMUIsbUNBQWlFO0FBdUJoRSxDQUFDO0FBRUYsTUFBYSxTQUFTO0lBSWxCLFlBQVksY0FBOEI7UUFIbEMsVUFBSyxHQUFvQixFQUFFLGlCQUFpQixFQUFFLEVBQUUsRUFBRSxDQUFDO1FBSXZELElBQUksQ0FBQyxjQUFjLEdBQUcsY0FBYyxDQUFDO0lBQ3pDLENBQUM7SUFFWSxRQUFROztZQUNqQixNQUFNLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBRWhDLElBQUksQ0FBQztnQkFDRCxJQUFJLGNBQWMsR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBRTVDLElBQUksY0FBYyxJQUFJLElBQUksRUFBRSxDQUFDO29CQUN6QixNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxDQUFDO29CQUN0RCxJQUFJLENBQUMsS0FBSyxDQUFDLHVCQUF1QixJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDakUsT0FBTyxVQUFVLENBQUM7Z0JBQ3RCLENBQUM7cUJBQ0ksQ0FBQztvQkFDRixJQUFJLENBQUMsS0FBSyxDQUFDLHdFQUF3RSxDQUFDLENBQUM7b0JBQ3JGLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLDRCQUE0QixFQUFFLENBQUM7b0JBRS9ELElBQUksa0JBQWtCLElBQUksSUFBSSxFQUFFLENBQUM7d0JBQzdCLElBQUksQ0FBQyxLQUFLLENBQUMseUNBQXlDLENBQUMsQ0FBQzt3QkFDdEQsTUFBTSxJQUFJLEtBQUssQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFDO29CQUMvRCxDQUFDO29CQUVELE1BQU0s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