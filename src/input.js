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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.input = exports.awsUnityMachinesAllocationState = exports.awsUnityMachinesConfigFile = void 0;
const core = __importStar(require("@actions/core"));
const assert_1 = __importDefault(require("assert"));
exports.awsUnityMachinesConfigFile = 'unity-machines.json'; // MachinesConfig
exports.awsUnityMachinesAllocationState = 'unity-machines.state.json'; // AllocatorState
const NODE_ENV = process.env['NODE_ENV'];
let inputObj;
if (NODE_ENV != 'local') {
    const allocateMachine = core.getInput('allocate-machine') == 'true';
    inputObj = {
        awsAccessKeyId: core.getInput('aws-access-key-id', { required: true }),
        awsSecretAccessKey: core.getInput('aws-secret-access-key', { required: true }),
        awsRegion: core.getInput('aws-region', { required: true }),
        awsMachinesBucket: core.getInput('aws-machine-bucket', { required: true }),
        allocateMachine: allocateMachine,
        allocationId: core.getInput('allocation_id', { required: !allocateMachine }),
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
    inputObj = {
        awsAccessKeyId: AWS_ACCESS_KEY_ID,
        awsSecretAccessKey: AWS_SECRET_ACCESS_KEY,
        awsRegion: AWS_REGION,
        awsMachinesBucket: AWS_BUCKET,
        allocateMachine: ALLOCATE_MACHINE == 'true',
        allocationId: ALLOCATION_ID,
    };
}
exports.input = inputObj;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5wdXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbnB1dC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLG9EQUFzQztBQUV0QyxvREFBNEI7QUFFZixRQUFBLDBCQUEwQixHQUFHLHFCQUFxQixDQUFDLENBQUMsaUJBQWlCO0FBQ3JFLFFBQUEsK0JBQStCLEdBQUcsMkJBQTJCLENBQUMsQ0FBQyxpQkFBaUI7QUFFN0YsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUV6QyxJQUFJLFFBQXFCLENBQUM7QUFDMUIsSUFBSSxRQUFRLElBQUksT0FBTyxFQUFFLENBQUM7SUFDdEIsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLE1BQU0sQ0FBQztJQUNwRSxRQUFRLEdBQUc7UUFDUCxjQUFjLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUN0RSxrQkFBa0IsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLHVCQUF1QixFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDO1FBQzlFLFNBQVMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUMxRCxpQkFBaUIsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLG9CQUFvQixFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDO1FBQzFFLGVBQWUsRUFBRSxlQUFlO1FBQ2hDLFlBQVksRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLGVBQWUsRUFBRSxDQUFDO0tBQy9FLENBQUM7QUFDTixDQUFDO0tBQU0sQ0FBQztJQUNKLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUMvQixxR0FBcUc7SUFDckcsTUFBTSxpQkFBaUIsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFDM0QsTUFBTSxxQkFBcUIsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixDQUFDLENBQUM7SUFDbkUsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUM3QyxNQUFNLGdCQUFnQixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUN6RCxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ25ELE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7SUFFN0MsSUFBQSxnQkFBTSxFQUFDLGlCQUFpQixFQUFFLCtCQUErQixDQUFDLENBQUM7SUFDM0QsSUFBQSxnQkFBTSxFQUFDLHFCQUFxQixFQUFFLG1DQUFtQyxDQUFDLENBQUM7SUFDbkUsSUFBQSxnQkFBTSxFQUFDLFVBQVUsRUFBRSx3QkFBd0IsQ0FBQyxDQUFDO0lBQzdDLElBQUEsZ0JBQU0sRUFBQyxnQkFBZ0IsRUFBRSw4QkFBOEIsQ0FBQyxDQUFDO0lBQ3pELElBQUEsZ0JBQU0sRUFBQyxVQUFVLEVBQUUsd0JBQXdCLENBQUMsQ0FBQztJQUU3QyxJQUFJLGdCQUFnQixJQUFJLE9BQU87UUFDM0IsSUFBQSxnQkFBTSxFQUFDLGFBQWEsRUFBRSwyQkFBMkIsQ0FBQyxDQUFDO0lBRXZELFFBQVEsR0FBRztRQUNQLGNBQWMsRUFBRSxpQkFBaUI7UUFDakMsa0JBQWtCLEVBQUUscUJBQXFCO1FBQ3pDLFNBQVMsRUFBRSxVQUFVO1FBQ3JCLGlCQUFpQixFQUFFLFVBQVU7UUFDN0IsZUFBZSxFQUFFLGdCQUFnQixJQUFJLE1BQU07UUFDM0MsWUFBWSxFQUFFLGFBQWE7S0FDOUIsQ0FBQztBQUNOLENBQUM7QUFFWSxRQUFBLEtBQUssR0FBRyxRQUFRLENBQUMifQ==