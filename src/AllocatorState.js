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
        this.allocatedMachines = {
            allocatedMachines: []
        };
        this.allocatedMachines = {
            allocatedMachines: []
        };
        this.machinesConfig = machinesConfig;
        this.allocatedMachines = (_a = state.allocatedMachines) !== null && _a !== void 0 ? _a : {};
    }
    pushAllocation(allocation) {
        if (!this.allocatedMachines[allocation.instanceId]) {
            this.allocatedMachines[allocation.instanceId] = [];
        }
        this.allocatedMachines[allocation.instanceId].push(allocation);
    }
    findMaxReuseCount(instanceId) {
        let minReuseCount = null;
        let minReuseCountInstanceId = null;
        for (const machine of this.machinesConfig.machines) {
            const IMachineAllocations = this.allocatedMachines[machine.instanceId];
            const activeAllocations = IMachineAllocations.length;
            const maxReuseCount = activeAllocations == 0 ? 0 : IMachineAllocations.sort((a, b) => a.reuseCount - b.reuseCount)[0].reuseCount;
            if (activeAllocations < (minReuseCount !== null && minReuseCount !== void 0 ? minReuseCount : Infinity)) {
                minReuseCount = activeAllocations;
                minReuseCountInstanceId = machine.instanceId;
            }
        }
        return minReuseCount;
    }
    findFreeMachine(machinesConfig) {
        // const allocatedInstanceIds = this.allocatedMachines.map(m => m.instanceId);
        const distinctAllocatedInstanceIds = Object.keys(this.allocatedMachines);
        core.debug(`Allocated instance ids: ${JSON.stringify([...distinctAllocatedInstanceIds])}`);
        for (const machine of machinesConfig.machines) {
            // core.debug(`Checking machine "${machine.instanceId}"`);
            if (machine.instanceId in distinctAllocatedInstanceIds) {
                // core.debug(`Found free machine "${machine.instanceId}"`);
                return this.addAllocation(machine.instanceId);
            }
            // core.debug(`Machine "${machine.instanceId}" is already allocated`);
        }
        return null;
    }
    addAllocation(instanceId) {
        const allocation = this.newAllocation(instanceId);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWxsb2NhdG9yU3RhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJBbGxvY2F0b3JTdGF0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLG9EQUFzQztBQUN0QywrQ0FBaUM7QUF3QmhDLENBQUM7QUFHRixNQUFhLFNBQVM7SUFTbEIsWUFBWSxjQUE4QixFQUFFLEtBQXNCOztRQVJsRSxzQkFBaUIsR0FFYjtZQUNJLGlCQUFpQixFQUFFLEVBQUU7U0FDeEIsQ0FBQztRQUtGLElBQUksQ0FBQyxpQkFBaUIsR0FBRztZQUNyQixpQkFBaUIsRUFBRSxFQUFFO1NBQ3hCLENBQUM7UUFFRixJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWMsQ0FBQztRQUNyQyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsTUFBQSxLQUFLLENBQUMsaUJBQWlCLG1DQUFJLEVBQUUsQ0FBQztJQUMzRCxDQUFDO0lBRU8sY0FBYyxDQUFDLFVBQThCO1FBQ2pELElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7WUFDakQsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDdkQsQ0FBQztRQUVELElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ25FLENBQUM7SUFFTyxpQkFBaUIsQ0FBQyxVQUFrQjtRQUN4QyxJQUFJLGFBQWEsR0FBRyxJQUFJLENBQUM7UUFDekIsSUFBSSx1QkFBdUIsR0FBRyxJQUFJLENBQUM7UUFFbkMsS0FBSyxNQUFNLE9BQU8sSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2pELE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUN2RSxNQUFNLGlCQUFpQixHQUFHLG1CQUFtQixDQUFDLE1BQU0sQ0FBQztZQUNyRCxNQUFNLGFBQWEsR0FBRyxpQkFBaUIsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDO1lBRWpJLElBQUksaUJBQWlCLEdBQUcsQ0FBQyxhQUFhLGFBQWIsYUFBYSxjQUFiLGFBQWEsR0FBSSxRQUFRLENBQUMsRUFBRSxDQUFDO2dCQUNsRCxhQUFhLEdBQUcsaUJBQWlCLENBQUM7Z0JBQ2xDLHVCQUF1QixHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUM7WUFDakQsQ0FBQztRQUNMLENBQUM7UUFFRCxPQUFPLGFBQWEsQ0FBQztJQUN6QixDQUFDO0lBRU8sZUFBZSxDQUFDLGNBQThCO1FBQ2xELDhFQUE4RTtRQUM5RSxNQUFNLDRCQUE0QixHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFFekUsSUFBSSxDQUFDLEtBQUssQ0FBQywyQkFBMkIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsNEJBQTRCLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUUzRixLQUFLLE1BQU0sT0FBTyxJQUFJLGNBQWMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUM1QywwREFBMEQ7WUFDMUQsSUFBSSxPQUFPLENBQUMsVUFBVSxJQUFJLDRCQUE0QixFQUFFLENBQUM7Z0JBQ3JELDREQUE0RDtnQkFDNUQsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUNsRCxDQUFDO1lBQ0Qsc0VBQXNFO1FBQzFFLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0lBRU8sYUFBYSxDQUFDLFVBQWtCO1FBQ3BDLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDbEQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNoQyxPQUFPLFVBQVUsQ0FBQztJQUN0QixDQUFDO0lBRU8sYUFBYSxDQUFDLFVBQWtCLEVBQUUsYUFBcUIsQ0FBQztRQUM1RCxPQUFPO1lBQ0gsWUFBWSxFQUFFLE1BQU0sQ0FBQyxVQUFVLEVBQUU7WUFDakMsVUFBVSxFQUFFLFVBQVU7WUFDdEIsVUFBVSxFQUFFLFVBQVU7U0FDekIsQ0FBQztJQUNOLENBQUM7Q0FDSjtBQTNFRCw4QkEyRUMifQ==