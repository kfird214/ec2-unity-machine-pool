import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { input } from "./input";

export const dynamo = new DynamoDBClient({
    region: input.awsRegion,
    credentials: {
        accessKeyId: input.awsAccessKeyId,
        secretAccessKey: input.awsSecretAccessKey,
    },
});
