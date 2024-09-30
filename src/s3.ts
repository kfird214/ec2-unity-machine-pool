import { S3 } from "@aws-sdk/client-s3";
import { input } from "./input";

export const s3 = new S3({
    region: input.awsRegion,
    credentials: {
        accessKeyId: input.awsAccessKeyId,
        secretAccessKey: input.awsSecretAccessKey,
    },
});
