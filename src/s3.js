"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3 = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const input_1 = require("./input");
exports.s3 = new client_s3_1.S3({
    region: input_1.input.awsRegion,
    credentials: {
        accessKeyId: input_1.input.awsAccessKeyId,
        secretAccessKey: input_1.input.awsSecretAccessKey,
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiczMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzMy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxrREFBd0M7QUFDeEMsbUNBQWdDO0FBRW5CLFFBQUEsRUFBRSxHQUFHLElBQUksY0FBRSxDQUFDO0lBQ3JCLE1BQU0sRUFBRSxhQUFLLENBQUMsU0FBUztJQUN2QixXQUFXLEVBQUU7UUFDVCxXQUFXLEVBQUUsYUFBSyxDQUFDLGNBQWM7UUFDakMsZUFBZSxFQUFFLGFBQUssQ0FBQyxrQkFBa0I7S0FDNUM7Q0FDSixDQUFDLENBQUMifQ==