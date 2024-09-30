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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Allocator = void 0;
const core = __importStar(require("@actions/core"));
const crypto = __importStar(require("crypto"));
;
class Allocator {
    constructor(machinesConfig, state) {
        var _a;
        this.state = { allocatedMachines: {} };
        this.machinesConfig = machinesConfig;
        this.state = state;
        this.state.allocatedMachines = (_a = state.allocatedMachines) !== null && _a !== void 0 ? _a : {};
    }
    allocate() {
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
    free(allocationId) {
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
    instanceAllocationCount(instanceId) {
        const a = this.state.allocatedMachines[instanceId];
        return a != null ? a.length : 0;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWxsb2NhdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiQWxsb2NhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsb0RBQXNDO0FBQ3RDLCtDQUFpQztBQXdCaEMsQ0FBQztBQUdGLE1BQWEsU0FBUztJQUtsQixZQUFZLGNBQThCLEVBQUUsS0FBc0I7O1FBSjNELFVBQUssR0FBb0IsRUFBRSxpQkFBaUIsRUFBRSxFQUFFLEVBQUUsQ0FBQztRQUt0RCxJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWMsQ0FBQztRQUNyQyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsS0FBSyxDQUFDLGlCQUFpQixHQUFHLE1BQUEsS0FBSyxDQUFDLGlCQUFpQixtQ0FBSSxFQUFFLENBQUM7SUFDakUsQ0FBQztJQUVNLFFBQVE7UUFDWCxJQUFJLGNBQWMsR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7UUFFNUMsSUFBSSxjQUFjLElBQUksSUFBSSxFQUFFLENBQUM7WUFDekIsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUN0RCxJQUFJLENBQUMsS0FBSyxDQUFDLHVCQUF1QixJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNqRSxPQUFPLFVBQVUsQ0FBQztRQUN0QixDQUFDO2FBQ0ksQ0FBQztZQUNGLElBQUksQ0FBQyxLQUFLLENBQUMsd0VBQXdFLENBQUMsQ0FBQztZQUNyRixNQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyw0QkFBNEIsRUFBRSxDQUFDO1lBRS9ELElBQUksa0JBQWtCLElBQUksSUFBSSxFQUFFLENBQUM7Z0JBQzdCLElBQUksQ0FBQyxLQUFLLENBQUMseUNBQXlDLENBQUMsQ0FBQztnQkFDdEQsTUFBTSxJQUFJLEtBQUssQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFD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